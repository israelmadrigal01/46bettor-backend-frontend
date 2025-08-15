/* eslint-disable */ // @ts-nocheck
'use strict';
const express = require('express');
const dns = require('dns');
const https = require('https');
const router = express.Router();

function resolve(host) {
  return new Promise((resolve) => {
    dns.resolve4(host, (err, addrs) => {
      resolve({ host, ok: !err, addrs: addrs || [], error: err ? err.message : null });
    });
  });
}

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({ url, ok: true, status: res.statusCode });
    });
    req.on('error', (e) => resolve({ url, ok: false, error: e.message }));
    req.end();
  });
}

router.get('/', async (_req, res) => {
  const dnsChecks = await Promise.all([
    resolve('api-web.nhle.com'),
    resolve('statsapi.web.nhl.com'),
    resolve('google.com'),
    resolve('cloudflare.com'),
  ]);
  const httpsChecks = await Promise.all([
    head('https://api-web.nhle.com/v1/standings/now'),
    head('https://google.com'),
  ]);
  res.json({ ok: true, dns: dnsChecks, https: httpsChecks });
});

module.exports = router;
