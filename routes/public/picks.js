// routes/public/picks.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PremiumPick = require('../../models/PremiumPick');

router.get('/picks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    const _id = new mongoose.Types.ObjectId(id);
    const doc = await PremiumPick.findOne({ _id }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    const pick = {
      id: doc._id.toString(),
      date: doc.date,
      sport: doc.sport,
      league: doc.league,
      eventId: doc.eventId,
      homeTeam: doc.homeTeam ?? null,
      awayTeam: doc.awayTeam ?? null,
      market: doc.market,
      selection: doc.selection,
      line: doc.line ?? null,
      odds: doc.odds,
      status: doc.status,
      finalScore: doc.finalScore ?? null,
      settledAt: doc.settledAt ?? null,
      tags: doc.tags ?? [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    res.json({ ok: true, pick });
  } catch (e) {
    console.error('[public/picks] error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
