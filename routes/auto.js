// routes/auto.js
const express = require('express');
const mongoose = require('mongoose');
const PremiumPick = require('../models/PremiumPick');
const { impliedProbFromAmerican, suggestUnits } = require('../utils/odds');
const { parseDateOrTodayET } = require('../utils/dates');
const { makeAuditHash } = require('../models/PremiumPick');

const router = express.Router();

function explain(o, fair, implied, kellyMult, maxPct) {
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;
  const sign = o.odds > 0 ? `+${o.odds}` : `${o.odds}`;
  const teamStr = o.selection === 'home' ? (o.homeTeam || 'Home')
    : o.selection === 'away' ? (o.awayTeam || 'Away')
    : (o.selection || 'Selection');
  const edge = fair - implied;
  return `Auto: ${teamStr} ${o.market} @ ${sign}. Implied ${pct(implied)} → fair ${pct(fair)} (edge ${pct(edge)}). Kelly ${Math.round(kellyMult*100)}%, cap ${Math.round(maxPct*100)}%.`;
}

// GET /api/auto/:sport  (supported: nba, nhl)  (?dryRun=true&n=3&bankroll=250)
router.get('/:sport', async (req, res, next) => {
  try {
    const date = parseDateOrTodayET(req.query.date);
    const sportParam = String(req.params.sport || '').toUpperCase(); // NBA or NHL
    const dryRun = String(req.query.dryRun || 'false').toLowerCase() === 'true';
    const n = Math.min(10, Math.max(1, Number(req.query.n || 3)));

    const bankrollUnits = Number(req.query.bankroll || 0) || null;
    const kellyMultiplier = (() => {
      const k = (req.query.kelly !== undefined) ? Number(req.query.kelly) : NaN;
      if (Number.isFinite(k)) return Math.min(1, Math.max(0, k));
      const risk = String(req.query.risk || 'normal').toLowerCase();
      return risk === 'aggressive' ? 1 : risk === 'conservative' ? 0.25 : 0.5;
    })();
    const maxStakePct = Math.min(0.1, Math.max(0.005, Number(req.query.maxPct || 0.02)));
    const roundTo = Math.max(1, Number(req.query.roundTo || 1));

    const col = mongoose.connection.collection('odds');
    const candidates = await col.find({ date, sport: sportParam }).limit(100).toArray();

    // quick heuristic: take higher edges first
    const scored = candidates
      .map(o => {
        const odds = typeof o.odds === 'number' ? o.odds : o.oddsAmerican;
        const implied = impliedProbFromAmerican(odds) ?? 0;
        let fair = implied;
        if (odds >= +100 && odds <= +200) fair = Math.min(0.99, implied + 0.03);
        else if (odds <= -110 && odds >= -150) fair = Math.min(0.99, implied + 0.015);
        const edge = fair - implied;
        return { ...o, odds, implied, fair, edge };
      })
      .sort((a,b) => b.edge - a.edge)
      .slice(0, n);

    if (dryRun) {
      return res.json({
        ok: true, dryRun: true, date, sport: sportParam,
        previewCount: scored.length,
        preview: scored.map(o => ({
          _id: o._id, date: o.date, eventId: o.eventId, awayTeam: o.awayTeam, homeTeam: o.homeTeam,
          league: o.league, market: o.market, selection: o.selection, odds: o.odds, sport: o.sport,
          impliedProb: o.implied, fairProb: o.fair, edgePct: o.edge,
          explanation: explain(o, o.fair, o.implied, kellyMultiplier, maxStakePct)
        }))
      });
    }

    const created = [];
    for (const o of scored) {
      const doc = {
        date,
        sport: o.sport, league: o.league, eventId: o.eventId,
        homeTeam: o.homeTeam, awayTeam: o.awayTeam,
        market: o.market, selection: o.selection,
        odds: o.odds,
        stakeUnits: bankrollUnits ? suggestUnits({
          bankrollUnits, fairProb: o.fair, americanOdds: o.odds,
          kellyMultiplier, maxStakePct, minUnits: 1, roundTo
        }) : 1,
        status: 'open',
        source: 'auto',
        suggestTs: new Date(),
        fairProb: o.fair,
        impliedProb: o.implied,
        edgePct: o.edge,
        explanation: explain(o, o.fair, o.implied, kellyMultiplier, maxStakePct)
      };
      doc.auditHash = makeAuditHash(doc);

      try {
        const row = await PremiumPick.create(doc);
        created.push({ ok: true, id: row._id, pick: row, dedup: false });
      } catch (err) {
        if (err && err.code === 11000) {
          const existing = await PremiumPick.findOne({ auditHash: doc.auditHash }).lean();
          if (existing) created.push({ ok: true, id: existing._id, pick: existing, dedup: true });
        } else {
          created.push({ ok: false, error: err.message, candidate: o });
        }
      }
    }

    res.json({ ok: true, dryRun: false, date, sport: sportParam, inserted: created.filter(x => x.ok && !x.dedup).length, results: created });
  } catch (e) { next(e); }
});

module.exports = router;
