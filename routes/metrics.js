// routes/metrics.js  — protected metrics endpoints
// These reuse your existing public controller handlers so the
// JSON shapes match what the frontend already expects.

const express = require('express');
const router = express.Router();

let pub = null;
try {
  // adjust the path if your controller file lives elsewhere
  pub = require('../controllers/publicController.js');
} catch (e) {
  console.warn('[metrics] publicController.js not found:', e?.message || e);
}

/**
 * GET /api/metrics/summary
 * For now, return the same data as the public tiles endpoint.
 */
router.get('/summary', async (req, res) => {
  if (pub && typeof pub.tiles === 'function') {
    return pub.tiles(req, res); // reuse existing summary logic
  }
  return res.json({
    ok: true,
    gated: true,
    note: 'metrics summary stub (public controller not found)',
    ts: new Date().toISOString(),
  });
});

/**
 * GET /api/metrics/tiles
 * Mirrors /api/public/tiles so the Premium page can render something useful.
 */
router.get('/tiles', async (req, res) => {
  if (pub && typeof pub.tiles === 'function') {
    return pub.tiles(req, res);
  }
  return res.json({
    ok: true,
    gated: true,
    note: 'metrics tiles stub (public controller not found)',
    ts: new Date().toISOString(),
  });
});

/**
 * GET /api/metrics/ledger?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Reuse your public .recent handler for now (it already lists picks).
 * If your public controller supports date filtering via query, it will apply.
 */
router.get('/ledger', async (req, res) => {
  if (pub && typeof pub.recent === 'function') {
    return pub.recent(req, res);
  }
  return res.json({
    ok: true,
    items: [],
    note: 'metrics ledger stub (public controller not found)',
  });
});

module.exports = router;
