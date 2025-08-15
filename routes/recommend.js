// routes/recommend.js
const express = require('express');
const crypto = require('crypto');
const PremiumPick = require('../models/PremiumPick');
const BankrollTransaction = require('../models/BankrollTransaction');
const Setting = require('../models/Setting');

// === helpers ================================================================
function pctFromAmerican(odds) {
  if (odds == null) return null;
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}
function kellyStakeUnits({ bankrollUnits, fairProb, odds, kellyMultiplier = 0.5, maxStakePct = 0.02 }) {
  const b = odds > 0 ? odds / 100 : 100 / Math.abs(odds);
  const p = fairProb;
  const q = 1 - p;
  const f = ((b * p - q) / b);
  const rawUnits = Math.max(0, f * bankrollUnits * kellyMultiplier);
  const capUnits = bankrollUnits * maxStakePct;
  return Math.max(0, Math.min(rawUnits, capUnits));
}
function roundUnits(u) { return Math.max(0, Math.round(u)); }

function makeExplanation({ selection, odds, fairProb, homeTeam, awayTeam }) {
  const chosen =
    selection === 'home' ? (homeTeam || 'home') :
    selection === 'away' ? (awayTeam || 'away') :
    selection;
  const implied = pctFromAmerican(odds);
  const edge = (fairProb ?? 0) - (implied ?? 0);
  const impliedPct = implied != null ? (implied * 100).toFixed(1) : '—';
  const fairPct = (fairProb * 100).toFixed(1);
  const edgePct = (edge * 100).toFixed(1);
  return `Backing ${chosen} at ${odds >= 0 ? '+'+odds : odds}. Implied ~ ${impliedPct}% vs fair ~ ${fairPct}% → edge ${edgePct}%; using 50% Kelly with a cap.`;
}

async function getStartingUnits() {
  const s = await Setting.findOne({ key: 'bankroll.startingUnits' }).lean();
  const n = Number(s?.value ?? 100);
  return Number.isFinite(n) ? n : 100;
}
async function getCurrentBalanceUnits() {
  const start = await getStartingUnits();
  const agg = await BankrollTransaction.aggregate([{ $group: { _id: null, total: { $sum: '$amountUnits' } } }]);
  const delta = agg?.[0]?.total ?? 0;
  return start + delta;
}
async function readPrefs() {
  const doc = await Setting.findOne({ key: 'user.prefs' }).lean();
  if (!doc || typeof doc.value !== 'object') {
    return { sports: ['NBA','NFL','NHL','MLB'], kellyMultiplier: 0.5, maxStakePct: 0.02, tickets: 3, risk: 'normal' };
  }
  const v = doc.value;
  return {
    sports: Array.isArray(v.sports) ? v.sports : ['NBA','NFL','NHL','MLB'],
    kellyMultiplier: typeof v.kellyMultiplier === 'number' ? v.kellyMultiplier : 0.5,
    maxStakePct: typeof v.maxStakePct === 'number' ? v.maxStakePct : 0.02,
    tickets: Number.isFinite(v.tickets) ? v.tickets : 3,
    risk: v.risk || 'normal'
  };
}
function planFromParams({ bankroll, tickets, maxPct, risk, prefs }) {
  const p = {
    sports: prefs?.sports ?? ['NBA','NFL','NHL','MLB'],
    kellyMultiplier: typeof prefs?.kellyMultiplier === 'number' ? prefs.kellyMultiplier : 0.5,
    maxStakePct: typeof maxPct === 'number' ? maxPct : (typeof prefs?.maxStakePct === 'number' ? prefs.maxStakePct : 0.02),
    tickets: Number.isFinite(tickets) ? Math.max(1, Math.floor(tickets)) : (Number.isFinite(prefs?.tickets) ? prefs.tickets : 3),
    risk: risk || prefs?.risk || 'normal'
  };
  const perTicketUnits = roundUnits((bankroll * p.maxStakePct) || 0);
  const totalUnits = perTicketUnits * p.tickets;
  return { bankrollUnits: bankroll, tickets: p.tickets, perTicketUnits, totalUnits, risk: p.risk, maxPct: p.maxStakePct, overallCapPct: Math.min(0.04, p.maxStakePct * 2) };
}
function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex'); }

function candidateBoard(dateISO) {
  return [
    { sport: 'NBA', league: 'NBA', eventId: 'NBA1', homeTeam: 'Lakers',      awayTeam: 'Suns',       market: 'ml', selection: 'home', odds: -130, fairProb: 0.58 },
    { sport: 'NBA', league: 'NBA', eventId: 'NBA2', homeTeam: 'Celtics',     awayTeam: 'Heat',       market: 'ml', selection: 'away', odds:  125, fairProb: 0.47444444444444445 },
    { sport: 'NHL', league: 'NHL', eventId: 'NHL1', homeTeam: 'Bruins',      awayTeam: 'Rangers',    market: 'ml', selection: 'home', odds: -115, fairProb: 0.535 },
    { sport: 'NHL', league: 'NHL', eventId: 'NHL2', homeTeam: 'Maple Leafs', awayTeam:'Canadiens',   market:'ml',  selection:'away', odds: 120, fairProb: 0.455 }
  ].map(x => ({ ...x, date: dateISO }));
}
function todayISO() { return new Date().toISOString().slice(0,10); }

