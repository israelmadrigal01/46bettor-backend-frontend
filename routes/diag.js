// routes/diag.js  (CommonJS, admin-only — mounted at /api/diag)
// This route shows which API keys exist (without exposing values).

const express = require("express");
const router = express.Router();

function lens(val) {
  if (!val) return { present: false, len: 0 };
  return { present: true, len: String(val).length };
}

router.get("/keys", (req, res) => {
  const out = {
    balldontlie: lens(process.env.BALLDONTLIE_API_KEY || process.env.BALLDONTLIE_KEY),
    oddsApi: lens(process.env.ODDS_API_KEY),
    footballData: lens(process.env.FOOTBALL_DATA_API_KEY),
    mySportsFeeds: lens(process.env.MYSPORTSFEEDS_API_KEY),
  };
  res.json({ ok: true, keys: out });
});

module.exports = router;
