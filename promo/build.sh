#!/usr/bin/env bash
# Builds the TapeOut promo film in Turkish and English: video + soundtrack + subtitle files.
# Usage: ./build.sh [outDir]   (needs node, ffmpeg and Playwright's Chromium)
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-out}"
mkdir -p "$OUT"

node soundtrack.mjs "$OUT/soundtrack.wav"
node ../tools/subtitles.mjs . "$OUT" tapeout_promo
node ../tools/render.mjs --dir . --lang tr --out "$OUT" &
node ../tools/render.mjs --dir . --lang en --out "$OUT" &
wait

for lang in tr en; do
  ffmpeg -y -loglevel error -i "$OUT/tapeout_promo_${lang}_video.mp4" -i "$OUT/soundtrack.wav" \
    -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart \
    -metadata title="TapeOut — Promo (${lang^^})" "$OUT/tapeout_promo_${lang}.mp4"
done
echo "done → $OUT"
