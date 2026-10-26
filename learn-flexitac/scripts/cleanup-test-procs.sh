#!/usr/bin/env bash
# Close the headless Chrome windows and throw-away vite servers that test and review scripts leave behind.
# Each leaked Chrome holds inotify instances (the per-user limit is 128), and enough of them stop vite from starting
# ("EMFILE: too many open files, watch").
#   cleanup-test-procs.sh               everything matching, whenever it started
#   cleanup-test-procs.sh --since EPOCH only what started at or after EPOCH (start.sh passes its own start time)
#   cleanup-test-procs.sh --dry-run     list, don't close
# Matches only test processes: Chrome started --headless with --remote-debugging-port=0 (your own browser is never
# headless), and vite/vite-preview servers whose command line points at a /tmp build (--outDir /tmp/... or
# --config /tmp/...). The dev server on 5173 started by start.sh is not matched.
since=0
dry=0
while [ $# -gt 0 ]; do
  case "$1" in
    --since) since="$2"; shift 2 ;;
    --dry-run) dry=1; shift ;;
    *) echo "usage: $0 [--since EPOCH] [--dry-run]" >&2; exit 2 ;;
  esac
done
now=$(date +%s)
pids=$(ps -eo pid=,etimes=,args= | awk -v since="$since" -v now="$now" '
  {
    started = now - $2
    if (started < since) next
    chrome = ($3 ~ /chrome$/ && /--headless/ && /--remote-debugging-port=0/)
    vite = (/node_modules\/\.bin\/vite|vite\/bin\/vite\.js/ && /(--outDir|--config) \/tmp\//)
    if (chrome || vite) print $1
  }')
count=$(echo "$pids" | grep -c . || true)
if [ "$count" -eq 0 ]; then
  echo "cleanup: no test browsers or servers to close"
  exit 0
fi
if [ "$dry" -eq 1 ]; then
  echo "cleanup: would close $count process(es):"
  ps -o pid=,etime=,args= -p $(echo $pids | tr ' ' ',') | cut -c1-140
  exit 0
fi
kill $pids 2>/dev/null || true
echo "cleanup: closed $count test browser/server process(es)"
