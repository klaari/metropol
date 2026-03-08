#!/usr/bin/env bash
# build.sh — pre-flight checks then trigger EAS build
# Usage: ./build.sh [preview|production] [--platform android|ios|all]

PROFILE="${1:-preview}"
PLATFORM="${2:-android}"
MOBILE_DIR="apps/mobile"
PASS=0
FAIL=0
WARNS=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARNS+=("$1"); }

echo -e "\n${BOLD}🚀 Metropol pre-build checks${NC} (profile: $PROFILE)\n"

# ── 1. Lock file in sync ───────────────────────────────────────────────────
echo -e "${BOLD}[1/6] Lock file${NC}"
if npm ci --dry-run --ignore-scripts > /dev/null 2>&1; then
  ok "package-lock.json is in sync"
else
  fail "package-lock.json is out of sync — run: npm install && git add package-lock.json"
fi

# ── 2. Duplicate native dependencies ──────────────────────────────────────
echo -e "${BOLD}[2/6] Duplicate dependencies${NC}"
REACT_VERSIONS=$(npm ls react 2>/dev/null | grep -o 'react@[0-9][^ ]*' | sort -u | wc -l | tr -d ' ')
if [ "$REACT_VERSIONS" -le 1 ]; then
  ok "Single React version ($(npm ls react 2>/dev/null | grep -o 'react@[0-9][^ ]*' | sort -u | head -1))"
else
  fail "Multiple React versions: $(npm ls react 2>/dev/null | grep -o 'react@[0-9][^ ]*' | sort -u | tr '\n' ' ')"
fi

# ── 3. EAS env vars set ────────────────────────────────────────────────────
echo -e "${BOLD}[3/6] EAS environment variables${NC}"
REQUIRED_VARS=(
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "EXPO_PUBLIC_DATABASE_URL"
  "EXPO_PUBLIC_R2_ENDPOINT"
  "EXPO_PUBLIC_R2_BUCKET"
  "EXPO_PUBLIC_R2_ACCESS_KEY"
  "EXPO_PUBLIC_R2_SECRET_KEY"
)
EAS_VARS=$(cd "$MOBILE_DIR" && eas env:list --environment "$PROFILE" --non-interactive 2>/dev/null || echo "")
for VAR in "${REQUIRED_VARS[@]}"; do
  if echo "$EAS_VARS" | grep -q "$VAR"; then
    ok "$VAR"
  else
    fail "$VAR is missing from EAS $PROFILE environment"
  fi
done

# ── 4. expo-doctor ─────────────────────────────────────────────────────────
echo -e "${BOLD}[4/6] expo-doctor${NC}"
DOCTOR_OUT=$(cd "$MOBILE_DIR" && npx expo-doctor 2>&1 || true)
# Known acceptable warnings to skip
CRITICAL=$(echo "$DOCTOR_OUT" | grep "✖" | grep -v \
  -e "Metro config" \
  -e "React Native Directory" \
  -e "match versions" \
  || true)
if [ -z "$CRITICAL" ]; then
  ok "No critical expo-doctor issues"
else
  while IFS= read -r line; do
    [[ -n "$line" ]] && fail "expo-doctor: $(echo "$line" | sed 's/.*✖//')"
  done <<< "$CRITICAL"
fi

# ── 5. Bundle compiles ─────────────────────────────────────────────────────
echo -e "${BOLD}[5/6] Bundle export${NC}"
BUNDLE_OUT=$(cd "$MOBILE_DIR" && npx expo export --platform android --output-dir /tmp/metropol-check 2>&1 || true)
rm -rf /tmp/metropol-check
if echo "$BUNDLE_OUT" | grep -q "Exported"; then
  ok "Android bundle exports cleanly"
else
  BUNDLE_ERR=$(echo "$BUNDLE_OUT" | grep -i "error\|Error" | head -3)
  fail "Bundle export failed: $BUNDLE_ERR"
fi

# ── 6. Git state ───────────────────────────────────────────────────────────
echo -e "${BOLD}[6/6] Git state${NC}"
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -eq 0 ]; then
  ok "Working tree is clean"
else
  warn "$UNCOMMITTED uncommitted change(s) — these won't be included in the build"
fi
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNPUSHED" -eq 0 ]; then
  ok "All commits pushed"
else
  warn "$UNPUSHED unpushed commit(s) — EAS builds from the archive upload, not git"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Results:${NC} ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}"

if [ ${#WARNS[@]} -gt 0 ]; then
  echo -e "\n${YELLOW}Warnings:${NC}"
  for w in "${WARNS[@]}"; do echo "  • $w"; done
fi

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}❌ Fix the issues above before building.${NC}\n"
  exit 1
fi

echo -e "\n${GREEN}✅ All checks passed. Triggering EAS build...${NC}\n"
cd "$MOBILE_DIR" && eas build --platform "$PLATFORM" --profile "$PROFILE" --non-interactive
