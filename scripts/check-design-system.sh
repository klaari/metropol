#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

hex_violations="$(
  grep -rEon "#[0-9a-fA-F]{3,8}" apps/mobile/app apps/mobile/components \
    --include='*.tsx' --include='*.ts' \
    | grep -v 'apps/mobile/components/ui/' \
    | grep -v 'apps/mobile/design/' || true
)"

restricted_imports="$(
  grep -rEon "import .*\\b(Text|Pressable)\\b.*from [\"']react-native[\"']" \
    apps/mobile/app apps/mobile/components \
    --include='*.tsx' --include='*.ts' \
    | grep -v 'apps/mobile/components/ui/' || true
)"

stylesheet_violations="$(
  grep -rEon "StyleSheet\\.create" apps/mobile/app apps/mobile/components \
    --include='*.tsx' --include='*.ts' \
    | grep -v 'apps/mobile/components/ui/' || true
)"

failed=0
strict="${DESIGN_SYSTEM_STRICT:-1}"

if [ -n "$hex_violations" ]; then
  echo "Raw hex found in app/components. Use palette.*:"
  echo "$hex_violations"
  failed=1
fi

if [ -n "$restricted_imports" ]; then
  echo "Bare Text/Pressable imports found. Use components/ui primitives:"
  echo "$restricted_imports"
  failed=1
fi

if [ -n "$stylesheet_violations" ]; then
  echo "StyleSheet.create found outside components/ui. Move styling into primitives:"
  echo "$stylesheet_violations"
  failed=1
fi

if [ "$strict" = "1" ]; then
  exit "$failed"
fi

if [ "$failed" = "1" ]; then
  echo "Design-system guard is running in migration warning mode."
  echo "Set DESIGN_SYSTEM_STRICT=1 to fail on these violations."
fi
