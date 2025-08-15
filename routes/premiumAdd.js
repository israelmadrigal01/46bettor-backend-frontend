const express = require('express');
const router = express.Router();
const PremiumPick = require('../models/PremiumPick');

function parseTags(q) {
  if (!q) return [];
  if (Array.isArray(q)) return q;
  return String(q).split(',').map(s => s.trim()).filter(Boolean);
}

router.get('/add', async (req, res) => {
  try {
    const {
      date,
      sport,
      league,
      eventId,
      homeTeam,
      awayTeam,
      market = 'ml',
      selection,
      line = null,
      odds,
      stakeUnits,
      tags
    } = req.query;

    if (!date || !sport || !selection || !odds || !stakeUnits) {
      return res.status(400).json({ ok:false, error:'Missing required fields: date,sport,selection,odds,stakeUnits' });
    }

    const pick = await PremiumPick.create({
      date,
      sport,
      league: league || sport,
      eventId: eventId || null,
      homeTeam: homeTeam || null,
      awayTeam: awayTeam || null,
      market,
      selection,
      line: line === null ? null : Number(line),
      odds: Number(odds),
      stakeUnits: Number(stakeUnits),
      status: 'open',
      tags: parseTags(tags),
      source: 'api-add'
    });

    return res.json({ ok:true, pick, id: pick._id });
  } catch (err) {
    console.error('[premium/add] error:', err);
    return res.status(500).json({ ok:false, error: err.message });
  }
});

module.exports = router;
