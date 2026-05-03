#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Upload YouTube cookies to Aani API.
#
# Usage:
#   ./scripts/upload-cookies.sh                  # extract from chrome, upload
#   ./scripts/upload-cookies.sh --browser=firefox
#   ./scripts/upload-cookies.sh --rebuild        # also force a Railway rebuild
#                                                # (use when the API is running stale code,
#                                                # not for routine cookie refreshes)
#
# Required env vars (set in .env or export before running):
#   AANI_API_URL  - API base URL (e.g. https://api.example.com)
#   AANI_API_KEY  - API key matching the API_KEY env var on the server
#   AANI_USER_ID  - Your Clerk user ID

: "${AANI_API_URL:?Set AANI_API_URL}"
: "${AANI_API_KEY:?Set AANI_API_KEY}"
: "${AANI_USER_ID:?Set AANI_USER_ID}"

BROWSER="chrome"
REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --browser=*) BROWSER="${arg#*=}" ;;
    chrome|firefox|edge|brave|safari|chromium|opera|vivaldi) BROWSER="$arg" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done
TMPFILE="$(mktemp /tmp/yt-cookies-XXXXXX.txt)"
trap 'rm -f "$TMPFILE"' EXIT

echo "Extracting cookies from ${BROWSER}..."
python3 -c "
from yt_dlp.cookies import extract_cookies_from_browser
import http.cookiejar

jar = extract_cookies_from_browser('${BROWSER}')
out = http.cookiejar.MozillaCookieJar('${TMPFILE}')
for c in jar:
    if 'youtube' in c.domain or 'google' in c.domain:
        out.set_cookie(c)
out.save(ignore_discard=True, ignore_expires=True)
print(f'Saved {len(out)} YouTube/Google cookies')
"

echo "Uploading to ${AANI_API_URL}/cookies..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AANI_API_URL}/cookies" -H "X-API-Key: ${AANI_API_KEY}" -H "X-User-Id: ${AANI_USER_ID}" -F "cookies=@${TMPFILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "Failed (HTTP ${HTTP_CODE}): ${BODY}"
  exit 1
fi

echo "Done — cookies uploaded."

if [ "$REBUILD" = "1" ]; then
  if ! command -v railway >/dev/null 2>&1; then
    echo "railway CLI not found in PATH — skipping rebuild" >&2
    exit 1
  fi
  echo ""
  echo "Forcing Railway rebuild from current source (railway up --detach)..."
  # `railway redeploy` only re-runs the cached image, which can leave
  # production on stale code. `railway up` always rebuilds from local source.
  cd "$PROJECT_ROOT"
  railway up --detach
  echo "Rebuild triggered. Track progress: railway logs --build"
fi
