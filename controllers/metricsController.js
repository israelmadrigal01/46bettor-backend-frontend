// controllers/metricsController.js
const mongoose = require('mongoose');

// ==== Date & Status helpers =================================================
function toISODateStringLocal(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear(), m = dt.getMonth(), day = dt.getDate();
  const localMidnight = new Date(y, m, day, 0, 0, 0, 0);
  return localMidnight.toISOString().slice(0, 10);
}
function pickDate(p) {
  if (p.date) return String(p.date).slice(0, 10);
  if (p.settledAt) return toISODateStringLocal(p.settledAt);
  if (p.createdAt) return toISODateStringLocal(p.createdAt);
  return toISODateStringLocal(new Date());
}
function normStatus(s) {
  const x = String(s ?? 'open').toLowerCase().trim();
  if (['won','win','w'].includes(x)) return 'won';
  if (['lost','loss','lose','l'].includes(x)) return 'lost';
  if (['push','void','cancel','canceled','cancelled','draw'].includes(x)) return 'push';
  if (['open','pending','unsettled'].includes(x)) return 'open';
  return 'open';
}

// ==== Odds / PnL ============================================================
function profitUnits(odds, stakeUnits = 1) {
  if (odds == null) return 0;
  return odds > 0 ? (odds / 100) * stakeUnits : (100 / Math.abs(odds)) * stakeUnits;
}
function resultPnLUnits({ status, odds, stakeUnits = 1 }) {
  const s = normStatus(status);
  if (s === 'won')  return profitUnits(odds, stakeUnits);
  if (s === 'lost') return -1 * stakeUnits;
  return 0; // push/open
}
function envBankrollStart() {
  const raw = process.env.BANKROLL_START;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 250;
}
function parseRange(req) {
  const from = req.query.from ? new Date(req.query.from) : null;
  const to   = req.query.to   ? new Date(req.query.to)   : null;
  const range = {};
  if (from || to) {
    range.$and = [];
    const strRange = {};
    if (from) strRange.$gte = toISODateStringLocal(from);
    if (to)   strRange.$lte = toISODateStringLocal(to);
    range.$and.push({ $or: [
      { date: strRange },
      { createdAt: { ...(from && {$gte: from}), ...(to && {$lte: to}) } },
      { settledAt: { ...(from && {$gte: from}), ...(to && {$lte: to}) } },
    ]});
  }
  return range;
}

// ==== Model auto-detect (works with PremiumPick, Pick, etc.) ===============
function pickModelAuto() {
  const names = mongoose.connection?.modelNames?.() || [];
  const preferred = ['PremiumPick','Pick','Picks','Premium','Bet','Wager','Selection'];
  for (const n of preferred) if (names.includes(n)) return mongoose.model(n);

  const hasPickishShape = (schema) => {
    const paths = Object.keys(schema?.paths || {});
    const must = ['odds','selection','market'];
    return must.every(k => paths.some(p => p.toLowerCase().includes(k)));
  };
  for (const n of names) {
    const m = mongoose.model(n);
    if (hasPickishShape(m.schema)) return m;
  }
  const candidates = [
    '../models/PremiumPick','../models/premiumPick','../models/premium',
    '../models/Pick','../models/pick','../models/Picks','../models/picks'
  ];
  for (const rel of candidates) {
    try { const m = require(rel); return m.default || m; } catch (_) {}
  }
  throw new Error('Could not locate a pick-like model.');
}
function getPickModels() {
  const models = [];
  try { models.push(pickModelAuto()); } catch (_) {}
  for (const n of ['PremiumPick','Picks','Pick']) {
    try { if (mongoose.connection.modelNames().includes(n)) models.push(mongoose.model(n)); } catch (_) {}
  }
  const seen = new Set();
  return models.filter(m => !seen.has(m.modelName) && seen.add(m.modelName));
}

