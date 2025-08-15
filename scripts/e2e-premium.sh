#!/usr/bin/env bash
set -euo pipefail

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
BASE="http://localhost:5050"
LOG="/tmp/46b_server.log"
PID="/tmp/46b_server.pid"

say(){ printf "\n== %s ==\n" "$*"; }

cd "$PROJ"

say "Clean port 5050"
kill -9 $(lsof -t -i:5050) 2>/dev/null || true
[ -f "$PID" ] && kill -9 "$(cat "$PID")" 2>/dev/null || true

say "Start server (background)"
node index.js >"$LOG" 2>&1 & echo $! > "$PID"
sleep 1

say "Wait for /health"
for i in {1..30}; do
  curl -s "$BASE/health" | grep -q '"ok":true' && break || sleep 1
done
curl -s "$BASE/health" && echo

say "Suggest demo picks"
curl -s "$BASE/api/premium/suggest?bankroll=2000&demo=1" && echo

say "Fetch today's picks"
TODAY_JSON="$(curl -s "$BASE/api/premium/today")"
echo "$TODAY_JSON"

get_id () {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const d=j.data||[];console.log(d['"$1"']?.auditHash||d['"$1"']?._id||"")}catch{console.log("")}});'
}
ID1="$(printf "%s" "$TODAY_JSON" | get_id 0)"
ID2="$(printf "%s" "$TODAY_JSON" | get_id 1)"

say "Settle: first=won, second=lost"
curl -s "$BASE/api/premium/settle/quick?map=$ID1:won,$ID2:lost" && echo

say "Performance Aug 2025"
curl -s "$BASE/api/premium/perf?from=2025-08-01&to=2025-08-31" && echo

say "Stop server"
kill -9 "$(cat "$PID")" 2>/dev/null || true
rm -f "$PID"
echo "Done."
