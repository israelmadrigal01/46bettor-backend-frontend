#!/usr/bin/env bash
set -euo pipefail

BASE=${BASE:-http://127.0.0.1:5050}
ADMIN_KEY=${ADMIN_KEY:-a3eba6d6f587279a64d3e0e64df10bf3f957551947eab0798c454cd3459275e7}

echo "== Health (public) =="
curl -sS "$BASE/api/health" | jq .

echo "== Premium/today (protected) =="
curl -sS -H "x-admin-key: $ADMIN_KEY" "$BASE/api/premium/today" | jq .

echo "== Auth check (expect 401 then 200) =="
curl -sS -i "$BASE/api/premium/today" | head -n 5
curl -sS -i -H "x-admin-key: $ADMIN_KEY" "$BASE/api/premium/today" | head -n 5
