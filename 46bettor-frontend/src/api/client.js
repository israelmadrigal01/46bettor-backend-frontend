// 46bettor-frontend/src/api/client.js — FULL FILE (backward-compatible)

// ---------- storage helpers ----------
const LS_API_BASE = "apiBase";
const LS_ADMIN_KEY = "adminKey";

export function saveApiBase(v) {
  if (typeof v === "string" && v.trim()) localStorage.setItem(LS_API_BASE, v.trim());
}
export function saveAdminKey(v) {
  if (typeof v === "string" && v.trim()) localStorage.setItem(LS_ADMIN_KEY, v.trim());
}

function getApiBase() {
  const fromLS = (localStorage.getItem(LS_API_BASE) || "").trim();
  const fromEnv = (import.meta?.env?.VITE_API_BASE || "").trim();
  return fromLS || fromEnv || "https://api.46bettor.com";
}
function getHeaders() {
  const h = { "Content-Type": "application/json" };
  const key = localStorage.getItem(LS_ADMIN_KEY);
  if (key && key.length >= 16) h["x-admin-key"] = key;
  return h;
}

// ---------- HTTP ----------
async function get(path) {
  const base = getApiBase().replace(/\/+$/, "");
  const url = `${base}${path}`;
  const res = await fetch(url, { headers: getHeaders() });
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { /* ignore parse errors */ }
  if (!res.ok) {
    const msg = data?.error || data?.message || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

// ---------- public endpoints ----------
const Public = {
  health: () => get("/api/public/health"),
  tiles:  () => get("/api/public/tiles"),
  recent: () => get("/api/public/recent"),

  schedule: {
    nba:  (date) => get(`/api/public/schedule/nba${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    mlb:  (date) => get(`/api/public/schedule/mlb${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    nhl:  (date) => get(`/api/public/schedule/nhl${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    nfl:  (date) => get(`/api/public/schedule/nfl${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    soccer: (comp, date) => {
      const p = [];
      if (comp) p.push(`comp=${encodeURIComponent(comp)}`);
      if (date) p.push(`date=${encodeURIComponent(date)}`);
      return get(`/api/public/schedule/soccer${p.length ? `?${p.join("&")}` : ""}`);
    },
  },

  odds: (sport) => get(`/api/public/odds/${encodeURIComponent(sport)}`),
};

// ---------- protected endpoints (need x-admin-key) ----------
const Metrics = {
  summary: () => get("/api/metrics/summary"),
  tiles:   () => get("/api/metrics/tiles"),
  ledger:  (from, to) =>
    get(`/api/metrics/ledger?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};

const Premium = {
  list: () => get("/api/premium"),
};

// ---------- legacy-friendly wrappers ----------
function normalizeDate(d) {
  if (!d) return undefined;
  // accept Date, string, or dayjs-like object
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d?.format === "function") return d.format("YYYY-MM-DD");
  if (typeof d === "string") return d;
  return undefined;
}

// Many existing pages call: api.schedule("nba", { date }) OR api.schedule("nba", dateString)
async function scheduleLegacy(sport, arg) {
  const s = String(sport || "").toLowerCase();
  const date = normalizeDate(typeof arg === "object" ? arg?.date : arg);
  const comp  = typeof arg === "object" ? arg?.comp : undefined;

  switch (s) {
    case "nba":   return Public.schedule.nba(date);
    case "mlb":   return Public.schedule.mlb(date);
    case "nhl":   return Public.schedule.nhl(date);
    case "nfl":   return Public.schedule.nfl(date);
    case "soccer": return Public.schedule.soccer(comp, date);
    default: throw new Error(`Unsupported sport "${sport}"`);
  }
}

// Some pages used api.odds("nba")
const oddsLegacy = (sport) => Public.odds(sport);

// ---------- exported surfaces ----------
export const API = {
  base: () => getApiBase(),
  public: Public,
  metrics: Metrics,
  premium: Premium,

  // legacy-friendly helpers so you don't have to touch old pages:
  schedule: scheduleLegacy,
  odds: oddsLegacy,
};

// Legacy alias to avoid changing imports like: `import { api } from '../api/client'`
export const api = API;
