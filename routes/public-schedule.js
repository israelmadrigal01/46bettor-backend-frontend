// routes/public-schedule.js
const express = require('express');
const router = express.Router();

const bdl = require('../integrations/balldontlie');

// NBA schedule via BallDontLie
router.get('/schedule/nba', async (req, res) => {
  try {
    // accept ?date=YYYY-MM-DD, fallback to today
    const todayISO = new Date().toISOString().slice(0, 10);
    const date = (req.query.date || todayISO).slice(0, 10);

    const out = await bdl.gamesByDate(date);
    return res.json(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ ok: false, error: msg });
  }
});

// Helpful message instead of a 404 for /all
router.get('/schedule/all', (req, res) => {
  return res
    .status(400)
    .json({ ok: false, error: 'Unsupported sport "all". Use nba, mlb, nhl, nfl, soccer' });
});

module.exports = router;
