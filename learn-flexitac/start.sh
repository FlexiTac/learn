#!/usr/bin/env bash
# Start the Learn FlexiTac dev server and open it in the browser.
# Node lives in the conda env "anatomy", not on the system PATH.
# Ctrl+C stops the server and also closes the headless test browsers and throw-away servers that were opened while it
# ran (scripts/cleanup-test-procs.sh), so they can't pile up and exhaust the file-watch limit.
set -e
export PATH="$HOME/miniforge3/envs/anatomy/bin:$PATH"
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
started=$(date +%s)
cleanup() {
  trap - EXIT INT TERM
  bash scripts/cleanup-test-procs.sh --since "$started" || true
}
trap cleanup EXIT INT TERM
npm run dev -- --open "$@"
