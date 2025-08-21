// routes/public-schedule.js
const express = require('express');
const router = express.Router();

const bdl = require('../integrations/balldontlie');

// NBA schedule via BallDontLie
router.get('/schedule/nba', async (req, res) => {
  try {
    const todayISO = new Date().toISOString().slice(0, 10);
    const date = (req.query.date || todayISO).slice(0, 10);

    // Accept either exported name
    const fetcher = bdl.nbaGamesByDate || bdl.gamesByDate;
    const out = await fetcher(date);
    return res.json(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ ok: false, error: msg });
  }
});

// Friendly message for /all
router.get('/schedule/all', (_req, res) => {
  res
    .status(400)
    .json({ ok: false, error: 'Unsupported sport "all". Use nba, mlb, nhl, nfl, soccer' });
});

module.exports = router;
