// routes/devpanel.js
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const PremiumPick = require('../models/PremiumPick');
const BankrollTransaction = require('../models/BankrollTransaction');
const Setting = require('../models/Setting');

const router = express.Router();

function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex'); }

function pctFromAmerican(odds) {
  if (odds == null) return null;
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}

function titleCase(s) {
  if (!s || typeof s !== 'string') return s;
  return s.split(/[\s_-]+/).map(w => w ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : w).join(' ');
}

function makeExplanation({ selection, odds, fairProb, homeTeam, awayTeam }) {
  // Choose a human label for the selection
  let chosen = selection;
  if (selection === 'home' && homeTeam) chosen = homeTeam;
  if (selection === 'away' && awayTeam) chosen = awayTeam;
  chosen = titleCase(chosen);

  const implied = pctFromAmerican(odds);
  const impliedPct = implied != null ? (implied * 100).toFixed(1) : '—';

  const fairKnown = (typeof fairProb === 'number') && !Number.isNaN(fairProb);
  const fairPct = fairKnown ? (fairProb * 100).toFixed(1) : '—';

  const oddsStr = odds != null ? (Number(odds) >= 0 ? `+${odds}` : `${odds}`) : '—';

  // Only compute edge when both implied and fair are known
  if (fairKnown && implied != null) {
    const edge = (fairProb - implied) * 100;
    const edgeStr = (Math.round(edge * 10) / 10).toString();
    return `Backing ${chosen} at ${oddsStr}. Implied ~ ${impliedPct}% vs fair ~ ${fairPct}% → edge ${edgeStr}%; using 50% Kelly with a cap.`;
  }

  if (implied != null && !fairKnown) {
    return `Backing ${chosen} at ${oddsStr}. Implied ~ ${impliedPct}%; model fair unavailable; using 50% Kelly with a cap.`;
  }

  if (implied == null && fairKnown) {
    return `Backing ${chosen}. Model fair ~ ${fairPct}% (odds unavailable); using 50% Kelly with a cap.`;
  }

  return `Backing ${chosen}. (insufficient pricing data)`;
}

/** Snapshot */
router.get('/', async (req, res, next) => {
  try {
    const counts = {
      premiumPicks: await PremiumPick.countDocuments({}).exec(),
      transactions: await BankrollTransaction.countDocuments({}).exec(),
      settings: await Setting.countDocuments({}).exec(),
    };
    const recentPicks = await PremiumPick.find({}).sort({ createdAt: -1 }).limit(5).lean();
    const recentTx = await BankrollTransaction.find({}).sort({ ts: -1 }).limit(5).lean();

    res.json({
      ok: true,
      ts: new Date().toISOString(),
      counts,
      recent: { picks: recentPicks, transactions: recentTx },
      tips: {
        maintenance: "GET /api/devpanel/maintenance",
        fixExplanations: "GET /api/devpanel/maintenance?fixExplanations=all",
      }
    });
  } catch (e) { next(e); }
});

/**
 * Maintenance Swiss Army Knife
 *
 * Flags:
 *  ?rebuildIndex=1
 *  ?fixExplanations=1            -> fixes obviously broken ones
 *  ?fixExplanations=all or ?forceFix=1 -> rebuild explanations for ALL picks
 */
