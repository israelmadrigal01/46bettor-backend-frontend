// routes/diag.js
const express = require('express');
const router = express.Router();

// Admin-only gate is applied at /api level in index.js
router.get('/keys', (req, res) => {
  const keys = {
    balldontlie: {
      present: Boolean(process.env.BALLDONTLIE_API_KEY || process.env.BALLDONTLIE_KEY),
      len: (process.env.BALLDONTLIE_API_KEY || process.env.BALLDONTLIE_KEY || '').length,
    },
    oddsApi: {
      present: Boolean(process.env.ODDS_API_KEY),
      len: (process.env.ODDS_API_KEY || '').length,
    },
    footballData: {
      present: Boolean(process.env.FOOTBALL_DATA_API_KEY),
      len: (process.env.FOOTBALL_DATA_API_KEY || '').length,
    },
    mySportsFeeds: {
      present: Boolean(process.env.MYSPORTSFEEDS_API_KEY),
      len: (process.env.MYSPORTSFEEDS_API_KEY || '').length,
    },
  };
  res.json({ ok: true, keys });
});

module.exports = router;
