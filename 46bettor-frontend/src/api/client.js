// 46bettor-frontend/src/api/client.js

// ---- helpers ---------------------------------------------------------------
function readBase() {
  // Order: header input (localStorage) -> Vite env -> prod API
  return (
    (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) ||
    import.meta?.env?.VITE_API_BASE ||
    "https://api.46bettor.com"
  );
}

function readAdminKey() {
  return (typeof localStorage !== "undefined" && localStorage.getItem("adminKey")) || "";
}

function buildHeaders() {
  const h = { "content-type": "application/json" };
  const k = readAdminKey();
  if (k) h["x-admin-key"] = k;
  return h;
}

async function get(path) {
  const url = `${readBase()}${path}`;
  const res = await fetch(url, { headers: buildHeaders() });
  // try to parse JSON either way so the UI can show the API error body
  let body = null;
  try { body = await res.json(); } catch (_) {}
  if (!res.ok && body && typeof body === "object") return body;
  return body ?? { ok: false, error: `HTTP ${res.status}` };
}

export function saveApiBase(v) {
  if (typeof localStorage !== "undefined") localStorage.setItem("apiBase", v || "");
}

export function saveAdminKey(v) {
  if (typeof localStorage !== "undefined") localStorage.setItem("adminKey", v || "");
}

// ---- API surface -----------------------------------------------------------
export const API = {
  // public, no admin key required (we’ll still send it if present)
  public: {
    health:   ()         => get("/api/public/health"),
    tiles:    ()         => get("/api/public/tiles"),
    recent:   ()         => get("/api/public/recent"),
    picks:    ()         => get("/api/public/picks"),
    odds: {
      nba:    ()         => get("/api/public/odds/nba"),
      nfl:    ()         => get("/api/public/odds/nfl"),
    },
    schedule: {
      nba:    (date)     => get(`/api/public/schedule/nba${date ? `?date=${date}` : ""}`),
      mlb:    (date)     => get(`/api/public/schedule/mlb${date ? `?date=${date}` : ""}`),
      nhl:    (date)     => get(`/api/public/schedule/nhl${date ? `?date=${date}` : ""}`),
      nfl:    (date)     => get(`/api/public/schedule/nfl${date ? `?date=${date}` : ""}`),
      // generic helper some pages expect:
      any:    (sport,date)=> get(`/api/public/schedule/${sport}${date ? `?date=${date}` : ""}`),
    },
  },

  // protected (admin key required)
  metrics: {
    summary: ()         => get("/api/metrics/summary"),
    tiles:   ()         => get("/api/metrics/tiles"),
    ledger:  (from,to)  => get(`/api/metrics/ledger?from=${from}&to=${to}`),
  },

  premium:  ()         => get("/api/premium"),
};

// Legacy aliases so older code continues to work without edits:
API.schedule = (sport, date) => API.public.schedule.any(String(sport || "").toLowerCase(), date);
export { API as api };  // lets you `import { api } from '../api/client'`
export default API;
