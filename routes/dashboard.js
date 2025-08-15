// routes/dashboard.js
const express = require('express');
const PremiumPick = require('../models/PremiumPick');
const BankrollTransaction = require('../models/BankrollTransaction');
const Setting = require('../models/Setting');
const { profitUnits } = require('../utils/odds');
const { parseDateOrTodayET } = require('../utils/dates');

const router = express.Router();

// tiny helper to mirror /bankroll/balance
async function getStartingUnits() {
  const candidates = await Setting.find({
    key: { $in: ['bankroll.startingUnits', 'startingUnits', 'bankrollStartingUnits'] }
  }).lean();
  for (const row of candidates) {
    const num = Number(row?.value ?? row?.val ?? row?.number ?? row?.n);
    if (Number.isFinite(num)) return num;
  }
  return 250;
}
const ymdET = (d) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(d);
function* eachDayISO(aIso, bIso) {
  const a = new Date(`${aIso}T00:00:00.000Z`);
  const b = new Date(`${bIso}T00:00:00.000Z`);
  for (let t = a; t <= b; t = new Date(t.getTime() + 86400000)) {
    const y = t.getUTCFullYear();
    const m = String(t.getUTCMonth() + 1).padStart(2, '0');
    const d = String(t.getUTCDate()).padStart(2, '0');
    yield `${y}-${m}-${d}`;
  }
}

// ---- basic landing (kept simple) ----
router.get('/', async (req, res, next) => {
  try {
    const [picks, txs] = await Promise.all([
      PremiumPick.find({}).sort({ createdAt: -1 }).limit(5).lean(),
      BankrollTransaction.find({}).sort({ ts: -1 }).limit(5).lean()
    ]);
    res.json({
      ok: true,
      asOf: new Date().toISOString(),
      tips: {
        bankroll: '/api/dashboard/bankroll',
        series: '/api/dashboard/series?days=60',
        historyCsv: '/api/export/bankroll_history.csv?from=YYYY-MM-DD&to=YYYY-MM-DD'
      },
      recent: { picks, transactions: txs }
    });
  } catch (e) { next(e); }
});