function toRec(c, { bankrollUnits, perTicketUnits, kellyMultiplier, maxStakePct }) {
  const implied = pctFromAmerican(c.odds);
  const edge = (c.fairProb ?? 0) - (implied ?? 0);
  if (edge <= 0) return null;
  const kUnits = kellyStakeUnits({ bankrollUnits, fairProb: c.fairProb, odds: c.odds, kellyMultiplier, maxStakePct });
  const finalStakeUnits = Math.max(1, roundUnits(Math.min(kUnits, perTicketUnits)));
  const explanation = makeExplanation({ selection: c.selection, odds: c.odds, fairProb: c.fairProb, homeTeam: c.homeTeam, awayTeam: c.awayTeam });
  return { ...c, impliedProb: implied, edgePct: edge, finalStakeUnits, explanation };
}

async function commitRecs(recs) {
  const results = [];
  for (const r of recs) {
    const src = `${r.date}|${r.sport}|${r.league}|${r.eventId}|${r.homeTeam}|${r.awayTeam}|${r.market}|${r.selection}|${r.odds}|${r.finalStakeUnits}`;
    const auditHash = sha1(src);

    const exists = await PremiumPick.findOne({ auditHash }).lean();
    if (exists) { results.push({ id: exists._id, ok: true, dedup: true }); continue; }

    const doc = await PremiumPick.create({
      date: r.date,
      sport: r.sport,
      league: r.league,
      eventId: r.eventId,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      market: r.market,
      selection: r.selection,
      odds: r.odds,
      stakeUnits: r.finalStakeUnits,
      status: 'open',
      tags: ['Auto', 'Recommend'],
      notes: 'Auto-generated from /api/app/recommend',
      fairProb: r.fairProb,
      impliedProb: r.impliedProb,
      edgePct: r.edgePct,
      explanation: r.explanation,
      source: 'recommend',
      suggestTs: new Date(),
      auditHash
    });
    results.push({ id: doc._id, ok: true, dedup: false });
  }
  return results;
}

// === router ================================================================
const router = express.Router();

/**
 * GET /api/app/recommend/preview
 * Optional: bankroll, tickets, sports, maxPct, risk, usePrefs=true|false
 * If missing, pulls from saved /api/prefs and current bankroll.
 */
router.get('/preview', async (req, res, next) => {
  try {
    const prefs = await readPrefs();
    const usePrefs = String(req.query.usePrefs || 'true').toLowerCase() === 'true';

    let bankroll = Number(req.query.bankroll);
    if (!Number.isFinite(bankroll)) bankroll = await getCurrentBalanceUnits();

    const sports = req.query.sports ? String(req.query.sports).split(',').map(s => s.trim()).filter(Boolean)
                  : (usePrefs ? prefs.sports : ['NBA','NFL','NHL','MLB']);
    const tickets = Number.isFinite(Number(req.query.tickets)) ? Number(req.query.tickets)
                  : (usePrefs ? prefs.tickets : 3);
    const maxPct = Number.isFinite(Number(req.query.maxPct)) ? Number(req.query.maxPct)
                  : (usePrefs ? prefs.maxStakePct : 0.02);
    const risk = req.query.risk || (usePrefs ? prefs.risk : 'normal');

    const plan = planFromParams({ bankroll, tickets, maxPct, risk, prefs });
    const board = candidateBoard(todayISO()).filter(c => sports.includes(c.sport));
    const recsRaw = board.map(c => toRec(c, {
      bankrollUnits: plan.bankrollUnits,
      perTicketUnits: plan.perTicketUnits,
      kellyMultiplier: prefs.kellyMultiplier,
      maxStakePct: plan.maxPct
    })).filter(Boolean).slice(0, plan.tickets);

    res.json({
      ok: true,
      plan: { ...plan, risk, maxPct },
      filters: { sports, kellyMultiplier: prefs.kellyMultiplier, maxStakePct: plan.maxPct },
      count: recsRaw.length,
      recommendations: recsRaw
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/app/recommend
 * Same params as preview + &commit=true to write picks.
 * Response now returns { commitResults: { results: [...] } } to match your jq.
 */
router.get('/', async (req, res, next) => {
  try {
    const commit = String(req.query.commit || 'false').toLowerCase() === 'true';

    // Reuse preview logic to assemble recs
    const fakeReq = { query: { ...req.query, usePrefs: req.query.usePrefs ?? 'true' } };
    const preview = await new Promise((resolve, reject) => {
      router.handle({ ...fakeReq, method: 'GET', url: '/preview' }, { json: resolve }, reject);
    });

    if (!commit) return res.json(preview);

    const results = await commitRecs(preview.recommendations);
    res.json({ committed: true, commitResults: { results }, plan: preview.plan });
  } catch (e) { next(e); }
});

module.exports = router;
