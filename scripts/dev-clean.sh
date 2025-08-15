#!/usr/bin/env bash
set -euo pipefail

PORT=5050
PID_FILE="/tmp/46b.pid"

echo "[dev-clean] Killing anything on :$PORT..."
kill -9 $(lsof -t -iTCP:$PORT -sTCP:LISTEN) 2>/dev/null || true

if [ -f "$PID_FILE" ]; then
  echo "[dev-clean] Killing background PID $(cat "$PID_FILE")..."
  kill -9 "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi

echo "[dev-clean] Verifying port is free..."
lsof -nP -iTCP:$PORT -sTCP:LISTEN || echo "OK: nothing on $PORT"

echo "[dev-clean] Starting: npm run dev"
npm run dev
