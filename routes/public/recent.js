// routes/public/recent.js
const express = require('express');
const router = express.Router();

// Try to load your pick model (any of these names)
let PremiumPick = null;
try { PremiumPick = require('../../models/PremiumPick'); } catch {}
try { if (!PremiumPick) PremiumPick = require('../../models/Pick'); } catch {}
try { if (!PremiumPick) PremiumPick = require('../../models/picks'); } catch {}

router.get('/recent', async (_req, res) => {
  try {
    if (!PremiumPick) {
      // No DB model? Return a sane empty shape so the UI stays happy.
      return res.json({ ok: true, count: 0, picks: [] });
    }

    const docs = await PremiumPick
      .find({})
      .sort({ settledAt: -1, createdAt: -1, _id: -1 })
      .limit(50)
      .lean();

    const picks = docs.map(d => ({
      id: String(d._id || d.id || ''),
      date: d.date || d.createdAt || d.settledAt || null,
      sport: d.sport || d.league || null,
      homeTeam: d.homeTeam || d.home || null,
      awayTeam: d.awayTeam || d.away || null,
      market: d.market || d.type || 'ml',
      selection: d.selection || d.pick || d.side || null,
      line: d.line ?? null,
      odds: typeof d.odds === 'number' ? d.odds : (d.price ?? null),
      status: d.status || 'open',
      finalScore: d.finalScore || null,
      settledAt: d.settledAt || null,
      tags: Array.isArray(d.tags) ? d.tags : [],
    }));

    res.json({ ok: true, count: picks.length, picks });
  } catch (err) {
    console.error('[public/recent] error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
