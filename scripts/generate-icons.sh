#!/usr/bin/env bash
# Regenerate the PWA raster icons from the source SVG (public/icons/icon.svg).
# Provenance record for how the committed PNGs were produced — run after editing
# the SVG. Requires rsvg-convert (librsvg).
set -euo pipefail
cd "$(dirname "$0")/../public/icons"

rsvg-convert -w 192 -h 192 icon.svg -o pwa-192.png
rsvg-convert -w 512 -h 512 icon.svg -o pwa-512.png
rsvg-convert -w 180 -h 180 icon.svg -o apple-touch-icon.png
