// integrations/http.js (CommonJS)
const DEFAULT_TIMEOUT_MS = 12000;

async function getJson(url, { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: signal || ctrl.signal });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getJson };
