#!/usr/bin/env bash
# Regenerate public/icon/*.png from assets/icon.svg.
# Requires `brew install librsvg`.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null; then
    echo "rsvg-convert not found. Install with: brew install librsvg" >&2
    exit 1
fi

for size in 16 32 48 96 128; do
    rsvg-convert -w "$size" -h "$size" assets/icon.svg -o "public/icon/$size.png"
done

echo "Rendered icons: 16 32 48 96 128 (from assets/icon.svg)"
