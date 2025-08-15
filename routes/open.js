// routes/open.js
const express = require('express');
const PremiumPick = require('../models/PremiumPick');
const { parseDateOrTodayET } = require('../utils/dates');

const router = express.Router();

/**
 * GET /api/open
 *   - all open premium picks
 *   - optional ?date=YYYY-MM-DD to filter by pick.date
 *   - optional ?sport=NBA,NFL
 */
router.get('/', async (req, res, next) => {
  try {
    const q = { status: 'open' };
    if (req.query.date) q.date = parseDateOrTodayET(req.query.date);
    if (req.query.sport) {
      q.sport = { $in: String(req.query.sport).split(',').map(s => s.trim()).filter(Boolean) };
    }
    const picks = await PremiumPick.find(q).sort({ createdAt: -1 }).lean();
    res.json({
      ok: true,
      count: picks.length,
      picks: picks.map(p => ({
        _id: p._id,
        date: p.date,
        sport: p.sport,
        league: p.league,
        eventId: p.eventId,
        homeTeam: p.homeTeam,
        awayTeam: p.awayTeam,
        market: p.market,
        selection: p.selection,
        odds: (p.odds ?? p.oddsAmerican),
        stakeUnits: p.stakeUnits,
        explanation: p.explanation,
        createdAt: p.createdAt
      }))
    });
  } catch (e) { next(e); }
});

module.exports = router;
