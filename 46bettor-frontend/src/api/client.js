/* eslint-env browser */
// src/api/client.js
const getBase = () =>
  (localStorage.getItem('apiBase') || import.meta.env.VITE_API_BASE || 'https://api.46bettor.com')
    .replace(/\/+$/, '');

const getAdminKey = () => localStorage.getItem('adminKey') || '';

async function getJSON(path, { signal, headers = {} } = {}) {
  const url = `${getBase()}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

export const api = {
  // public
  health: () => getJSON('/api/public/health'),
  tiles: () => getJSON('/api/public/tiles'),
  recent: async () => {
    const d = await getJSON('/api/public/recent');
    if (Array.isArray(d)) return d;
    if (d?.picks) return d.picks;
    if (d?.items) return d.items;
    if (d?.data) return d.data;
    return [];
  },

  // schedule (NBA via balldontlie)
  schedule: (sport = 'nba', date /* YYYY-MM-DD or undefined */) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return getJSON(`/api/public/schedule/${encodeURIComponent(sport)}${qs}`);
  },

  // odds (NBA/NFL wired)
  odds: (sport = 'nba') => getJSON(`/api/public/odds/${encodeURIComponent(sport)}`),

  // protected (x-admin-key)
  premium: () =>
    getJSON('/api/premium', { headers: { 'x-admin-key': getAdminKey() } }),
  metricsSummary: () =>
    getJSON('/api/metrics/summary', { headers: { 'x-admin-key': getAdminKey() } }),
};

// Back-compat so old imports keep working:
export { api as API };
