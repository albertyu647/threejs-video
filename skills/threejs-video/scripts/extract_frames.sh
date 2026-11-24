#!/bin/bash
# Turn a video into a numbered image sequence for frame-exact use in Three.js (lib/media.js imageSequence).
# Usage: extract_frames.sh <in.mp4> <out-dir> [fps=30] [scale-filter e.g. "scale=1080:-2" or "crop=864:1080:588:0,scale=1080:1350"]
# Writes <out-dir>/0000.jpg ... (q=2, near-lossless). Use PNG instead when you need alpha: set EXT=png.
set -euo pipefail
IN="${1:?in}"; OUT="${2:?out-dir}"; FPS="${3:-30}"; VF="${4:-null}"; EXT="${EXT:-jpg}"
mkdir -p "$OUT"
if [ "$EXT" = png ]; then Q=(); else Q=(-q:v 2); fi
ffmpeg -v error -y -i "$IN" -vf "fps=$FPS,$VF" -start_number 0 "${Q[@]}" "$OUT/%04d.$EXT"
echo "$(ls "$OUT" | wc -l | tr -d ' ') frames -> $OUT/%04d.$EXT"
