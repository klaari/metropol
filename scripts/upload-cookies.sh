#!/usr/bin/env bash
set -euo pipefail

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
yt-dlp --cookies-from-browser "$BROWSER" --cookies "$TMPFILE" "https://youtube.com" 2>/dev/null

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
