// routes/public/tiles.js
const express = require('express');
const router = express.Router();

let PremiumPick = null;
try { PremiumPick = require('../../models/PremiumPick'); } catch {}
try { if (!PremiumPick) PremiumPick = require('../../models/Pick'); } catch {}
try { if (!PremiumPick) PremiumPick = require('../../models/picks'); } catch {}

// helper: net units for 1u risk
function netUnits(odds, status) {
  if (!status || status === 'open') return 0;
  const o = Number(odds);
  if (status === 'push') return 0;
  if (status === 'lost') return -1;
  if (status === 'won') {
    if (!Number.isFinite(o)) return 1;              // assume even money
    return o > 0 ? (o / 100) : (100 / Math.abs(o)); // 1u risk
  }
  return 0;
}

router.get('/tiles', async (_req, res) => {
  try {
    const bankrollStart = Number(process.env.BANKROLL_START || 250);

    if (!PremiumPick) {
      // Minimal shape if no DB
      return res.json({
        ok: true,
        sourceModels: [],
        bankroll: { start: bankrollStart, current: bankrollStart, netUnits: 0, roiPct: 0 },
        today: { date: new Date().toISOString().slice(0,10), count: 0, open: 0, won: 0, lost: 0, push: 0, pnlUnits: 0 },
        last7d:  { from: '', to: '', record: { won: 0, lost: 0, push: 0, open: 0 }, netUnits: 0, roiPct: 0 },
        last30d: { from: '', to: '', record: { won: 0, lost: 0, push: 0, open: 0 }, netUnits: 0, roiPct: 0 },
        top: { bySport: [], byMarket: [], byTags: [] },
      });
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0,10);
    const d7 = new Date(now); d7.setDate(d7.getDate() - 6);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 29);

    const all = await PremiumPick.find({}).lean();

    // helpers
    const isOnDate = (d, ymd) => (d ? new Date(d).toISOString().slice(0,10) === ymd : false);
    const inRange = (d, from, to) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      return t >= from.getTime() && t <= to.getTime();
    };

    // compute aggregates
    function summarize(arr) {
      let won = 0, lost = 0, push = 0, open = 0, net = 0, risk = 0;
      for (const p of arr) {
        const st = p.status || 'open';
        if (st === 'won') { won++; risk += 1; net += netUnits(p.odds ?? p.price, st); }
        else if (st === 'lost') { lost++; risk += 1; net += netUnits(p.odds ?? p.price, st); }
        else if (st === 'push') { push++; /* risk += 1? usually refunded */ net += 0; }
        else { open++; }
      }
      const roiPct = risk > 0 ? (net / risk) * 100 : 0;
      return { record: { won, lost, push, open }, netUnits: Number(net.toFixed(6)), roiPct: Number(roiPct.toFixed(6)) };
    }

    const today = all.filter(p =>
      isOnDate(p.settledAt || p.createdAt || p.date, todayStr)
    );
    const last7 = all.filter(p => inRange(p.settledAt || p.createdAt || p.date, d7, now));
    const last30 = all.filter(p => inRange(p.settledAt || p.createdAt || p.date, d30, now));

    const sToday = summarize(today);
    const s7 = summarize(last7);
    const s30 = summarize(last30);

    // bankroll based on ALL settled
    const settled = all.filter(p => ['won','lost','push'].includes(p.status));
    const bankNet = settled.reduce((a,p) => a + netUnits(p.odds ?? p.price, p.status), 0);
    const risked = settled.reduce((a,p) => a + (p.status === 'push' ? 0 : 1), 0);
    const bankroll = {
      start: bankrollStart,
      current: Number((bankrollStart + bankNet).toFixed(6)),
      netUnits: Number(bankNet.toFixed(6)),
      roiPct: risked > 0 ? Number(((bankNet / risked) * 100).toFixed(6)) : 0,
    };

    // simple "top" groups
    function groupBy(keyFn) {
      const m = new Map();
      for (const p of settled) {
        const k = keyFn(p) || '(none)';
        if (!m.has(k)) m.set(k, { key: k, won: 0, lost: 0, push: 0, open: 0, riskedUnits: 0, netUnits: 0, roiPct: 0 });
        const g = m.get(k);
        if (p.status === 'won') { g.won++; g.riskedUnits += 1; g.netUnits += netUnits(p.odds ?? p.price, 'won'); }
        else if (p.status === 'lost') { g.lost++; g.riskedUnits += 1; g.netUnits += netUnits(p.odds ?? p.price, 'lost'); }
        else if (p.status === 'push') { g.push++; }
      }
      for (const g of m.values()) {
        g.netUnits = Number(g.netUnits.toFixed(6));
        g.roiPct = g.riskedUnits > 0 ? Number(((g.netUnits / g.riskedUnits) * 100).toFixed(6)) : 0;
      }
      return Array.from(m.values());
    }

    const bySport = groupBy(p => p.sport || p.league);
    const byMarket = groupBy(p => p.market || p.type);
    const byTags = (() => {
      const m = new Map();
      for (const p of settled) {
        const tags = Array.isArray(p.tags) && p.tags.length ? p.tags : ['(none)'];
        for (const t of tags) {
          const k = t || '(none)';
          if (!m.has(k)) m.set(k, { key: k, won: 0, lost: 0, push: 0, open: 0, riskedUnits: 0, netUnits: 0, roiPct: 0 });
          const g = m.get(k);
          if (p.status === 'won') { g.won++; g.riskedUnits += 1; g.netUnits += netUnits(p.odds ?? p.price, 'won'); }
          else if (p.status === 'lost') { g.lost++; g.riskedUnits += 1; g.netUnits += netUnits(p.odds ?? p.price, 'lost'); }
          else if (p.status === 'push') { g.push++; }
        }
      }
      for (const g of m.values()) {
        g.netUnits = Number(g.netUnits.toFixed(6));
        g.roiPct = g.riskedUnits > 0 ? Number(((g.netUnits / g.riskedUnits) * 100).toFixed(6)) : 0;
      }
      return Array.from(m.values());
    })();

    res.json({
      ok: true,
      sourceModels: PremiumPick ? ['PremiumPick'] : [],
      bankroll,
      today: { date: todayStr, count: today.length, ...sToday },
      last7d: { from: d7.toISOString().slice(0,10), to: now.toISOString().slice(0,10), ...s7 },
      last30d:{ from: d30.toISOString().slice(0,10), to: now.toISOString().slice(0,10), ...s30 },
      top: { bySport, byMarket, byTags },
    });
  } catch (err) {
    console.error('[public/tiles] error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
