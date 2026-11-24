#!/bin/bash
# Scaffold a Three.js video project: copies the template + renderer, installs deps locally.
# Usage: new.sh <target-dir>
# Note: esbuild/npm tooling has hung under ~/Downloads on macOS (macOS file-access prompts). This template needs
# no bundler, so it is fine there; if npm install itself hangs, scaffold under ~/Projects or /tmp and copy back.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?usage: new.sh <target-dir>}"
if [ -e "$DEST/src/main.js" ]; then echo "refusing: $DEST/src/main.js already exists" >&2; exit 1; fi
mkdir -p "$DEST"
cp -R "$SKILL/template/." "$DEST/"
cp "$SKILL/scripts/render.mjs" "$DEST/render.mjs"
cp "$SKILL/scripts/qa.py" "$DEST/qa.py"
mkdir -p "$DEST/assets" "$DEST/out"
cd "$DEST"
npm install --silent --no-audit --no-fund
echo "ready: $DEST"
echo "  node render.mjs check          # load + time one frame"
echo "  node render.mjs stills 0,1,2   # look before rendering"
echo "  node render.mjs video          # full render -> final.mp4"
