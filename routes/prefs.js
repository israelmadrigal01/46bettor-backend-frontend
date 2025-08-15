// routes/prefs.js
const express = require('express');
const Setting = require('../models/Setting');

const router = express.Router();

const DEFAULT_PREFS = {
  sports: ['NBA','NFL','NHL','MLB'],
  kellyMultiplier: 0.5,   // 50% Kelly
  maxStakePct: 0.02,      // 2% cap per ticket
  tickets: 3,             // default number of tickets per session/day
  risk: 'normal'          // 'conservative' | 'normal' | 'aggressive'
};

const KEY = 'user.prefs';

async function readPrefs() {
  const doc = await Setting.findOne({ key: KEY }).lean();
  if (!doc || typeof doc.value !== 'object') return DEFAULT_PREFS;
  return { ...DEFAULT_PREFS, ...doc.value };
}

/**
 * GET /api/prefs
 * Returns merged prefs (stored overrides layered on defaults)
 */
router.get('/', async (req, res, next) => {
  try {
    const prefs = await readPrefs();
    res.json({ ok: true, prefs, defaults: DEFAULT_PREFS });
  } catch (e) { next(e); }
});

/**
 * POST /api/prefs
 * Body: any subset of { sports, kellyMultiplier, maxStakePct, tickets, risk }
 * Performs a shallow merge.
 */
router.post('/', async (req, res, next) => {
  try {
    const incoming = req.body || {};
    const current = await readPrefs();
    const merged = { ...current };

    if (incoming.sports) merged.sports = String(incoming.sports).split(',').map(s => s.trim()).filter(Boolean);
    if (typeof incoming.kellyMultiplier === 'number') merged.kellyMultiplier = incoming.kellyMultiplier;
    if (typeof incoming.maxStakePct === 'number') merged.maxStakePct = incoming.maxStakePct;
    if (typeof incoming.tickets === 'number') merged.tickets = Math.max(1, Math.floor(incoming.tickets));
    if (incoming.risk) merged.risk = String(incoming.risk);

    await Setting.findOneAndUpdate(
      { key: KEY },
      { $set: { key: KEY, value: merged } },
      { upsert: true, new: true }
    );

    res.json({ ok: true, prefs: merged });
  } catch (e) { next(e); }
});

/**
 * DELETE /api/prefs  → reset to defaults
 */
router.delete('/', async (req, res, next) => {
  try {
    await Setting.deleteOne({ key: KEY });
    res.json({ ok: true, reset: true, prefs: DEFAULT_PREFS });
  } catch (e) { next(e); }
});

module.exports = router;
