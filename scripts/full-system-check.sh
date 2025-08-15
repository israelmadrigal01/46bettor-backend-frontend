#!/usr/bin/env bash
# Full backend smoke test for 46bettor

BASE="${BASE:-http://localhost:5050}"
CURL_OPTS=(--silent --show-error --max-time 12)
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'

say() { printf "%s\n" "$*"; }
ok()  { printf "%s✅ %s%s\n" "$GREEN" "$*" "$RESET"; }
warn(){ printf "%s⚠️  %s%s\n" "$YELLOW" "$*" "$RESET"; }
bad() { printf "%s❌ %s%s\n" "$RED" "$*" "$RESET"; }
info(){ printf "%sℹ️  %s%s\n" "$CYAN" "$*" "$RESET"; }

snip() {
  # show first 220 chars of a file (single line)
  tr -d '\n' < "$1" | cut -c1-220
}

http_get() {
  local path="$1"
  local tmp status
  tmp="$(mktemp)"
  status="$(curl "${CURL_OPTS[@]}" -o "$tmp" -w "%{http_code}" "$BASE$path" || echo "000")"
  if [[ "$status" == "200" || "$status" == "201" || "$status" == "204" ]]; then
    ok "GET $path  ($status)  $(snip "$tmp")"
  else
    bad "GET $path  ($status)  $(snip "$tmp")"
  fi
  rm -f "$tmp"
}

http_post() {
  local path="$1"
  local tmp status
  tmp="$(mktemp)"
  status="$(curl "${CURL_OPTS[@]}" -X POST -o "$tmp" -w "%{http_code}" "$BASE$path" || echo "000")"
  if [[ "$status" == "200" || "$status" == "201" ]]; then
    ok "POST $path  ($status)  $(snip "$tmp")"
  else
    bad "POST $path  ($status)  $(snip "$tmp")"
  fi
  rm -f "$tmp"
}

say "================ 46BETTOR BACKEND SMOKE TEST ================"
info "Base URL: $BASE"
say

# 1) Health
say "-- Health check --"
http_get "/health"
say

# 2) Discover mounted routes
say "-- Discover mounted routes from /api --"
ROUTES_JSON="$(curl "${CURL_OPTS[@]}" "$BASE/api" || true)"
if command -v jq >/dev/null 2>&1; then
  MOUNTED=($(printf "%s" "$ROUTES_JSON" | jq -r '.mounted[]?' 2>/dev/null))
else
  warn "jq not found; using a common route list fallback."
  MOUNTED=(/api/picks /api/odds /api/trends /api/weather /api/history /api/live-scores /api/reddit /api/news /api/teams /api/scores)
fi

if [[ "${#MOUNTED[@]}" -eq 0 ]]; then
  warn "No mounted routes reported by /api. We will still try a few common endpoints."
  MOUNTED=(/api/picks /api/odds /api/trends /api/weather /api/history /api/live-scores)
fi

info "Found ${#MOUNTED[@]} mounted route(s)."
for r in "${MOUNTED[@]}"; do
  http_get "$r"
done
say

# 3) History backfill + query (MLB, small range)
say "-- History backfill + query (MLB) --"
# Small, fixed dates so it works any time
http_post "/api/history/backfill/MLB?start=2024-04-01&end=2024-04-02"
http_get  "/api/history?league=MLB&start=2024-04-01&end=2024-04-02&limit=3"
say

# 4) Summary
say "========================== SUMMARY =========================="
if command -v jq >/dev/null 2>&1; then
  TOTAL="$(printf "%s" "$ROUTES_JSON" | jq -r '.count // "?"' 2>/dev/null)"
  info "Mounted (reported by /api): $TOTAL"
fi
say "Done."