// ---- one-shot bankroll dashboard ----
router.get('/bankroll', async (req, res, next) => {
  try {
    const startingUnits = await getStartingUnits();

    const agg = await BankrollTransaction.aggregate([
      { $group: { _id: null, delta: { $sum: '$amountUnits' } } }
    ]);
    const deltaUnits = agg?.[0]?.delta ? Number(agg[0].delta) : 0;
    const balanceUnits = Number((startingUnits + deltaUnits).toFixed(3));

    const all = await PremiumPick.find({}).lean();
    const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
    const sumPerf = (items) => {
      let won = 0, lost = 0, push = 0, open = 0;
      let units = 0, risked = 0;
      for (const p of items) {
        const stake = Number(p.stakeUnits || 0);
        const oddsVal = (p.odds ?? p.oddsAmerican);
        if (p.status !== 'open') risked += stake;
        if (p.status === 'won') { won++; units += profitUnits(stake, oddsVal); }
        else if (p.status === 'lost') { lost++; units -= Math.abs(stake); }
        else if (p.status === 'push') { push++; }
        else if (p.status === 'open') { open++; }
      }
      const bets = won + lost + push + open;
      const graded = won + lost + push;
      const winRate = graded ? won / graded : 0;
      const roi = risked ? units / risked : 0;
      return { bets, graded, won, lost, push, open, units: round(units), risked: round(risked), winRate: round(winRate), roi: round(roi) };
    };

    const now = new Date();
    const ms7 = now.getTime() - 7*24*3600*1000;
    const ms30 = now.getTime() - 30*24*3600*1000;
    const last7 = all.filter(p => new Date(p.createdAt).getTime() >= ms7);
    const last30 = all.filter(p => new Date(p.createdAt).getTime() >= ms30);
    const bySport = {};
    for (const p of all) (bySport[p.sport || 'UNK'] = bySport[p.sport || 'UNK'] || []).push(p);
    const byMarket = {};
    for (const p of all) (byMarket[p.market || 'UNK'] = byMarket[p.market || 'UNK'] || []).push(p);
    const objMap = (o, f) => Object.fromEntries(Object.entries(o).map(([k,v]) => [k, f(v)]));

    const todayET = parseDateOrTodayET();
    const to = (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) ? req.query.to : todayET;
    const from = (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from))
      ? req.query.from
      : (() => {
          const d = new Date(`${to}T00:00:00.000Z`);
          const d30 = new Date(d.getTime() - 30 * 86400000);
          return ymdET(d30);
        })();

    const inRange = await BankrollTransaction.find({
      ts: { $gte: new Date(`${from}T00:00:00.000Z`), $lte: new Date(`${to}T23:59:59.999Z`) }
    }).sort({ ts: 1 }).lean();
    const preAgg = await BankrollTransaction.aggregate([
      { $match: { ts: { $lt: new Date(`${from}T00:00:00.000Z`) } } },
      { $group: { _id: null, delta: { $sum: '$amountUnits' } } }
    ]);
    const preDelta = preAgg?.[0]?.delta ? Number(preAgg[0].delta) : 0;

    const dayMap = new Map();
    for (const tx of inRange) {
      const key = ymdET(new Date(tx.ts));
      dayMap.set(key, (dayMap.get(key) || 0) + Number(tx.amountUnits || 0));
    }

    const points = [];
    let cumDelta = preDelta;
    for (const day of eachDayISO(from, to)) {
      const dayDelta = Number((dayMap.get(day) || 0).toFixed(3));
      cumDelta = Number((cumDelta + dayDelta).toFixed(3));
      const bal = Number((startingUnits + cumDelta).toFixed(3));
      points.push({ date: day, dayDeltaUnits: dayDelta, cumDeltaUnits: cumDelta, balanceUnits: bal });
    }

    res.json({
      ok: true,
      asOf: new Date().toISOString(),
      balance: { startingUnits, deltaUnits: Number(deltaUnits.toFixed(3)), balanceUnits },
      perf: {
        lifetime: sumPerf(all),
        last7: sumPerf(last7),
        last30: sumPerf(last30),
        bySport: objMap(bySport, sumPerf),
        byMarket: objMap(byMarket, sumPerf)
      },
      history: { from, to, points }
    });
  } catch (e) { next(e); }
});

// ---- chart-ready series: [date, balance] ----
// GET /api/dashboard/series?days=60  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/series', async (req, res, next) => {
  try {
    const startingUnits = await getStartingUnits();
    const todayET = parseDateOrTodayET();

    let from, to;
    if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) {
      from = req.query.from;
      to = (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) ? req.query.to : todayET;
    } else {
      const days = Math.min(365, Math.max(7, Number(req.query.days || 60)));
      const dTo = new Date(`${todayET}T00:00:00.000Z`);
      const dFrom = new Date(dTo.getTime() - (days-1) * 86400000);
      from = ymdET(dFrom);
      to = todayET;
    }

    const inRange = await BankrollTransaction.find({
      ts: { $gte: new Date(`${from}T00:00:00.000Z`), $lte: new Date(`${to}T23:59:59.999Z`) }
    }).lean();

    const preAgg = await BankrollTransaction.aggregate([
      { $match: { ts: { $lt: new Date(`${from}T00:00:00.000Z`) } } },
      { $group: { _id: null, delta: { $sum: '$amountUnits' } } }
    ]);
    let cumDelta = preAgg?.[0]?.delta ? Number(preAgg[0].delta) : 0;

    const dayMap = new Map();
    for (const tx of inRange) {
      const key = ymdET(new Date(tx.ts));
      dayMap.set(key, (dayMap.get(key) || 0) + Number(tx.amountUnits || 0));
    }

    const series = [];
    for (const day of eachDayISO(from, to)) {
      const dayDelta = Number((dayMap.get(day) || 0).toFixed(3));
      cumDelta = Number((cumDelta + dayDelta).toFixed(3));
      const bal = Number((startingUnits + cumDelta).toFixed(3));
      series.push([day, bal]);
    }
    res.json({ ok: true, from, to, seriesLength: series.length, series });
  } catch (e) { next(e); }
});

module.exports = router;
