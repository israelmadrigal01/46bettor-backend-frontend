// routes/premium-bulk.js
const express = require('express');
const PremiumPick = require('../models/PremiumPick');
const BankrollTransaction = require('../models/BankrollTransaction');
const { profitUnits } = require('../utils/odds');

const router = express.Router();

/**
 * Helper: settle ONE pick (mirrors /premium/settle behavior)
 * outcome: "won" | "lost" | "push"
 * returns { ok, id, pick, tx? }
 */
async function settleOne({ id, outcome, finalScore }) {
  const pick = await PremiumPick.findById(id);
  if (!pick) return { ok: false, id, error: 'Not found' };
  if (pick.status !== 'open') return { ok: false, id, error: `Already settled: ${pick.status}` };

  pick.status = outcome;
  pick.settledAt = new Date();
  if (finalScore) pick.finalScore = finalScore;
  await pick.save();

  let tx = null;
  if (outcome === 'won') {
    const units = profitUnits(Number(pick.stakeUnits || 0), (pick.odds ?? pick.oddsAmerican));
    tx = await BankrollTransaction.create({
      type: 'bet_win',
      amountUnits: units,
      pickId: pick._id,
      note: `Auto from settle(bulk): ${pick.sport} ${pick.market} ${pick.selection} @ ${pick.odds ?? pick.oddsAmerican}`
    });
  }
  // For "lost" or "push", we do not write a tx by design (keeps your bankroll delta = wins + reversals)

  return { ok: true, id: pick._id, pick, tx };
}

/**
 * Helper: delete ONE pick safely
 * - If open: just remove
 * - If won: create a negative "reversal" tx to negate prior credit (if any)
 * - If lost/push: remove, no tx
 */
async function deleteOneSafe(id) {
  const pick = await PremiumPick.findById(id);
  if (!pick) return { ok: false, id, error: 'Not found' };

  let reversal = null;
  if (pick.status === 'won') {
    const units = profitUnits(Number(pick.stakeUnits || 0), (pick.odds ?? pick.oddsAmerican));
    reversal = await BankrollTransaction.create({
      type: 'reversal',
      amountUnits: -Math.abs(units),
      pickId: pick._id,
      note: `Delete reversal for ${pick._id}`
    });
  }
  await PremiumPick.deleteOne({ _id: pick._id });
  return { ok: true, id: pick._id, status: pick.status, reversal };
}

/**
 * GET /api/premium/settle/bulk?list=ID1:won,ID2:lost&finalScore=FT
 * POST /api/premium/settle/bulk  { items: [{id, outcome, finalScore?}], finalScore? }
 */
router.get('/settle/bulk', async (req, res, next) => {
  try {
    const list = String(req.query.list || '').split(',').map(s => s.trim()).filter(Boolean);
    const finalScore = req.query.finalScore || undefined;
    if (!list.length) return res.status(400).json({ ok: false, error: 'Provide ?list=ID:outcome,...' });

    const parsed = list.map(x => {
      const [id, outcome] = x.split(':');
      return { id, outcome, finalScore };
    });

    const out = [];
    for (const item of parsed) out.push(await settleOne(item));
    res.json({ ok: true, settled: out.filter(x => x.ok).length, results: out });
  } catch (e) { next(e); }
});

router.post('/settle/bulk', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const defaultFS = req.body?.finalScore;
    if (!items.length) return res.status(400).json({ ok: false, error: 'Body.items required' });

    const out = [];
    for (const it of items) out.push(await settleOne({ ...it, finalScore: it.finalScore ?? defaultFS }));
    res.json({ ok: true, settled: out.filter(x => x.ok).length, results: out });
  } catch (e) { next(e); }
});

/**
 * GET /api/premium/delete?id=...&dryRun=true|false
 * POST /api/premium/delete { id, dryRun? }
 */
router.get('/delete', async (req, res, next) => {
  try {
    const id = req.query.id;
    const dry = String(req.query.dryRun || 'false').toLowerCase() === 'true';
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });

    if (dry) {
      const pick = await PremiumPick.findById(id).lean();
      if (!pick) return res.json({ ok: false, id, error: 'Not found', dryRun: true });
      const preview = { id, status: pick.status, willCreateReversal: pick.status === 'won' };
      return res.json({ ok: true, dryRun: true, preview });
    }

    const result = await deleteOneSafe(id);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/delete', async (req, res, next) => {
  try {
    const id = req.body?.id;
    const dry = !!req.body?.dryRun;
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });

    if (dry) {
      const pick = await PremiumPick.findById(id).lean();
      if (!pick) return res.json({ ok: false, id, error: 'Not found', dryRun: true });
      const preview = { id, status: pick.status, willCreateReversal: pick.status === 'won' };
      return res.json({ ok: true, dryRun: true, preview });
    }

    const result = await deleteOneSafe(id);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
