/* eslint-env browser */
const defaultBase = import.meta.env?.VITE_API_BASE || "https://api.46bettor.com";

function getBase() {
  try {
    const ls = localStorage.getItem("apiBase");
    return (ls || defaultBase).replace(/\/+$/, "");
  } catch {
    return defaultBase.replace(/\/+$/, "");
  }
}

function getAdminKey() {
  try {
    return localStorage.getItem("adminKey") || "";
  } catch {
    return "";
  }
}

async function jget(path, { secure = false, qs = "" } = {}) {
  const base = getBase();
  const url = `${base}${path}${qs ? (path.includes("?") ? "&" : "?") + qs : ""}`;
  const headers = { Accept: "application/json" };
  if (secure) headers["x-admin-key"] = getAdminKey();

  const res = await fetch(url, { headers });
  const txt = await res.text();
  let json;
  try { json = txt ? JSON.parse(txt) : null; } catch { json = { ok:false, error: txt || res.statusText }; }

  if (!res.ok) {
    const msg = json?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

const API = {
  base: getBase,
  public: {
    health: () => jget("/api/public/health"),
    tiles:  () => jget("/api/public/tiles"),
    recent: () => jget("/api/public/recent").then(d => Array.isArray(d?.picks) ? d.picks : (d?.picks || d?.items || d?.data || d || [])),
    schedule: {
      nba:   (date) => jget("/api/public/schedule/nba",   { qs: date ? `date=${encodeURIComponent(date)}` : "" }),
      mlb:   (date) => jget("/api/public/schedule/mlb",   { qs: date ? `date=${encodeURIComponent(date)}` : "" }),
      nhl:   (date) => jget("/api/public/schedule/nhl",   { qs: date ? `date=${encodeURIComponent(date)}` : "" }),
      nfl:   (date) => jget("/api/public/schedule/nfl",   { qs: date ? `date=${encodeURIComponent(date)}` : "" }),
      soccer:(comp,date) => jget("/api/public/schedule/soccer", { qs: [comp?`comp=${encodeURIComponent(comp)}`:"", date?`date=${encodeURIComponent(date)}`:""].filter(Boolean).join("&") }),
    },
    odds: {
      nba: () => jget("/api/public/odds/nba"),
      nfl: () => jget("/api/public/odds/nfl"),
      mlb: () => jget("/api/public/odds/mlb"),
      nhl: () => jget("/api/public/odds/nhl"),
    },
    pickById: (id) => jget(`/api/public/picks/${encodeURIComponent(id)}`)
  },
  secure: {
    metrics: {
      summary: () => jget("/api/metrics/summary", { secure: true }),
      tiles:   () => jget("/api/metrics/tiles",   { secure: true }),
      ledger:  (qs="") => jget("/api/metrics/ledger", { secure: true, qs }),
    },
    premium: () => jget("/api/premium", { secure: true }),
  }
};

export default API;
