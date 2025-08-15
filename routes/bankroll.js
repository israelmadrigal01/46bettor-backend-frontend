// routes/bankroll.js
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * GET /api/bankroll/balance
 * -> { ok, startingUnits, deltaUnits, balanceUnits }
 * startingUnits from env BANKROLL_START (default 250)
 * deltaUnits is SUM(amountUnits) from collection bankroll_transactions
 */
router.get('/balance', async (_req, res) => {
  try {
    const startingUnits = num(process.env.BANKROLL_START, 250);
    const col = mongoose.connection.collection('bankroll_transactions');

    const agg = await col
      .aggregate([{ $group: { _id: null, deltaUnits: { $sum: '$amountUnits' } } }])
      .toArray();

    const deltaUnits = num(agg[0]?.deltaUnits, 0);
    const balanceUnits = startingUnits + deltaUnits;

    res.json({
      ok: true,
      startingUnits,
      deltaUnits: +deltaUnits.toFixed(3),
      balanceUnits: +balanceUnits.toFixed(3),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
