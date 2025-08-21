// src/api/client.js
/* Tiny API client with admin-key support and nice errors */

const DEFAULT_BASE = 'https://api.46bettor.com';

export function getApiBase() {
  const stored = localStorage.getItem('apiBase');
  return (stored && stored.trim()) || DEFAULT_BASE;
}

export function getAdminKey() {
  return (localStorage.getItem('adminKey') || '').trim();
}

async function http(method, path, { params, signal } = {}) {
  const base = getApiBase().replace(/\/+$/, '');
  const key  = getAdminKey();
  const url  = new URL(base + path);

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = { Accept: 'application/json' };
  if (key) headers['x-admin-key'] = key;

  const res = await fetch(url.toString(), { method, headers, signal });

  // Try to read JSON safely; if not JSON, throw a readable error
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

  if (!res.ok) {
    const msg = data?.error || res.statusText || 'request_failed';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data || text;
    throw err;
  }
  return data;
}

const get = (p, o) => http('GET', p, o);

export const API = {
  // public
  public: {
    health: () => get('/api/public/health'),
    tiles : () => get('/api/public/tiles'),
    recent: () => get('/api/public/recent'),
  },

  // protected (needs x-admin-key)
  metrics: {
    summary: () => get('/api/metrics/summary'),
    tiles  : () => get('/api/metrics/tiles'),
    ledger : (from, to) => get('/api/metrics/ledger', { params: { from, to } }),
  },

  // convenience helpers for UI
  util: { getApiBase, getAdminKey },
};