router.get('/maintenance', async (req, res, next) => {
  try {
    const q = req.query || {};
    const rebuildIndex = String(q.rebuildIndex || '0') === '1';
    const doFixExplanations =
      String(q.fixExplanations || '0') === '1' ||
      String(q.fixExplanations || '').toLowerCase() === 'all' ||
      String(q.forceFix || '0') === '1';
    const forceAll =
      String(q.fixExplanations || '').toLowerCase() === 'all' ||
      String(q.forceFix || '0') === '1';

    let marketToMl = 0;
    let stakeUnitsSetTo1 = 0;
    let stakeUnitsStringsCoerced = 0;
    let oddsCopiedFromAmerican = 0;
    let impliedProbBackfilled = 0;
    let auditHashBackfilled = 0;
    let indexDropped = false;
    let indexCreated = false;
    let fixedExplanations = 0;
    let scanned = 0;

    // 1) normalize market
    const r1 = await PremiumPick.updateMany({ market: 'moneyline' }, { $set: { market: 'ml' } });
    marketToMl = r1.modifiedCount || 0;

    // 2a) stakeUnits missing -> 1
    const r2a = await PremiumPick.updateMany(
      { $or: [{ stakeUnits: { $exists: false } }, { stakeUnits: null }] },
      { $set: { stakeUnits: 1 } }
    );
    stakeUnitsSetTo1 = r2a.modifiedCount || 0;

    // 2b) stakeUnits strings -> number
    const stringy = await PremiumPick.find({ stakeUnits: { $type: 'string' } }).lean();
    for (const d of stringy) {
      const n = Number(d.stakeUnits);
      if (Number.isFinite(n)) {
        await PremiumPick.updateOne({ _id: d._id }, { $set: { stakeUnits: n } });
        stakeUnitsStringsCoerced += 1;
      }
    }

    // 3) odds from oddsAmerican|oddsUS if missing
    const withAltOdds = await PremiumPick.find({
      $and: [
        { $or: [{ odds: { $exists: false } }, { odds: null }] },
        { $or: [{ oddsAmerican: { $exists: true } }, { oddsUS: { $exists: true } }] }
      ]
    }).lean();
    for (const d of withAltOdds) {
      const alt = Number(d.oddsAmerican ?? d.oddsUS);
      if (Number.isFinite(alt)) {
        await PremiumPick.updateOne({ _id: d._id }, { $set: { odds: alt } });
        oddsCopiedFromAmerican += 1;
      }
    }

    // 3b) impliedProb backfill when odds present but impliedProb missing
    const needImplied = await PremiumPick.find({
      $and: [
        { odds: { $ne: null } },
        { $or: [{ impliedProb: { $exists: false } }, { impliedProb: null }] }
      ]
    }).lean();
    for (const d of needImplied) {
      const imp = pctFromAmerican(d.odds);
      if (imp != null) {
        await PremiumPick.updateOne({ _id: d._id }, { $set: { impliedProb: imp } });
        impliedProbBackfilled += 1;
      }
    }

    // 4) auditHash backfill
    const noHash = await PremiumPick.find({ $or: [{ auditHash: { $exists: false } }, { auditHash: null }] }).lean();
    for (const d of noHash) {
      const parts = [
        d.date || '', d.sport || '', d.league || '', d.eventId || '',
        d.homeTeam || '', d.awayTeam || '', d.market || '', d.selection || '',
        (d.odds != null ? String(d.odds) : ''), (d.stakeUnits != null ? String(d.stakeUnits) : '')
      ];
      const src = parts.join('|');
      await PremiumPick.updateOne({ _id: d._id }, { $set: { auditHash: sha1(src) } });
      auditHashBackfilled += 1;
    }

    // 5) optional: rebuild unique index on auditHash
    if (rebuildIndex) {
      const coll = mongoose.connection.db.collection('premium_picks');
      try { await coll.dropIndex('auditHash_1'); indexDropped = true; } catch (_) {}
      await coll.createIndex(
        { auditHash: 1 },
        { unique: true, partialFilterExpression: { auditHash: { $type: 'string' } } }
      );
      indexCreated = true;
    }

    // 6) explanation fixes (NEW: can force ALL)
    if (doFixExplanations) {
      let query;
      if (forceAll) {
        query = {}; // rebuild for everything
      } else {
        // Fix common bad cases:
        //  - missing or null
        //  - "Backing home/away ..." (generic, not team-aware)
        //  - starts "Backing <lowercase...>"
        //  - has "fair ~ —%" which previously led to bogus negative edge text
        query = {
          $or: [
            { explanation: { $exists: false } },
            { explanation: null },
            { explanation: /Backing (home|away) at /i },
            { explanation: /^Backing [a-z]/ },            // lowercase first word
            { explanation: /fair ~ —%/ }                   // unknown fair prob printed
          ]
        };
      }

      const docs = await PremiumPick.find(query).lean();
      scanned = docs.length;

      for (const d of docs) {
        const fair = (typeof d.fairProb === 'number' && !Number.isNaN(d.fairProb))
          ? d.fairProb
          : null; // if unknown, we keep unknown (no edge calc)
        const expl = makeExplanation({
          selection: d.selection,
          odds: d.odds,
          fairProb: fair,
          homeTeam: d.homeTeam,
          awayTeam: d.awayTeam
        });
        await PremiumPick.updateOne({ _id: d._id }, { $set: { explanation: expl } });
        fixedExplanations += 1;
      }
    }

    res.json({
      ok: true,
      changed: {
        marketToMl,
        stakeUnitsSetTo1,
        stakeUnitsStringsCoerced,
        oddsCopiedFromAmerican,
        impliedProbBackfilled,
        auditHashBackfilled,
        indexDropped,
        indexCreated,
        scannedForExplanationFix: scanned,
        fixedExplanations
      }
    });
  } catch (e) { next(e); }
});

module.exports = router;
