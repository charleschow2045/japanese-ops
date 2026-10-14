#!/bin/bash
# Runs the browser tests in tests/*.js (see tests/README.md).
#   tests/run.sh            → all tests
#   tests/run.sh c2 v3test  → only those (names without .js)
# Env: PORT (default 5804), BASE_URL (skip starting a server), CHROMIUM (browser binary).
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$HERE")
PORT=${PORT:-5804}
export BASE_URL=${BASE_URL:-http://localhost:$PORT}
cd "$ROOT" || exit 1

started=""
if ! curl -s -o /dev/null "$BASE_URL/index.html"; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  started=$!
  sleep 1.5
fi
OUT=$(mktemp -d)
cleanup() { [ -n "$started" ] && kill "$started" 2>/dev/null; rm -rf "$OUT"; }
trap cleanup EXIT

if [ $# -gt 0 ]; then names="$*"; else names=$(ls "$HERE"/*.js | xargs -n1 basename | sed 's/\.js$//' | grep -vx -e lib -e rom); fi

tot=0; bad=0
for n in $names; do
  out=$(timeout 300 node "$HERE/$n.js" "$OUT" 2>&1)
  fails=$(echo "$out" | grep -cE "^FAIL|^ERR|Error:|TimeoutError|^errs \[.+\]|^bad [1-9]")
  oks=$(echo "$out" | grep -c "^ok")
  tot=$((tot+1)); [ "$fails" -gt 0 ] && bad=$((bad+1))
  printf "%-10s ok=%-3s fail=%s\n" "$n" "$oks" "$fails"
  [ "$fails" -gt 0 ] && echo "$out" | grep -E "^FAIL|^ERR|Error:|TimeoutError|^errs \[|^bad " | head -6 | sed 's/^/     /'
done
echo "== $tot tests, $bad with failures"
[ "$bad" -eq 0 ]
