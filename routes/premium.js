const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

// Models
const PremiumPick = require('../models/PremiumPick');
const BankrollTx = require('../models/BankrollTransaction');

// ---------- Helpers ----------
function toISODate(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function moneylineImplied(odds) {
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return null;
  if (o > 0) return 100 / (o + 100);
  return -o / (-o + 100);
}

function pct(n) {
  if (n == null) return '—%';
  return (n * 100).toFixed(1) + '%';
}

function titleCase(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/\b([a-z])/g, m => m.toUpperCase());
}

function buildExplanation(pick) {
  const team =
    pick.selection === 'home'
      ? (pick.homeTeam ? titleCase(pick.homeTeam) : 'Home')
      : pick.selection === 'away'
        ? (pick.awayTeam ? titleCase(pick.awayTeam) : 'Away')
        : titleCase(pick.selection || '');

  const implied = moneylineImplied(pick.odds);
  const fair = pick.fairProb;
  const impliedStr = implied != null ? pct(implied) : '—%';
  const fairStr = fair != null ? pct(fair) : '—%';
  let edgeStr = '—%';
  if (implied != null && fair != null) {
    const edge = (fair - implied) * 100;
    edgeStr = edge.toFixed(1) + '%';
  }
  return `Backing ${team} at ${pick.odds > 0 ? '+' + pick.odds : pick.odds}. Implied ~ ${impliedStr}${fair != null ? ' vs fair ~ ' + fairStr : ''} → edge ${edgeStr}; using 50% Kelly with a cap.`;
}

function computeWinProfitUnits(odds, stakeUnits) {
  const o = Number(odds);
  const s = Number(stakeUnits || 0);
  if (!Number.isFinite(o) || !Number.isFinite(s)) return 0;
  if (o > 0) return s * (o / 100);
  return s * (100 / Math.abs(o));
}

function auditHashFor(p) {
  const src = [
    p.date,
    p.sport,
    p.league,
    p.eventId,
    p.homeTeam,
    p.awayTeam,
    p.market,
    p.selection,
    p.line == null ? '' : String(p.line),
    String(p.odds),
    String(p.stakeUnits || 0)
  ].join('|');
  return crypto.createHash('sha1').update(src).digest('hex');
}

async function findExistingLike(p) {
  return PremiumPick.findOne({
    date: p.date,
    league: p.league,
    eventId: p.eventId,
    market: p.market,
    selection: p.selection,
    status: { $in: ['open', 'won', 'lost', 'push'] }
  }).lean();
}

// ---------- Routes ----------

