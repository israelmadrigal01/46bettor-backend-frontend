// routes/public-schedule.js (CommonJS)
const express = require('express');
const { nbaGamesByDate } = require('../integrations/balldontlie');
const { soccerMatchesByDate } = require('../integrations/footballdata');
const { msfGamesByDate } = require('../integrations/mysportsfeeds');
const { withCache } = require('../utils/cache');

const r = express.Router();

function safeISO(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const z = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d);
  if (isNaN(z.getTime())) return new Date().toISOString().slice(0, 10);
  return z.toISOString().slice(0, 10);
}

/**
 * GET /api/public/schedule/:sport
 * :sport = nba | mlb | nhl | nfl | soccer
 * ?date=YYYY-MM-DD
 * ?comp=PL      (for soccer)
 * ?cache=seconds
 */
r.get('/schedule/:sport', async (req, res) => {
  const sport = String(req.params.sport || '').toLowerCase();
  const isoDate = safeISO(req.query.date);
  const comp = String(req.query.comp || 'PL');
  const overrideTtl = Number(req.query.cache || 0);

  const key = `sched:${sport}:${comp}:${isoDate}`;
  const defaultTtl =
    sport === 'soccer' ? 180 :
    ['nba','mlb','nhl','nfl'].includes(sport) ? 120 : 120;
  const ttl = overrideTtl > 0 ? overrideTtl : defaultTtl;

  try {
    const data = await withCache(key, ttl, async () => {
      switch (sport) {
        case 'nba': return await nbaGamesByDate(isoDate);
        case 'mlb':
        case 'nhl':
        case 'nfl': return await msfGamesByDate({ sport, isoDate });
        case 'soccer': return await soccerMatchesByDate({ comp, isoDate });
        default: throw new Error(`Unsupported sport "${sport}". Use nba, mlb, nhl, nfl, soccer`);
      }
    });
    res.json({ ok: true, sport: sport.toUpperCase(), date: isoDate, comp, count: data.length, items: data });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

/** GET /api/public/schedule/all?date=YYYY-MM-DD&comp=PL */
r.get('/schedule/all', async (req, res) => {
  const isoDate = safeISO(req.query.date);
  const comp = String(req.query.comp || 'PL');
  const avail = [];
  async function maybe(fn) { try { const items = await fn(); avail.push(...items); } catch (_) {} }

  await Promise.all([
    maybe(() => withCache(`sched:nba:${isoDate}`, 120, () => nbaGamesByDate(isoDate))),
    maybe(() => withCache(`sched:mlb:${isoDate}`, 120, () => msfGamesByDate({ sport: 'mlb', isoDate }))),
    maybe(() => withCache(`sched:nhl:${isoDate}`, 120, () => msfGamesByDate({ sport: 'nhl', isoDate }))),
    maybe(() => withCache(`sched:nfl:${isoDate}`, 120, () => msfGamesByDate({ sport: 'nfl', isoDate }))),
    maybe(() => withCache(`sched:soccer:${comp}:${isoDate}`, 180, () => soccerMatchesByDate({ comp, isoDate }))),
  ]);

  res.json({ ok: true, date: isoDate, count: avail.length, items: avail });
});

module.exports = r;
