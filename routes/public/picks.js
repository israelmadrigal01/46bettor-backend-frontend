const express = require('express');
const router = express.Router();
const PremiumPick = require('../../models/PremiumPick'); // adjust if your model path differs

// GET /api/public/picks/:id
router.get('/picks/:id', async (req, res) => {
  try {
    const doc = await PremiumPick.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    const {
      _id, date, sport, league, eventId, homeTeam, awayTeam,
      market, selection, line, odds, status, finalScore, settledAt,
      tags, createdAt, updatedAt
    } = doc;

    res.json({
      ok: true,
      pick: {
        id: _id.toString(),
        date, sport, league, eventId, homeTeam, awayTeam,
        market, selection, line, odds, status, finalScore, settledAt,
        tags, createdAt, updatedAt
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'server_error', detail: String(e) });
  }
});

module.exports = router;
