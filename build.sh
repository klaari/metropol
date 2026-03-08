#!/usr/bin/env bash
# build.sh — pre-flight checks then trigger EAS build
# Usage: ./build.sh [preview|production] [--platform android|ios|all]
set -e

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
if npm ci --dry-run --ignore-scripts &>/dev/null; then
  ok "package-lock.json is in sync"
else
  fail "package-lock.json is out of sync — run: npm install && git add package-lock.json"
fi

# ── 2. Duplicate native dependencies ──────────────────────────────────────
echo -e "${BOLD}[2/6] Duplicate dependencies${NC}"
DUPES=$(npm ls react 2>/dev/null | grep "react@" | grep -v "deduped" | wc -l | tr -d ' ')
if [ "$DUPES" -le 1 ]; then
  ok "No duplicate React versions"
else
  fail "Multiple React versions found — run: npm install to deduplicate"
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
MISSING_VARS=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if echo "$EAS_VARS" | grep -q "$VAR"; then
    ok "$VAR is set"
  else
    fail "$VAR is missing from EAS $PROFILE environment"
    MISSING_VARS=$((MISSING_VARS + 1))
  fi
done

# ── 4. expo-doctor ─────────────────────────────────────────────────────────
echo -e "${BOLD}[4/6] expo-doctor${NC}"
DOCTOR_OUT=$(cd "$MOBILE_DIR" && npx expo-doctor 2>&1)
DOCTOR_FAILS=$(echo "$DOCTOR_OUT" | grep -c "✖" || true)
# Only fail on critical checks, warn on known acceptable ones
CRITICAL_FAILS=$(echo "$DOCTOR_OUT" | grep "✖" | grep -v "Metro config\|React Native Directory\|match versions" || true)
if [ -z "$CRITICAL_FAILS" ]; then
  ok "No critical expo-doctor issues"
else
  while IFS= read -r line; do
    fail "expo-doctor: $line"
  done <<< "$CRITICAL_FAILS"
fi
# Warn on version mismatches
VERSION_WARNS=$(echo "$DOCTOR_OUT" | grep "Major version mismatches" || true)
[ -n "$VERSION_WARNS" ] && warn "Package version mismatches detected (check expo-doctor output)"

# ── 5. Bundle compiles ─────────────────────────────────────────────────────
echo -e "${BOLD}[5/6] Bundle export (dry run)${NC}"
if cd "$MOBILE_DIR" && npx expo export --platform android --output-dir /tmp/metropol-bundle-check &>/dev/null; then
  ok "Android bundle exports cleanly"
  rm -rf /tmp/metropol-bundle-check
else
  fail "Bundle export failed — JS errors present"
fi
cd - > /dev/null

# ── 6. Git state ───────────────────────────────────────────────────────────
echo -e "${BOLD}[6/6] Git state${NC}"
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -eq 0 ]; then
  ok "Working tree is clean"
else
  warn "$UNCOMMITTED uncommitted change(s) — build will use committed code, not local changes"
fi
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNPUSHED" -eq 0 ]; then
  ok "All commits pushed to origin"
else
  warn "$UNPUSHED commit(s) not pushed — EAS will build from the uploaded archive, not origin"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Results:${NC} ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}"

if [ ${#WARNS[@]} -gt 0 ]; then
  echo -e "\n${YELLOW}Warnings:${NC}"
  for w in "${WARNS[@]}"; do echo "  • $w"; done
fi

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}❌ Pre-flight failed. Fix the issues above before building.${NC}\n"
  exit 1
fi

echo -e "\n${GREEN}✅ All checks passed. Starting EAS build...${NC}\n"
cd "$MOBILE_DIR" && eas build --platform "$PLATFORM" --profile "$PROFILE" --non-interactive
