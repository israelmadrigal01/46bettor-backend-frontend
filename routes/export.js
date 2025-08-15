// routes/export.js
const express = require('express');
const PremiumPick = require('../models/PremiumPick');
const BankrollTransaction = require('../models/BankrollTransaction');
const Setting = require('../models/Setting');
const { profitUnits } = require('../utils/odds');

const router = express.Router();

const iso = (d) => (d ? new Date(d).toISOString() : '');
const ymd = (d) => new Date(d).toISOString().slice(0,10);
const csvEsc = (v) => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

function parseRange(req, field = 'createdAt') {
  const { from, to } = req.query;
  const q = {};
  if (from || to) {
    q[field] = {};
    if (from) q[field].$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) q[field].$lte = new Date(`${to}T23:59:59.999Z`);
  }
  return q;
}

/** --------------------------------
 *  ping
 * --------------------------------*/
router.get('/ping', (req, res) => {
  res.json({ ok: true, route: '/api/export/ping', ts: new Date().toISOString() });
});

/** --------------------------------
 *  premium.csv
 *  Columns: id, createdAt, date, sport, league, eventId, homeTeam, awayTeam,
 *           market, selection, line, odds, stakeUnits, status, settledAt,
 *           finalScore, tags, notes, explanation
 * --------------------------------*/
router.get('/premium.csv', async (req, res, next) => {
  try {
    const q = parseRange(req, 'createdAt');
    const rows = await PremiumPick.find(q).sort({ createdAt: 1 }).lean();

    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.write('id,createdAt,date,sport,league,eventId,homeTeam,awayTeam,market,selection,line,odds,stakeUnits,status,settledAt,finalScore,tags,notes,explanation\n');

    for (const p of rows) {
      const odds = (p.odds ?? p.oddsAmerican);
      const tags = Array.isArray(p.tags) ? p.tags.join('|') : '';
      const line = p.line ?? '';
      res.write([
        p._id, iso(p.createdAt), p.date || '', p.sport || '', p.league || '', p.eventId || '',
        csvEsc(p.homeTeam || ''), csvEsc(p.awayTeam || ''), p.market || '', p.selection || '',
        line, odds ?? '', p.stakeUnits ?? '', p.status || '', iso(p.settledAt) || '',
        csvEsc(p.finalScore || ''), csvEsc(tags), csvEsc(p.notes || ''), csvEsc(p.explanation || '')
      ].map(csvEsc).join(',') + '\n');
    }
    res.end();
  } catch (e) { next(e); }
});

/** --------------------------------
 *  bankroll.csv
 *  Columns: id, ts, type, amountUnits, pickId, note, createdAt, updatedAt
 * --------------------------------*/
router.get('/bankroll.csv', async (req, res, next) => {
  try {
    const q = parseRange(req, 'ts');
    const tx = await BankrollTransaction.find(q).sort({ ts: 1 }).lean();

    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.write('id,ts,type,amountUnits,pickId,note,createdAt,updatedAt\n');
    for (const t of tx) {
      res.write([
        t._id, iso(t.ts), t.type, t.amountUnits ?? '', t.pickId || '', csvEsc(t.note || ''), iso(t.createdAt), iso(t.updatedAt)
      ].map(csvEsc).join(',') + '\n');
    }
    res.end();
  } catch (e) { next(e); }
});

/** --------------------------------
 *  gradebook.csv (daily aggregates)
 *  Columns: date,bets,graded,won,lost,push,open,units,risked,winRate,roi
 * --------------------------------*/
router.get('/gradebook.csv', async (req, res, next) => {
  try {
    const q = parseRange(req, 'createdAt');
    const rows = await PremiumPick.find(q).sort({ createdAt: 1 }).lean();

    const dayMap = new Map();
    for (const p of rows) {
      const key = p.date || ymd(p.createdAt);
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key).push(p);
    }

    const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
    const calc = (arr) => {
      let won=0,lost=0,push=0,open=0,units=0,risked=0;
      for (const p of arr) {
        const stake = Number(p.stakeUnits || 0);
        const oddsVal = (p.odds ?? p.oddsAmerican);
        if (p.status !== 'open') risked += stake;
        if (p.status === 'won') units += profitUnits(stake, oddsVal), won++;
        else if (p.status === 'lost') units -= Math.abs(stake), lost++;
        else if (p.status === 'push') push++;
        else open++;
      }
      const graded = won+lost+push;
      const bets = graded+open;
      const winRate = graded ? won/graded : 0;
      const roi = risked ? units/risked : 0;
      return { bets, graded, won, lost, push, open, units: round(units), risked: round(risked), winRate: round(winRate), roi: round(roi) };
    };

    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.write('date,bets,graded,won,lost,push,open,units,risked,winRate,roi\n');
    for (const [dateKey, arr] of Array.from(dayMap.entries()).sort()) {
      const s = calc(arr);
      res.write([dateKey, s.bets, s.graded, s.won, s.lost, s.push, s.open, s.units, s.risked, s.winRate, s.roi].join(',') + '\n');
    }
    res.end();
  } catch (e) { next(e); }
});

/** --------------------------------
 *  equity.csv (equity curve from starting units + transactions)
 *  Columns: ts,balanceUnits,deltaUnits,drawdownUnits,drawdownPct
 *  Optional ?from=&to= filter on tx.ts (inclusive)
 * --------------------------------*/
router.get('/equity.csv', async (req, res, next) => {
  try {
    const startSetting = await Setting.findOne({ key: 'bankroll.startingUnits' }).lean();
    const startingUnits = Number.isFinite(startSetting?.value) ? startSetting.value : 100;

    const q = parseRange(req, 'ts');
    const tx = await BankrollTransaction.find(q).sort({ ts: 1 }).lean();

    let bal = startingUnits;
    let peak = startingUnits;

    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.write('ts,balanceUnits,deltaUnits,drawdownUnits,drawdownPct\n');

    for (const t of tx) {
      const delta = Number(t.amountUnits || 0);
      bal += delta;
      peak = Math.max(peak, bal);
      const ddUnits = bal - peak;
      const ddPct = peak ? (ddUnits / peak) : 0;
      res.write([iso(t.ts), bal.toFixed(3), delta.toFixed(3), ddUnits.toFixed(3), ddPct.toFixed(3)].join(',') + '\n');
    }
    res.end();
  } catch (e) { next(e); }
});

module.exports = router;
