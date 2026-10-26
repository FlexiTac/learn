#!/usr/bin/env bash
# Runs scripts/explore-review.mjs over the whole matrix against a preview server:
#   npm run build && npx vite preview --port 4322 &   then   bash scripts/explore-review.sh [base] [outDir]
# Every lesson at 1440x900 light + dark, lessons 1, 4, 7 at 390x844; 4 at a time. Prints one RESULT line per run.
# SIZES="2560x1440 1920x1080 1440x900 1280x800 1024x768" runs every lesson at each of those desktop sizes instead
# (the stage-mode review, ~25 min).
cd "$(dirname "$0")/.."
BASE=${1:-http://localhost:4322}
OUT=${2:-review/explore}
SIZES=${SIZES:-1440x900}
L="1:meet-flexitac 2:the-sandwich 3:electrodes-slots-beam 4:one-crossing 5:voltage-divider 6:volts-to-byte 7:drive-32-lines 8:listen-12-lines 9:one-frame 10:flash-firmware 11:bytes-to-touch 12:build-your-own"
{
  for th in light dark; do for sz in $SIZES; do for e in $L; do n=${e%%:*}; link=-; case $n in 1|4|7) link=link;; esac; echo "${e#*:} $n ${sz%x*} ${sz#*x} $th $link"; done; done; done
  for e in 1:meet-flexitac 4:one-crossing 7:drive-32-lines; do echo "${e#*:} ${e%%:*} 390 844 light link"; echo "${e#*:} ${e%%:*} 390 844 dark -"; done
} | xargs -P 4 -L 1 sh -c 'node --experimental-websocket scripts/explore-review.mjs "'"$BASE"'" "'"$OUT"'" "$0" "$@"' | grep -E "RESULT|!!|exception|error"
