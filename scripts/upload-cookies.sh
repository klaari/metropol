#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Upload YouTube cookies to Metropol API
#
# Usage:
#   ./scripts/upload-cookies.sh
#
# Required env vars (set in .env or export before running):
#   METROPOL_API_URL  - API base URL (e.g. https://api.example.com)
#   METROPOL_API_KEY  - API key matching the API_KEY env var on the server
#   METROPOL_USER_ID  - Your Clerk user ID

: "${METROPOL_API_URL:?Set METROPOL_API_URL}"
: "${METROPOL_API_KEY:?Set METROPOL_API_KEY}"
: "${METROPOL_USER_ID:?Set METROPOL_USER_ID}"

BROWSER="${1:-chrome}"
TMPFILE="$(mktemp /tmp/yt-cookies-XXXXXX.txt)"
trap 'rm -f "$TMPFILE"' EXIT

echo "Extracting cookies from ${BROWSER}..."
python3 -c "
from yt_dlp.cookies import extract_cookies_from_browser
import http.cookiejar

jar = extract_cookies_from_browser('${BROWSER}')
out = http.cookiejar.MozillaCookieJar('${TMPFILE}')
for c in jar:
    out.set_cookie(c)
out.save(ignore_discard=True, ignore_expires=True)
yt_cookies = sum(1 for c in out if 'youtube' in c.domain or 'google' in c.domain)
print(f'Saved {len(out)} cookies ({yt_cookies} YouTube/Google)')
"

echo "Uploading to ${METROPOL_API_URL}/cookies..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${METROPOL_API_URL}/cookies" -H "X-API-Key: ${METROPOL_API_KEY}" -H "X-User-Id: ${METROPOL_USER_ID}" -F "cookies=@${TMPFILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "Done — cookies uploaded."
else
  echo "Failed (HTTP ${HTTP_CODE}): ${BODY}"
  exit 1
fi
