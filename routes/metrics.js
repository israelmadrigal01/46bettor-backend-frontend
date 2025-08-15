// routes/metrics.js
const express = require('express');
const router = express.Router();
const metrics = require('../controllers/metricsController');
const cache = require('../utils/cache');

const TTL = Number(process.env.METRICS_CACHE_SEC || 10);

// Admin-key guard
router.use((req, res, next) => {
  const key = req.header('x-admin-key');
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Simple cache wrapper
function withCache(ttlSec, handler) {
  return async (req, res, next) => {
    const key = req.originalUrl;
    const hit = cache.get(key);
    if (hit) return res.json(hit);

    const send = res.json.bind(res);
    res.json = (body) => { cache.set(key, body, ttlSec); return send(body); };
    try { await handler(req, res, next); } catch (e) { next(e); }
  };
}

// Existing endpoints
router.get('/summary',  withCache(TTL, metrics.summary));
router.get('/ledger',   withCache(TTL, metrics.ledger));
router.get('/record',   withCache(TTL, metrics.record));
router.get('/export.csv', metrics.exportCsv); // don't cache file download

// NEW: group-by and streaks
router.get('/by/:field', withCache(TTL, metrics.groupBy)); // field: sport|league|market|selection|source|tags
router.get('/streaks',   withCache(TTL, metrics.streaks));
// NEW: dashboard tiles
+router.get('/tiles',     withCache(TTL, metrics.tiles));
module.exports = router;
