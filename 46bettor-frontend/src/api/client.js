// src/api/client.js
function getBase() {
  const fromLS = (localStorage.getItem('apiBase') || '').trim().replace(/\/+$/, '');
  const fromEnv = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '');
  return fromLS || fromEnv || 'https://api.46bettor.com';
}

async function getJSON(path, { admin = false, signal } = {}) {
  const base = getBase();
  const url = `${base}${path}`;
  const headers = { Accept: 'application/json' };

  // Add admin header if requested and we have a key
  if (admin) {
    const key = (localStorage.getItem('adminKey') || '').trim();
    if (key) headers['x-admin-key'] = key;
  }

  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

export const api = {
  base: getBase(),
  refreshBase() {
    this.base = getBase();
    return this.base;
  },

  // Public
  health: (opts) => getJSON('/api/public/health', opts),
  tiles: (opts) => getJSON('/api/public/tiles', opts),
  recent: async (opts) => {
    const d = await getJSON('/api/public/recent', opts);
    if (Array.isArray(d)) return d;
    if (d?.picks) return d.picks;
    if (d?.items) return d.items;
    if (d?.data) return d.data;
    return [];
  },
  schedule: {
    nba: (q = '') => getJSON(`/api/public/schedule/nba${q}`),
    mlb: (q = '') => getJSON(`/api/public/schedule/mlb${q}`),
    nhl: (q = '') => getJSON(`/api/public/schedule/nhl${q}`),
    nfl: (q = '') => getJSON(`/api/public/schedule/nfl${q}`),
    soccer: (q = '?comp=PL') => getJSON(`/api/public/schedule/soccer${q}`),
    all: (q = '?comp=PL') => getJSON(`/api/public/schedule/all${q}`),
  },

  // Protected examples (use admin: true so header is sent)
  metrics: () => getJSON('/api/metrics', { admin: true }),
  premiumList: () => getJSON('/api/premium', { admin: true }),
};
