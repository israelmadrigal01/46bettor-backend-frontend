// routes/public.js
const express = require('express');
const router = express.Router();
const metrics = require('../controllers/metricsController');
const cache = require('../utils/cache');
const rateLimit = require('../middleware/ratelimit')({
  windowMs: Number(process.env.PUBLIC_WINDOW_MS || 15_000),
  limit: Number(process.env.PUBLIC_RATE_LIMIT || 30),
});
const pub = require('../controllers/publicController');

const TTL = Number(process.env.PUBLIC_CACHE_SEC || 5);

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

router.use(rateLimit);

router.get('/health', (req, res) => {
  res.json({ ok: true, service: '46bettor-backend/public', ts: new Date().toISOString() });
});

router.get('/tiles',  withCache(TTL, metrics.tiles));
router.get('/ledger', withCache(TTL, metrics.ledger));
router.get('/record', withCache(TTL, metrics.record));

router.get('/scoreboard', withCache(TTL, pub.scoreboard));
router.get('/recent',     withCache(TTL, pub.recent));

module.exports = router;
