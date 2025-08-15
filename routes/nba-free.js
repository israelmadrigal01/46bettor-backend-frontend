/* eslint-disable */ // @ts-nocheck
'use strict';
const express = require('express');
const router = express.Router();
const {
  fetchNBAToday,
  fetchNBAScoreboardByDate,
  fetchNBANextDayWithGames,
  fetchNBASchedule
} = require('../services/adapters/nbaFreeAdapter');

function toBool(v, def=false){ if (v===undefined) return def; const s=String(v).toLowerCase(); return ['1','true','yes','y','on'].includes(s); }
function pick(obj, fieldsCsv){ if(!fieldsCsv) return obj; const fields=String(fieldsCsv).split(',').map(s=>s.trim()).filter(Boolean); const out={}; for(const f of fields){ if(obj&&Object.prototype.hasOwnProperty.call(obj,f)) out[f]=obj[f]; } return out; }
function compactGame(g){ return { id:g.id, dateUTC:g.dateUTC, status:g.status, period:g.period, clock:g.clock, venue:g.venue, home:{ name:g.home?.name, tri:g.home?.tri, score:g.home?.score }, away:{ name:g.away?.name, tri:g.away?.tri, score:g.away?.score } }; }
function applyView(items, { compact=true, fields, limit }){ let out=Array.isArray(items)?items:[]; if(compact) out=out.map(compactGame); if(fields) out=out.map(x=>pick(x,fields)); if(limit) out=out.slice(0,Number(limit)); return out; }

/** GET /api/nba-free/today
 *  Query:
 *    - when=next  -> if no games today, return the next day that has games (parallel probe)
 *    - debug=1, fields=..., limit=?, raw=1
 */
router.get('/today', async (req, res) => {
  try {
    const compact = toBool(req.query.compact, true);
    const includeRaw = toBool(req.query.raw, false);
    const debug = toBool(req.query.debug, false);
    const whenNext = String(req.query.when || '').toLowerCase() === 'next';
    const { fields, limit } = req.query;

    const out = await fetchNBAToday();
    let items = out.items;
    let meta = { source: out.source, trace: out.trace };

    if (whenNext && (!items || items.length === 0)) {
      const next = await fetchNBANextDayWithGames({ from: new Date(), horizonDays: 120 }, undefined);
      items = next.items;
      meta = { source: next.source, trace: next.trace, date: next.date };
    }

    let data = applyView(items, { compact, fields, limit });
    if (includeRaw) data = data.map((d,i)=> ({ ...d, raw: items[i] }));

    const payload = { ok: true, count: data.length, games: data };
    if (meta.date) payload.date = meta.date;
    if (debug) payload.source = meta.source, payload.trace = meta.trace;
    res.json(payload);
  } catch (e) {
    console.error('[nba-free:today]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/nba-free/scoreboard?date=YYYY-MM-DD&debug=1 */
router.get('/scoreboard', async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ ok:false, error:'Missing date=YYYY-MM-DD' });

    const preferSrc = req.query.source
      ? String(req.query.source).split(',').map(s=>s.trim().toLowerCase())
      : undefined;

    const compact = toBool(req.query.compact, true);
    const includeRaw = toBool(req.query.raw, false);
    const debug = toBool(req.query.debug, false);
    const { fields, limit } = req.query;

    const out = await fetchNBAScoreboardByDate(date, preferSrc);
    let data = applyView(out.items, { compact, fields, limit });
    if (includeRaw) data = data.map((d,i)=> ({ ...d, raw: out.items[i] }));

    const payload = { ok: true, date: out.date || date, count: data.length, games: data };
    if (debug) payload.source = out.source, payload.trace = out.trace;
    res.json(payload);
  } catch (e) {
    console.error('[nba-free:scoreboard]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/nba-free/next?days=120&debug=1 */
router.get('/next', async (req, res) => {
  try {
    const compact = toBool(req.query.compact, true);
    const includeRaw = toBool(req.query.raw, false);
    const debug = toBool(req.query.debug, false);
    const { fields, limit } = req.query;

    let days = parseInt(req.query.days, 10);
    if (!Number.isFinite(days)) days = 120;
    days = Math.max(1, Math.min(days, 200)); // cap widened for offseason

    const out = await fetchNBANextDayWithGames({ from: new Date(), horizonDays: days }, undefined);
    let data = applyView(out.items, { compact, fields, limit });
    if (includeRaw) data = data.map((d,i)=> ({ ...d, raw: out.items[i] }));

    const payload = { ok: true, date: out.date, count: data.length, games: data, source: out.source };
    if (debug) payload.trace = out.trace;
    res.json(payload);
  } catch (e) {
    console.error('[nba-free:next]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/nba-free/schedule?date=YYYY-MM-DD&debug=1 */
router.get('/schedule', async (req, res) => {
  try {
    const date = req.query.date;
    const preferSrc = req.query.source
      ? String(req.query.source).split(',').map(s=>s.trim().toLowerCase())
      : undefined;

    const compact = toBool(req.query.compact, true);
    const includeRaw = toBool(req.query.raw, false);
    const debug = toBool(req.query.debug, false);
    const { fields, limit } = req.query;

    const out = await fetchNBASchedule({ date }, preferSrc);
    let data = applyView(out.items, { compact, fields, limit });
    if (includeRaw) data = data.map((d,i)=> ({ ...d, raw: out.items[i] }));

    const payload = { ok: true, date: out.date || date || null, count: data.length, games: data };
    if (debug) payload.source = out.source, payload.trace = out.trace;
    res.json(payload);
  } catch (e) {
    console.error('[nba-free:schedule]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
