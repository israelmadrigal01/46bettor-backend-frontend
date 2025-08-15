// src/lib/api.js
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5051";

function devAdminKey() {
  return import.meta.env.VITE_ADMIN_KEY || localStorage.getItem("ADMIN_KEY") || "";
}

export async function apiGet(path, init = {}) {
  const headers = { "x-admin-key": devAdminKey(), ...(init.headers || {}) };

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Auto-fallback: metrics -> public if 401 or 403
  if (!res.ok && (res.status === 401 || res.status === 403) && path.startsWith("/api/metrics/")) {
    const publicPath = path.replace("/api/metrics/", "/api/public/");
    res = await fetch(`${API_BASE}${publicPath}`, { ...init }); // no admin header
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}
