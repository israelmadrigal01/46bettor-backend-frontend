/* eslint-disable */ // @ts-nocheck
'use strict';
const axios = require('axios');
const https = require('https');
const dns = require('dns');
const { URL } = require('url');

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// Resolve a hostname to a single IPv4 address
function resolve4(host) {
  return new Promise((resolve, reject) => {
    dns.resolve4(host, (err, addrs) => {
      if (err) return reject(err);
      if (!addrs || !addrs.length) return reject(new Error('No A records'));
      resolve(addrs[0]);
    });
  });
}

/**
 * For hosts that can be flaky with local DNS (NHL web API), rewrite to direct IP
 * and set SNI + Host header so TLS/HTTP still works.
 */
async function rewriteForDirectIP(rawUrl) {
  const u = new URL(rawUrl);
  const host = u.hostname;

  if (host === 'api-web.nhle.com') {
    const ip = await resolve4(host);
    const rewritten = `${u.protocol}//${ip}${u.pathname}${u.search}`;
    const httpsAgent = new https.Agent({ keepAlive: true, servername: host }); // SNI
    const headers = { Host: host };
    return { url: rewritten, httpsAgent, headers };
  }

  return { url: rawUrl, httpsAgent: undefined, headers: {} };
}

/** Build browser-like headers for sites that enforce them (NBA CDN, ESPN, etc.) */
function defaultHeadersFor(rawUrl, userHeaders = {}) {
  const u = new URL(rawUrl);
  const h = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // NBA CDN wants nba.com referrer/origin
  if (u.hostname.endsWith('nba.com')) {
    h['Referer'] = 'https://www.nba.com/scores';
    h['Origin']  = 'https://www.nba.com';
  }

  // ESPN API is sometimes picky as well
  if (u.hostname.endsWith('espn.com')) {
    h['Referer'] = 'https://www.espn.com/nba/scoreboard';
    h['Origin']  = 'https://www.espn.com';
  }

  return { ...h, ...(userHeaders || {}) };
}

/** GET with retries/timeouts; adds site-specific headers; DNS-free for NHL web API */
async function httpGet(rawUrl, opts = {}) {
  const timeout = opts.timeout ?? 15000;
  const retries = opts.retries ?? 2;
  const backoffMs = opts.backoffMs ?? 400;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const cfg = await rewriteForDirectIP(rawUrl);
      const res = await axios.get(cfg.url, {
        timeout,
        httpsAgent: cfg.httpsAgent,
        maxRedirects: 10,
        headers: defaultHeadersFor(rawUrl, { ...(opts.headers || {}), ...(cfg.headers || {}) }),
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return res.data;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(backoffMs * (attempt + 1));
    }
  }
  throw lastErr;
}

module.exports = { httpGet };
