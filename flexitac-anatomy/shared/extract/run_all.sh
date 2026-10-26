#!/usr/bin/env bash
# Regenerate shared/data/*.json (+ index.mjs, constants.mjs) from the ORIGINAL files.
# Reads /material (read-only) and ../refs; writes only inside shared/.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED="$(dirname "$HERE")"
ROOT="$(dirname "$SHARED")"                       # flexitac-anatomy/
MATERIAL="${MATERIAL:-$(dirname "$ROOT")/material}"
WORK="$HERE/work"
DATA="$SHARED/data"
PY="${PYTHON:-python3}"

mkdir -p "$WORK" "$DATA"
for z in Gerber_16_32 Gerber_Bottom_FPC_2026-03-02 Gerber_Top_FPC_2026-03-02; do
  rm -rf "$WORK/$z"; mkdir -p "$WORK/$z"
  unzip -q -o "$MATERIAL/$z.zip" -d "$WORK/$z"
done
"$PY" -I -B "$HERE/extract_fpc.py" "$WORK" "$DATA"
"$PY" -I -B "$HERE/extract_board.py" "$WORK" "$MATERIAL" "$DATA"
"$PY" -I -B "$HERE/build_meta.py" "$ROOT/refs" "$DATA"
# viridis LUT needs OpenCV; regenerate only when a python with cv2 is available
VPY="${FLEXITAC_PY:-$ROOT/.venv-py/bin/python}"
if [ -x "$VPY" ] && "$VPY" -I -c 'import cv2' 2>/dev/null; then
  "$VPY" -I -B "$HERE/gen_viridis.py" "$SHARED/models/viridis.mjs"
else
  echo "viridis: OpenCV not available, keeping models/viridis.mjs"
fi
echo "data written to $DATA"
