#!/usr/bin/env bash
# Push updates to the installed Aani APK on your phone.
#
# Default:  publish a JS-only OTA update to the 'preview' channel.
#           The installed app pulls it on next launch — no URL, no reinstall.
#
# --full:   build a new native APK via EAS. Needed only when native deps,
#           app.json, or SDK versions change. Prints a QR code (on a laptop
#           with qrencode) or the raw install URL (on Termux / no qrencode)
#           so you can install the APK on your phone.
#
# Usage:
#   ./scripts/ship-mobile.sh            # OTA push
#   ./scripts/ship-mobile.sh --full     # full APK rebuild + install link

set -euo pipefail

cd "$(dirname "$0")/../apps/mobile"

mode="ota"
case "${1:-}" in
  "")       mode="ota" ;;
  --full)   mode="full" ;;
  -h|--help)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *) echo "unknown flag: $1 (try --help)" >&2; exit 1 ;;
esac

on_phone() {
  [[ -n "${TERMUX_VERSION:-}" ]] || [[ "$(uname -o 2>/dev/null)" = "Android" ]]
}

print_install_link() {
  local url
  url=$(eas build:list --platform=android --status=finished --limit=1 \
                       --json --non-interactive 2>/dev/null \
        | jq -r '.[0].artifacts.buildUrl // empty')

  if [[ -z "$url" ]]; then
    echo "✗ Could not find a finished Android build. Check 'eas build:list'." >&2
    exit 1
  fi

  echo ""
  echo "  Install URL:"
  echo "  $url"
  echo ""

  if on_phone; then
    echo "  (Tap the URL above — your browser will download the APK.)"
    return
  fi

  if command -v qrencode >/dev/null 2>&1; then
    echo "  Scan with your phone camera:"
    echo ""
    qrencode -t ANSIUTF8 -m 2 "$url"
  else
    echo "  Tip: 'sudo apt install qrencode' to render a scannable QR here."
  fi
}

case "$mode" in
  ota)
    echo "→ Publishing OTA update to channel 'preview' (android only)…"
    CI=1 eas update --channel preview --platform android --auto
    echo ""
    echo "✓ Done. Force-quit Aani on your phone and reopen — it pulls the update on launch."
    ;;
  full)
    echo "→ Building a new preview APK via EAS (~10 min)…"
    CI=1 eas build --profile preview --platform android
    print_install_link
    ;;
esac