// ==== Fetch & transforms ====================================================
async function fetchAllPicks(rangeQuery) {
  const models = getPickModels();
  if (!models.length) throw new Error('No pick models found.');
  const results = await Promise.allSettled(models.map(m => m.find(rangeQuery).lean()));
  const rows = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      rows.push(...r.value.map(d => ({ ...d, __sourceModel: models[idx].modelName })));
    }
  });
  return rows;
}
function summarize(picks) {
  let won = 0, lost = 0, push = 0, open = 0;
  let riskedUnits = 0, netUnits = 0;
  for (const p of picks) {
    const stakeUnits = Number(p.stakeUnits ?? 1);
    const odds = Number(p.odds ?? 0);
    const s = normStatus(p.status);
    if (['won','lost','push'].includes(s)) {
      riskedUnits += (s === 'lost' || s === 'won' || s === 'push') ? stakeUnits : 0;
      netUnits += resultPnLUnits({ status: s, odds, stakeUnits });
    }
    if (s === 'won') won++;
    else if (s === 'lost') lost++;
    else if (s === 'push') push++;
    else open++;
  }
  const roiPct = riskedUnits > 0 ? (netUnits / riskedUnits) * 100 : 0;
  return { won, lost, push, open, riskedUnits, netUnits, roiPct };
}
function ledgerByDay(picks) {
  const daily = new Map(); // date => pnlUnits
  for (const p of picks) {
    const s = normStatus(p.status);
    if (!['won','lost','push'].includes(s)) continue;
    const d = pickDate(p);
    const stakeUnits = Number(p.stakeUnits ?? 1);
    const odds = Number(p.odds ?? 0);
    const pnl = resultPnLUnits({ status: s, odds, stakeUnits });
    daily.set(d, (daily.get(d) || 0) + pnl);
  }
  return Array.from(daily.entries())
    .map(([date, pnlUnits]) => ({ date, pnlUnits }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function toCSV(rows) {
  const head = 'date,sport,league,homeTeam,awayTeam,market,selection,line,odds,stakeUnits,status,finalScore,impliedProb,tags,notes';
  if (!rows?.length) return `${head}\n`;
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = rows.map(p => [
    p.date ?? '', p.sport ?? '', p.league ?? '', p.homeTeam ?? '', p.awayTeam ?? '',
    p.market ?? '', p.selection ?? '', p.line ?? '', p.odds ?? '',
    p.stakeUnits ?? '', p.status ?? '', p.finalScore ?? '',
    p.impliedProb ?? '', Array.isArray(p.tags) ? p.tags.join('|') : (p.tags ?? ''), p.notes ?? ''
  ].map(escape).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

// ==== New analytics: group-by & streaks =====================================
function groupAgg(picks, field) {
  const agg = new Map(); // key -> { won,lost,push,open,riskedUnits,netUnits,roiPct }
  const add = (key, p) => {
    if (!key && key !== 0) return;
    const s = normStatus(p.status);
    const entry = agg.get(key) || { key, won:0,lost:0,push:0,open:0, riskedUnits:0, netUnits:0 };
    const stakeUnits = Number(p.stakeUnits ?? 1);
    const odds = Number(p.odds ?? 0);
    if (['won','lost','push'].includes(s)) {
      entry.riskedUnits += (s === 'lost' || s === 'won' || s === 'push') ? stakeUnits : 0;
      entry.netUnits += resultPnLUnits({ status: s, odds, stakeUnits });
    }
    if (s === 'won') entry.won++; else if (s === 'lost') entry.lost++; else if (s === 'push') entry.push++; else entry.open++;
    agg.set(key, entry);
  };

  for (const p of picks) {
    if (field === 'tags') {
      const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []);
      if (!tags.length) add('(none)', p);
      else tags.forEach(t => add(String(t), p));
    } else {
      add(String(p[field] ?? '(none)'), p);
    }
  }

  const rows = Array.from(agg.values()).map(r => ({
    key: r.key,
    won: r.won, lost: r.lost, push: r.push, open: r.open,
    riskedUnits: r.riskedUnits,
    netUnits: r.netUnits,
    roiPct: r.riskedUnits > 0 ? (r.netUnits / r.riskedUnits) * 100 : 0
  }));
  rows.sort((a,b) => b.netUnits - a.netUnits);
  return rows;
}

function computeStreaks(picks) {
  const settled = picks
    .filter(p => ['won','lost','push'].includes(normStatus(p.status)))
    .sort((a,b) => new Date(a.settledAt || a.createdAt || 0) - new Date(b.settledAt || b.createdAt || 0));

  let bestWin = 0, bestLoss = 0;
  let curType = null, curLen = 0;

  for (const p of settled) {
    const s = normStatus(p.status);
    if (s === 'won' || s === 'lost') {
      if (curType === s) curLen += 1; else { curType = s; curLen = 1; }
      if (s === 'won')  bestWin  = Math.max(bestWin, curLen);
      if (s === 'lost') bestLoss = Math.max(bestLoss, curLen);
    } else { curType = null; curLen = 0; }
  }

  // current streak from most recent backward
  let current = { type: 'none', length: 0 };
  for (let i = settled.length - 1; i >= 0; i--) {
    const s = normStatus(settled[i].status);
    if (s === 'won' || s === 'lost') {
      if (current.type === 'none') { current.type = s; current.length = 1; }
      else if (current.type === s) { current.length += 1; }
      else break;
    } else break;
  }

  return { current, best: { win: bestWin, loss: bestLoss }, totalSettled: settled.length };
}

// ==== Handlers ==============================================================
exports.summary = async (req, res) => {
  try {
    const picks = await fetchAllPicks({});
    const { won, lost, push, open, riskedUnits, netUnits, roiPct } = summarize(picks);
    const bankrollStart = envBankrollStart();
    const bankrollCurrent = bankrollStart + netUnits;

    const todayStr = toISODateStringLocal(new Date());
    const todayPicks = picks.filter(p => pickDate(p) === todayStr);
    const todayOpen = todayPicks.filter(p => normStatus(p.status) === 'open');

    const openPicks = picks
      .filter(p => normStatus(p.status) === 'open')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 50);

    res.json({
      ok: true,
      sourceModels: [...new Set(picks.map(p => p.__sourceModel))],
      bankrollStart,
      bankrollCurrent,
      netUnits,
      roiPct,
      record: { won, lost, push, open },
      today: { date: todayStr, count: todayPicks.length, open: todayOpen.length },
      openPicks
    });
  } catch (err) {
    console.error('[metrics:summary]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.ledger = async (req, res) => {
  try {
    const range = parseRange(req);
    const picks = await fetchAllPicks(range);
    const rows = ledgerByDay(picks);
    let bank = envBankrollStart();
    const series = rows.map(r => { bank += r.pnlUnits; return { ...r, bankroll: bank }; });
    res.json({ ok: true, from: req.query.from || null, to: req.query.to || null, rows: series });
  } catch (err) {
    console.error('[metrics:ledger]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.record = async (req, res) => {
  try {
    const range = parseRange(req);
    const picks = await fetchAllPicks(range);
    const s = summarize(picks);
    res.json({ ok: true, ...s });
  } catch (err) {
    console.error('[metrics:record]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const range = parseRange(req);
    const picks = await fetchAllPicks(range);
    const csv = toCSV(picks);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="picks_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[metrics:exportCsv]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// === NEW: group-by analytics ===============================================
exports.groupBy = async (req, res) => {
  try {
    const field = String(req.params.field || '').toLowerCase();
    const allowed = new Set(['sport','league','market','selection','source','tags']);
    if (!allowed.has(field)) return res.status(400).json({ ok:false, error:`Invalid field. Try one of: ${[...allowed].join(', ')}` });

    const range = parseRange(req);
    const picks = await fetchAllPicks(range);
    const rows = groupAgg(picks, field);
    const limit = Math.max(0, Number(req.query.limit || 0));
    const data = limit ? rows.slice(0, limit) : rows;
    res.json({ ok: true, field, from: req.query.from || null, to: req.query.to || null, rows: data });
  } catch (err) {
    console.error('[metrics:groupBy]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// === NEW: streaks (current & best) =========================================
exports.streaks = async (_req, res) => {
  try {
    const picks = await fetchAllPicks({});
    const st = computeStreaks(picks);
    res.json({ ok: true, ...st });
  } catch (err) {
    console.error('[metrics:streaks]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
// === DASHBOARD TILES ========================================================
function inRangePick(p, fromDateStr, toDateStr) {
  const d = pickDate(p); // YYYY-MM-DD
  if (fromDateStr && d < fromDateStr) return false;
  if (toDateStr && d > toDateStr) return false;
  return true;
}
function summarizeFiltered(picks, fromStr, toStr) {
  const filtered = picks.filter(p => inRangePick(p, fromStr, toStr));
  const s = summarize(filtered);
  return { ...s, count: filtered.length };
}
function addDays(date, days) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d;
}

exports.tiles = async (req, res) => {
  try {
    const picks = await fetchAllPicks({}); // use cache at route layer
    const models = [...new Set(picks.map(p => p.__sourceModel))];

    const today = toISODateStringLocal(new Date());
    const start7  = toISODateStringLocal(addDays(new Date(), -6));   // inclusive window of 7 days
    const start30 = toISODateStringLocal(addDays(new Date(), -29));  // inclusive window of 30 days

    const all = summarize(picks);
    const bankrollStart = envBankrollStart();
    const bankrollCurrent = bankrollStart + all.netUnits;

    // windows
    const statToday = summarizeFiltered(picks, today, today);
    const stat7  = summarizeFiltered(picks, start7,  today);
    const stat30 = summarizeFiltered(picks, start30, today);

    // PnL today (units)
    const pnlToday = (() => {
      const settledToday = picks.filter(p => inRangePick(p, today, today))
                                .filter(p => ['won','lost','push'].includes(normStatus(p.status)));
      return settledToday.reduce((acc, p) => acc + resultPnLUnits({
        status: normStatus(p.status),
        odds: Number(p.odds ?? 0),
        stakeUnits: Number(p.stakeUnits ?? 1)
      }), 0);
    })();

    // group-bys (last 30)
    const picks30 = picks.filter(p => inRangePick(p, start30, today));
    const bySport = groupAgg(picks30, 'sport').slice(0, 6);
    const byTags  = groupAgg(picks30, 'tags').slice(0, 6);
    const byMarket= groupAgg(picks30, 'market').slice(0, 6);

    res.json({
      ok: true,
      sourceModels: models,
      bankroll: {
        start: bankrollStart,
        current: bankrollCurrent,
        netUnits: all.netUnits,
        roiPct: all.roiPct
      },
      today: {
        date: today,
        count: statToday.count,
        open: statToday.open,
        won: statToday.won,
        lost: statToday.lost,
        push: statToday.push,
        pnlUnits: pnlToday
      },
      last7d: {
        from: start7, to: today,
        record: { won: stat7.won, lost: stat7.lost, push: stat7.push, open: stat7.open },
        netUnits: stat7.netUnits, roiPct: stat7.roiPct
      },
      last30d: {
        from: start30, to: today,
        record: { won: stat30.won, lost: stat30.lost, push: stat30.push, open: stat30.open },
        netUnits: stat30.netUnits, roiPct: stat30.roiPct
      },
      top: { bySport, byMarket, byTags }
    });
  } catch (err) {
    console.error('[metrics:tiles]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