// GET /api/premium/today
router.get('/today', async (req, res) => {
  try {
    const date = req.query.date || toISODate();
    const picks = await PremiumPick.find({ date }).sort({ createdAt: -1 }).lean();
    res.json({ count: picks.length, picks });
  } catch (err) {
    console.error('GET /premium/today error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET or POST /api/premium/add
router.all('/add', async (req, res) => {
  try {
    const q = req.method === 'GET' ? req.query : req.body || {};
    const date = q.date || toISODate();
    const pick = {
      date,
      sport: q.sport || null,
      league: q.league || q.sport || null,
      eventId: q.eventId || null,
      homeTeam: q.homeTeam || null,
      awayTeam: q.awayTeam || null,
      market: q.market || 'ml',
      selection: q.selection,
      line: q.line == null || q.line === '' ? null : Number(q.line),
      odds: Number(q.odds),
      stakeUnits: Number(q.stakeUnits || 1),
      status: 'open',
      settledAt: null,
      finalScore: null,
      tags: Array.isArray(q.tags)
        ? q.tags
        : (typeof q.tags === 'string' && q.tags.length
            ? q.tags.split(',').map(s => s.trim()).filter(Boolean)
            : []),
      notes: q.notes || '',
      fairProb: q.fairProb != null ? Number(q.fairProb) : null,
      impliedProb: null, // fill below
      edgePct: null,     // fill below
      source: q.source || 'manual-quick',
      suggestTs: null
    };

    pick.impliedProb = moneylineImplied(pick.odds);
    pick.edgePct =
      pick.fairProb != null && pick.impliedProb != null
        ? (pick.fairProb - pick.impliedProb)
        : null;

    pick.explanation = buildExplanation(pick);
    pick.auditHash = auditHashFor(pick);

    const existing = await findExistingLike(pick);
    if (existing) {
      return res.json({ ok: true, dedup: true, pick: existing, id: existing._id });
    }

    const created = await PremiumPick.create(pick);
    res.json({ ok: true, dedup: false, pick: created.toObject(), id: created._id });
  } catch (err) {
    console.error('ADD /premium/add error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/premium/delete?id=...
router.get('/delete', async (req, res) => {
  try {
    const id = req.query.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: 'invalid id' });
    }
    const pick = await PremiumPick.findById(id);
    if (!pick) return res.status(404).json({ ok: false, error: 'not found' });

    let reversal = null;
    if (pick.status === 'won') {
      const amt = -computeWinProfitUnits(pick.odds, pick.stakeUnits);
      reversal = await BankrollTx.create({
        ts: new Date(),
        type: 'reversal',
        amountUnits: amt,
        pickId: pick._id,
        note: `Undo (pre-delete) ${pick._id}`
      });
    }

    await pick.deleteOne();
    res.json({ ok: true, id, status: 200, reversal });
  } catch (err) {
    console.error('GET /premium/delete error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/premium/settle/bulk?list=ID:won,ID2:lost&finalScore=FT
router.get('/settle/bulk', async (req, res) => {
  try {
    const list = String(req.query.list || '').trim();
    if (!list) return res.status(400).json({ ok: false, error: 'missing list' });
    const finalScore = req.query.finalScore || null;

    const parts = list.split(',').map(s => s.trim()).filter(Boolean);
    const results = [];
    let settled = 0;

    for (const part of parts) {
      const [rawId, rawStatus] = part.split(':');
      const id = (rawId || '').trim();
      const status = (rawStatus || '').trim().toLowerCase();

      if (!mongoose.isValidObjectId(id) || !['won','lost','push'].includes(status)) {
        results.push({ ok: false, id, error: 'invalid id or status' });
        continue;
      }

      const pick = await PremiumPick.findById(id);
      if (!pick) {
        results.push({ ok: false, id, error: 'not found' });
        continue;
      }

      pick.status = status;
      pick.settledAt = new Date();
      if (finalScore) pick.finalScore = finalScore;
      await pick.save();

      let tx = null;
      if (status === 'won') {
        tx = await BankrollTx.create({
          ts: new Date(),
          type: 'bet_win',
          amountUnits: computeWinProfitUnits(pick.odds, pick.stakeUnits),
          pickId: pick._id,
          note: `Auto from settle(bulk): ${pick.sport} ${pick.market} ${pick.selection} @ ${pick.odds}`
        });
      }

      results.push({ ok: true, id: pick._id.toString(), pick: pick.toObject(), tx: tx ? tx.toObject() : null });
      settled++;
    }

    res.json({ ok: true, settled, results });
  } catch (err) {
    console.error('GET /premium/settle/bulk error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/premium/undo?id=...
router.get('/undo', async (req, res) => {
  try {
    const id = req.query.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: 'invalid id' });
    }
    const pick = await PremiumPick.findById(id);
    if (!pick) return res.status(404).json({ ok: false, error: 'not found' });

    // If pick was a win, reverse the bankroll win
    let reversal = null;
    if (pick.status === 'won') {
      reversal = await BankrollTx.create({
        ts: new Date(),
        type: 'reversal',
        amountUnits: -computeWinProfitUnits(pick.odds, pick.stakeUnits),
        pickId: pick._id,
        note: `Undo settle reversal for ${pick._id}`
      });
    }

    pick.status = 'open';
    pick.settledAt = null;
    pick.finalScore = null;
    await pick.save();

    res.json({ ok: true, pick: pick.toObject(), reversal, inferred: false });
  } catch (err) {
    console.error('GET /premium/undo error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/premium/perf
router.get('/perf', async (req, res) => {
  try {
    const all = await PremiumPick.find().lean();
    const graded = all.filter(p => ['won','lost','push'].includes(p.status));
    const open = all.filter(p => p.status === 'open');

    const won = graded.filter(p => p.status === 'won');
    const lost = graded.filter(p => p.status === 'lost');
    const push = graded.filter(p => p.status === 'push');

    const sum = (arr, f) => arr.reduce((acc, x) => acc + (f(x) || 0), 0);

    const profitUnits = sum(won, p => computeWinProfitUnits(p.odds, p.stakeUnits));
    const lossUnits = sum(lost, p => p.stakeUnits);
    const units = profitUnits - lossUnits;
    const risked = sum(graded, p => p.stakeUnits);

    const lifetime = {
      bets: all.length,
      graded: graded.length,
      won: won.length,
      lost: lost.length,
      push: push.length,
      open: open.length,
      units: Number(units.toFixed(4)),
      risked: Number(risked.toFixed(0)),
      winRate: graded.length ? Number((won.length / graded.length).toFixed(3)) : 0,
      roi: risked ? Number((units / risked).toFixed(3)) : 0
    };

    res.json({ lifetime });
  } catch (err) {
    console.error('GET /premium/perf error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/premium/gradebook?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/gradebook', async (req, res) => {
  try {
    const from = req.query.from || toISODate();
    const to = req.query.to || from;

    const picks = await PremiumPick.find({
      date: { $gte: from, $lte: to }
    }).lean();

    const byDate = new Map();
    for (const p of picks) {
      if (!byDate.has(p.date)) byDate.set(p.date, []);
      byDate.get(p.date).push(p);
    }

    const days = [];
    const rows = [];
    const sum = (arr, f) => arr.reduce((acc, x) => acc + (f(x) || 0), 0);

    for (const [date, arr] of Array.from(byDate.entries()).sort()) {
      const graded = arr.filter(p => ['won','lost','push'].includes(p.status));
      const won = graded.filter(p => p.status === 'won');
      const lost = graded.filter(p => p.status === 'lost');
      const push = graded.filter(p => p.status === 'push');
      const open = arr.filter(p => p.status === 'open');
      const profitUnits = sum(won, p => computeWinProfitUnits(p.odds, p.stakeUnits));
      const lossUnits = sum(lost, p => p.stakeUnits);
      const units = profitUnits - lossUnits;
      const risked = sum(graded, p => p.stakeUnits);

      days.push({
        bets: arr.length,
        graded: graded.length,
        won: won.length,
        lost: lost.length,
        push: push.length,
        open: open.length,
        date,
        units: Number(units.toFixed(3)),
        risked: Number(risked.toFixed(0)),
        winRate: graded.length ? Number((won.length / graded.length).toFixed(3)) : 0,
        roi: risked ? Number((units / risked).toFixed(3)) : 0
      });

      for (const p of arr) rows.push(p);
    }

    res.json({ days: days.length, rows });
  } catch (err) {
    console.error('GET /premium/gradebook error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
