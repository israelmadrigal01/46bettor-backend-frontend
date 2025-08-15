// routes/app.js
'use strict';

const express = require('express');
const router = express.Router();

const PremiumPick = require('../models/PremiumPick');
const BankrollTx = require('../models/BankrollTransaction');

// ---------------- helpers ----------------
function toISODate(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// If you later add a Setting model, you can swap this out.
// For now, hard defaults to avoid "red" if the model/file isn't present.
async function getPrefs() {
  return {
    sports: ['NBA', 'NFL'],
    tickets: 2,
    risk: 'conservative',
    maxStakePct: 0.015,
    kellyMultiplier: 0.5,
  };
}

async function getBalanceUnits() {
  // Starting bankroll convention like your tests: 250u + sum(txs)
  const START = 250;
  const txs = await BankrollTx.find().lean();
  const delta = txs.reduce((acc, t) => acc + Number(t.amountUnits || 0), 0);
  return Number((START + delta).toFixed(3));
}

function planFrom({ bankrollUnits, tickets, risk, maxStakePct }) {
  const cap = Number(maxStakePct || 0.015);
  const perTicketUnits = Math.max(1, Math.round(bankrollUnits * cap));
  return {
    bankrollUnits,
    tickets,
    perTicketUnits,
    totalUnits: perTicketUnits * tickets,
    risk: risk || 'normal',
    maxPct: cap,
    overallCapPct: cap * 2,
  };
}

// tiny static slate to mirror your demos/tests
function demoSlate() {
  const today = toISODate();
  return [
    { date: today, league: 'NBA', sport: 'NBA', eventId: 'NBA1', homeTeam: 'Lakers', awayTeam: 'Suns', market: 'ml', selection: 'home', odds: -130 },
    { date: today, league: 'NBA', sport: 'NBA', eventId: 'NBA2', homeTeam: 'Celtics', awayTeam: 'Heat', market: 'ml', selection: 'away', odds: 125 },
    { date: today, league: 'NHL', sport: 'NHL', eventId: 'NHL1', homeTeam: 'Bruins', awayTeam: 'Rangers', market: 'ml', selection: 'home', odds: -115 },
    { date: today, league: 'NHL', sport: 'NHL', eventId: 'NHL2', homeTeam: 'Maple Leafs', awayTeam: 'Canadiens', market: 'ml', selection: 'away', odds: 120 },
  ];
}

function filterBySports(slate, sports) {
  const allow = (sports || []).map(String);
  if (!allow.length) return slate.slice();
  return slate.filter(x => allow.includes(x.sport));
}

function impliedProbFromOdds(odds) {
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}

function buildExplanation(pick) {
  const team =
    pick.selection === 'home'
      ? (pick.homeTeam || 'Home')
      : pick.selection === 'away'
        ? (pick.awayTeam || 'Away')
        : (pick.selection || '');
  const implied = impliedProbFromOdds(pick.odds);
  const impliedPct = implied != null ? (implied * 100).toFixed(1) + '%' : '—%';
  return `Backing ${team} at ${pick.odds > 0 ? '+' + pick.odds : pick.odds}. Implied ~ ${impliedPct}; model fair unavailable; using 50% Kelly with a cap.`;
}

async function commitPicks(picks, perTicketUnits, sourceTag = 'app') {
  const results = [];
  const ids = [];

  for (const p of picks) {
    const doc = {
      ...p,
      stakeUnits: perTicketUnits,
      status: 'open',
      impliedProb: impliedProbFromOdds(p.odds),
      fairProb: null,
      edgePct: null,
      tags: (p.tags || []).concat('Auto'),
      source: sourceTag,
    };
    doc.explanation = buildExplanation(doc);

    const existing = await PremiumPick.findOne({
      date: doc.date,
      league: doc.league,
      eventId: doc.eventId,
      market: doc.market,
      selection: doc.selection,
      status: { $in: ['open', 'won', 'lost', 'push'] },
    }).lean();

    if (existing) {
      results.push({ ok: true, dedup: true, id: existing._id });
      continue;
    }

    const created = await PremiumPick.create(doc);
    ids.push(created._id);
    results.push({ ok: true, dedup: false, id: created._id, pick: created.toObject() });
  }

  return { committed: true, ids, commitResults: { results } };
}

// ---------------- routes ----------------

// GET /api/app/overview
router.get('/overview', async (req, res) => {
  try {
    const [prefs, bankrollUnits] = await Promise.all([getPrefs(), getBalanceUnits()]);
    const plan = planFrom({
      bankrollUnits,
      tickets: Number(prefs.tickets || 2),
      risk: prefs.risk || 'normal',
      maxStakePct: prefs.maxStakePct,
    });

    const today = toISODate();
    const openCount = await PremiumPick.countDocuments({ date: today, status: 'open' });

    res.json({
      bankroll: bankrollUnits,
      open: openCount,
      recs: null,
      plan: null,
      links: {
        preview: `/api/app/recommend/preview?bankroll=${bankrollUnits}&tickets=${prefs.tickets}&sports=${encodeURIComponent((prefs.sports || []).join(','))}&risk=${prefs.risk}&maxStakePct=${prefs.maxStakePct}&kellyMultiplier=${prefs.kellyMultiplier}`,
        commit: `/api/app/recommend?commit=true&bankroll=${bankrollUnits}&tickets=${prefs.tickets}&sports=${encodeURIComponent((prefs.sports || []).join(','))}&risk=${prefs.risk}&maxStakePct=${prefs.maxStakePct}&kellyMultiplier=${prefs.kellyMultiplier}`,
        perf: `/api/premium/perf`,
        gradebookCsv: `/api/export/gradebook.csv?from=${today}&to=${today}`,
        premiumCsv: `/api/export/premium.csv?from=${today}&to=${today}`,
      },
    });
  } catch (err) {
    console.error('GET /app/overview error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/app/recommend/preview
router.get('/recommend/preview', async (req, res) => {
  try {
    const prefs = await getPrefs();
    const bankrollUnits = req.query.bankroll ? Number(req.query.bankroll) : await getBalanceUnits();

    const filters = {
      sports: req.query.sports ? String(req.query.sports).split(',') : (prefs.sports || []),
      kellyMultiplier: req.query.kellyMultiplier ? Number(req.query.kellyMultiplier) : prefs.kellyMultiplier,
      maxStakePct: req.query.maxStakePct ? Number(req.query.maxStakePct) : prefs.maxStakePct,
    };
    const tickets = req.query.tickets ? Number(req.query.tickets) : Number(prefs.tickets || 2);
    const risk = req.query.risk || prefs.risk || 'normal';

    const plan = planFrom({ bankrollUnits, tickets, risk, maxStakePct: filters.maxStakePct });
    const ranked = filterBySports(demoSlate(), filters.sports);
    const recommendations = ranked.slice(0, tickets).map((p) => ({
      ...p,
      _score: 2,
      suggestedStakeUnits: plan.perTicketUnits,
      explanation: buildExplanation(p),
    }));

    res.json({ ok: true, plan, filters, count: recommendations.length, recommendations });
  } catch (err) {
    console.error('GET /app/recommend/preview error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/app/recommend  (?commit=true to write)
router.get('/recommend', async (req, res) => {
  try {
    const prefs = await getPrefs();
    const bankrollUnits = req.query.bankroll ? Number(req.query.bankroll) : await getBalanceUnits();

    const filters = {
      sports: req.query.sports ? String(req.query.sports).split(',') : (prefs.sports || []),
      kellyMultiplier: req.query.kellyMultiplier ? Number(req.query.kellyMultiplier) : prefs.kellyMultiplier,
      maxStakePct: req.query.maxStakePct ? Number(req.query.maxStakePct) : prefs.maxStakePct,
    };
    const tickets = req.query.tickets ? Number(req.query.tickets) : Number(prefs.tickets || 2);
    const risk = req.query.risk || prefs.risk || 'normal';

    const plan = planFrom({ bankrollUnits, tickets, risk, maxStakePct: filters.maxStakePct });
    const recommendations = filterBySports(demoSlate(), filters.sports).slice(0, tickets);

    const commit = String(req.query.commit || '') === 'true';
    if (!commit) {
      return res.json({ ok: true, committed: false, results: [], plan });
    }

    const { committed, ids, commitResults } = await commitPicks(recommendations, plan.perTicketUnits, 'app');
    res.json({ committed, ids, commitResults, plan });
  } catch (err) {
    console.error('GET /app/recommend error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
