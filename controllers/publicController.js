// controllers/publicController.js
const mongoose = require('mongoose');

function normStatus(s) {
  const x = String(s ?? 'open').toLowerCase().trim();
  if (['won','win','w'].includes(x)) return 'won';
  if (['lost','loss','lose','l'].includes(x)) return 'lost';
  if (['push','void','cancel','canceled','cancelled','draw'].includes(x)) return 'push';
  return 'open';
}

function pickModelAuto() {
  const names = mongoose.connection?.modelNames?.() || [];
  const preferred = ['PremiumPick','Pick','Picks','Bet','Wager','Selection'];
  for (const n of preferred) if (names.includes(n)) return mongoose.model(n);
  for (const n of names) {
    const m = mongoose.model(n);
    const paths = Object.keys(m.schema?.paths || {});
    const must = ['odds','selection','market'];
    if (must.every(k => paths.some(p => p.toLowerCase().includes(k)))) return m;
  }
  const candidates = [
    '../models/PremiumPick','../models/premiumPick','../models/premium',
    '../models/Pick','../models/pick','../models/Picks','../models/picks'
  ];
  for (const rel of candidates) {
    try { const mod = require(rel); return mod.default || mod; } catch (_) {}
  }
  throw new Error('No pick-like model found');
}

async function fetchOpenPicks() {
  const M = pickModelAuto();
  const rows = await M.find({}).lean().sort({ createdAt: -1 }).limit(500);
  return rows.filter(p => normStatus(p.status) === 'open');
}

function sanitize(p) {
  return {
    id: String(p._id),
    date: p.date || (p.createdAt ? String(p.createdAt).slice(0,10) : null),
    sport: p.sport || p.league || null,
    league: p.league || null,
    eventId: p.eventId || null,
    homeTeam: p.homeTeam || null,
    awayTeam: p.awayTeam || null,
    market: p.market || null,
    selection: p.selection || null,
    line: p.line ?? null,
    odds: p.odds ?? null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    createdAt: p.createdAt || null,
    updatedAt: p.updatedAt || null,
  };
}

exports.scoreboard = async (_req, res) => {
  try {
    const open = await fetchOpenPicks();
    open.sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0) || String(a.sport).localeCompare(String(b.sport)));
    res.json({ ok: true, count: open.length, picks: open.map(sanitize) });
  } catch (err) {
    console.error('[public:scoreboard]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.recent = async (req, res) => {
  try {
    const M = pickModelAuto();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const rows = await M.find({}).lean().sort({ settledAt: -1, updatedAt: -1 }).limit(600);
    const settled = rows.filter(p => ['won','lost','push'].includes(normStatus(p.status))).slice(0, limit);
    const out = settled.map(p => ({
      id: String(p._id),
      date: p.date || (p.settledAt ? String(p.settledAt).slice(0,10) : (p.createdAt ? String(p.createdAt).slice(0,10) : null)),
      sport: p.sport || p.league || null,
      homeTeam: p.homeTeam || null,
      awayTeam: p.awayTeam || null,
      market: p.market || null,
      selection: p.selection || null,
      line: p.line ?? null,
      odds: p.odds ?? null,
      status: normStatus(p.status),
      finalScore: p.finalScore ?? null,
      settledAt: p.settledAt || null,
      tags: Array.isArray(p.tags) ? p.tags : [],
    }));
    res.json({ ok: true, count: out.length, picks: out });
  } catch (err) {
    console.error('[public:recent]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
