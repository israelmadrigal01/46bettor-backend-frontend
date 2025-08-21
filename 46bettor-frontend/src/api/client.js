// 46bettor-frontend/src/api/client.js
/* Minimal API client + global fetch patch to attach x-admin-key on protected endpoints */

function getBase() {
  // Prefer localStorage override, then Vite env, then prod API
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = import.meta?.env?.VITE_API_BASE || "";
  const base = (ls || env || "https://api.46bettor.com").replace(/\/+$/, "");
  return base;
}

export const api = {
  get base() {
    return getBase();
  },
  headers(extra = {}) {
    const h = new Headers(extra);
    h.set("Accept", "application/json");
    const k = typeof localStorage !== "undefined" ? localStorage.getItem("adminKey") : "";
    if (k) h.set("x-admin-key", k);
    return h;
  },
  async get(path, init = {}) {
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    const res = await fetch(url, { ...init, headers: this.headers(init.headers) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
};

// --- Global fetch patch: automatically attach x-admin-key for /api/metrics and /api/premium ---
(function patchFetchForAdminKey() {
  if (typeof window === "undefined" || !window.fetch) return;
  const original = window.fetch;
  window.fetch = (input, init = {}) => {
    try {
      const urlStr = typeof input === "string" ? input : (input && input.url) || "";
      // Build absolute if it's a relative API path
      const abs = urlStr.startsWith("http") ? urlStr : `${getBase()}${urlStr.startsWith("/") ? "" : "/"}${urlStr}`;
      const pathname = new URL(abs).pathname;
      const needsKey = /^\/api\/(metrics|premium)\b/.test(pathname);

      if (needsKey) {
        const k = (typeof localStorage !== "undefined" && localStorage.getItem("adminKey")) || "";
        const headers = new Headers(init.headers || {});
        headers.set("Accept", "application/json");
        if (k) headers.set("x-admin-key", k);
        return original(input, { ...init, headers });
      }
    } catch (_) {
      // fall through to original fetch
    }
    return original(input, init);
  };
})();
