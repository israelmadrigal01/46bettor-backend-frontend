/* eslint-env browser */

// Unified API client for 46bettor (public + protected endpoints).

const storage = {
  get(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } },
  set(key, val) { try { localStorage.setItem(key, val); } catch {} },
};

function normalizeBase(v) {
  return String(v || '').replace(/\/+$/, '');
}

const API = {
  util: {
    getApiBase() {
      const ls = storage.get('apiBase');
      const env = import.meta.env?.VITE_API_BASE;
      return normalizeBase(ls || env || 'https://api.46bettor.com');
    },
    getAdminKey() {
      return storage.get('adminKey') || '';
    },
  },

  async _request(path, { method = 'GET', body, headers } = {}) {
    const base = API.util.getApiBase();
    const url = `${base}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${url} -> ${res.status} ${res.statusText} ${text}`);
    }
    return res.json();
  },

  async _get(path, headers) { return API._request(path, { method: 'GET', headers }); },
  async _post(path, body, headers) { return API._request(path, { method: 'POST', body, headers }); },

  public: {
    health() { return API._get('/api/public/health'); },
    tiles()  { return API._get('/api/public/tiles'); },
    async recent() {
      const d = await API._get('/api/public/recent');
      if (Array.isArray(d)) return d;
      if (d?.picks && Array.isArray(d.picks)) return d.picks;
      if (d?.items && Array.isArray(d.items)) return d.items;
      if (d?.data && Array.isArray(d.data)) return d.data;
      return [];
    },
    pickById(id) { return API._get(`/api/public/picks/${encodeURIComponent(id)}`); },

    schedule: {
      nba()  { return API._get('/api/public/schedule/nba'); },
      mlb()  { return API._get('/api/public/schedule/mlb'); },
      nhl()  { return API._get('/api/public/schedule/nhl'); },
      nfl()  { return API._get('/api/public/schedule/nfl'); },
      soccer(comp='PL') { return API._get(`/api/public/soccer?comp=${encodeURIComponent(comp)}`); },
    },

    // Extras
    weatherCity(city, units='imperial') {
      return API._get(`/api/public/weather?city=${encodeURIComponent(city)}&units=${encodeURIComponent(units)}`);
    },
    news(q='sports', pageSize=10, language='en') {
      return API._get(`/api/public/news?q=${encodeURIComponent(q)}&pageSize=${pageSize}&language=${encodeURIComponent(language)}`);
    },
    highlights(q='nba highlights', maxResults=6) {
      return API._get(`/api/public/highlights?q=${encodeURIComponent(q)}&maxResults=${maxResults}`);
    },

    // ODDS
    odds: {
      nba(params='') { return API._get(`/api/public/odds/nba${params ? `?${params}` : ''}`); },
      mlb(params='') { return API._get(`/api/public/odds/mlb${params ? `?${params}` : ''}`); },
      nhl(params='') { return API._get(`/api/public/odds/nhl${params ? `?${params}` : ''}`); },
      nfl(params='') { return API._get(`/api/public/odds/nfl${params ? `?${params}` : ''}`); },
    },
  },

  metrics: {
    _hdr() {
      const key = API.util.getAdminKey();
      return key ? { 'x-admin-key': key } : {};
    },
    summary() { return API._get('/api/metrics/summary', API.metrics._hdr()); },
    tiles()   { return API._get('/api/metrics/tiles',   API.metrics._hdr()); },
    ledger(q='') {
      const qs = q || '';
      return API._get(`/api/metrics/ledger${qs ? `?${qs}` : ''}`, API.metrics._hdr());
    },
  },
};

const api = API;
export { API, api };
export default API;
