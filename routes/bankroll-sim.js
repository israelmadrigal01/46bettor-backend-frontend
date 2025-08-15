/* eslint-disable */ // @ts-nocheck
'use strict';

const express = require('express');
const router = express.Router();

// Try to use your existing bankroll engine if available
let engine;
try {
  engine = require('../services/bankroll/engine'); // expect engine.recommend({bankroll, oddsAmerican, fairProb, ...})
} catch (_) {
  engine = null;
}

/**
 * POST /api/bankroll/sim
 * Body:
 * {
 *   "startingBankroll": 2000,
 *   "strategy": "fractional",           // or "kelly"
 *   "kellyFraction": 0.5,               // only for kelly/fractional logic
 *   "maxStakePct": 0.02,
 *   "minStake": 0,
 *   "roundTo": 1,
 *   "bets": [
 *     { "oddsAmerican": -110, "fairProb": 0.55, "outcome": "win" },
 *     { "oddsAmerican": -120, "fairProb": 0.53, "outcome": "lose" },
 *     ...
 *   ]
 * }
 *
 * Returns bankroll timeline + per-bet stakes and pnl.
 */
router.post('/bankroll/sim', express.json(), async (req, res) => {
  try {
    const {
      startingBankroll,
      strategy = 'fractional',
      kellyFraction = 0.5,
      maxStakePct = 0.02,
      minStake = 0,
      roundTo = 1,
      bets = []
    } = req.body || {};

    if (typeof startingBankroll !== 'number' || startingBankroll <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid startingBankroll' });
    }
    if (!Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ ok: false, error: 'Provide non-empty bets[]' });
    }

    const edgeStake = (bankroll, oddsAmerican, fairProb) => {
      if (engine && typeof engine.recommend === 'function') {
        // Trust your engine
        const r = engine.recommend({
          bankroll,
          oddsAmerican,
          fairProb,
          strategy,
          kellyFraction,
          maxStakePct,
          minStake,
          roundTo
        });
        return r.stake ?? 0;
      }
      // Fallback lightweight calc (fractional Kelly with caps)
      const implied = oddsAmerican > 0 ? (100 / (oddsAmerican + 100)) : (Math.abs(oddsAmerican) / (Math.abs(oddsAmerican) + 100));
      const b = oddsAmerican > 0 ? (oddsAmerican / 100) : (100 / Math.abs(oddsAmerican));
      const edge = fairProb - implied;
      const kelly = Math.max(0, (b * fairProb - (1 - fairProb)) / b); // full Kelly fraction
      const raw = (strategy === 'kelly' || strategy === 'fractional')
        ? bankroll * (kelly * kellyFraction)
        : bankroll * maxStakePct;
      const capped = Math.min(raw, bankroll * maxStakePct);
      const st = Math.max(minStake, Math.round((roundTo > 0 ? Math.round(capped / roundTo) * roundTo : capped)));
      return st;
    };

    const payout = (oddsAmerican, stake, outcome) => {
      if (outcome === 'push' || outcome === 'void') return 0;
      if (outcome !== 'win' && outcome !== 'lose') return 0;
      const dec = oddsAmerican > 0 ? (oddsAmerican / 100) : (100 / Math.abs(oddsAmerican));
      return outcome === 'win' ? +(stake * dec).toFixed(2) : +(-stake).toFixed(2);
    };

    const steps = [];
    let bank = +startingBankroll;

    for (let i = 0; i < bets.length; i++) {
      const { oddsAmerican, fairProb, outcome = 'pending' } = bets[i] || {};
      const stake = edgeStake(bank, +oddsAmerican, +fairProb);
      const pnl = payout(+oddsAmerican, stake, outcome);
      const before = bank;
      const after = +(bank + pnl).toFixed(2);

      steps.push({
        n: i + 1,
        oddsAmerican,
        fairProb,
        outcome,
        stake,
        pnl,
        bankrollBefore: before,
        bankrollAfter: after
      });

      bank = after;
    }

    const summary = {
      startingBankroll,
      endingBankroll: bank,
      pnl: +(bank - startingBankroll).toFixed(2),
      roiPct: steps.length ? +(((bank - startingBankroll) / startingBankroll) * 100).toFixed(2) : 0,
      count: steps.length
    };

    return res.json({ ok: true, strategy, params: { kellyFraction, maxStakePct, minStake, roundTo }, summary, steps });
  } catch (err) {
    console.error('[bankroll/sim] error:', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

module.exports = router;
