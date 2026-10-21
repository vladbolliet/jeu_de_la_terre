#!/usr/bin/env bash
# Rebuilds apps/screen/public/film/intro.mp4 from the voice-over (see ../voix-off.md, « Montage automatique »).
# Needs python3 and network access; everything else goes into a temporary work dir.
# Usage: docs/film/montage/build.sh [workdir]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${1:-$(mktemp -d)}"
VOICE="$REPO/docs/film/audio/voix-off.mp3"
mkdir -p "$WORK"/{media,data,fonts,work}
echo "work dir: $WORK"

[ -x "$WORK/venv/bin/python" ] || python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install -q imageio-ffmpeg faster-whisper numpy pillow fonttools brotli
PY="$WORK/venv/bin/python"
export FFMPEG="$("$PY" -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"

# Images, chart data, the screen's fonts as static TTF.
"$PY" "$HERE/fetch.py" "$WORK/media" "$HERE/media.txt"
curl -sfL -o "$WORK/data/co2_mm_mlo.csv" https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
curl -sfL -A Mozilla/5.0 -o "$WORK/data/co2.csv" \
  "https://ourworldindata.org/grapher/annual-co2-emissions-per-country.csv?country=~OWID_WRL&useColumnShortNames=true"
curl -sfL -A Mozilla/5.0 -o "$WORK/data/gistemp.csv" https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv
"$PY" - "$REPO" "$WORK/fonts" <<'EOF'
import glob, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
repo, out = sys.argv[1:]
for name, weights in [("unbounded", [700, 800]), ("onest", [500, 600, 700])]:
    src = glob.glob(f"{repo}/node_modules/.pnpm/@fontsource-variable+{name}*/node_modules/@fontsource-variable/"
                    f"{name}/files/{name}-latin-wght-normal.woff2")[0]
    for w in weights:
        instancer.instantiateVariableFont(TTFont(src), {"wght": w}).save(f"{out}/{name}-{w}.ttf")
EOF

# Word timestamps of the voice, then the film.
"$FFMPEG" -v error -y -i "$VOICE" -ac 1 -ar 16000 -f f32le "$WORK/work/voice.f32"
"$PY" "$HERE/transcribe.py" "$WORK/work/voice.f32" "$WORK/work/words.json"
"$PY" "$HERE/render.py" "$WORK" "$VOICE" "$REPO/apps/screen/public/film/intro.mp4"
