// routes/public-odds.js
// Public odds endpoints using The Odds API (v4).
// Docs: https://the-odds-api.com/  (you'll need ODDS_API_KEY set on the server)

const express = require('express');
const router = express.Router();

// Node 18+ has global fetch
const KEY = process.env.ODDS_API_KEY || '';
const BASE = 'https://api.the-odds-api.com/v4';

// simple in-memory cache (per process)
const cache = new Map(); // key -> { ts, ttlMs, data }
function memo(key, ttlMs, fn) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < hit.ttlMs) return Promise.resolve(hit.data);
  return Promise.resolve()
    .then(fn)
    .then((data) => {
      cache.set(key, { ts: now, ttlMs, data });
      return data;
    });
}

function bad(res, msg, code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}

// Map our simple sport names to The Odds API keys
const SPORT_KEYS = {
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  nfl: 'americanfootball_nfl',
  // add more later if you want:
  // 'cbb': 'basketball_ncaab',
  // 'cfb': 'americanfootball_ncaaf',
};

// Normalize output to a consistent shape
function normalizeOdds(sport, items) {
  // items: array from /sports/{key}/odds
  return (items || []).map((ev) => {
    const home = ev?.home_team || null;
    const away = ev?.away_team || null;

    // Pull "best price" across all bookmakers
    let bestHome = null;
    let bestAway = null;

    for (const bk of ev.bookmakers || []) {
      for (const mk of bk.markets || []) {
        if (mk.key !== 'h2h') continue; // moneyline only
        for (const out of mk.outcomes || []) {
          if (out.name === home) {
            bestHome = bestHome == null ? out.price : Math.max(bestHome, out.price);
          } else if (out.name === away) {
            bestAway = bestAway == null ? out.price : Math.max(bestAway, out.price);
          }
        }
      }
    }

    return {
      provider: 'the-odds-api',
      sport: sport.toUpperCase(),
      id: ev.id || null,
      startsAt: ev.commence_time || null,
      homeTeam: home,
      awayTeam: away,
      bestHomeML: bestHome,
      bestAwayML: bestAway,
      // include a compact view of top 3 books to keep payload small
      books: (ev.bookmakers || [])
        .slice(0, 3)
        .map((bk) => ({
          key: bk.key,
          title: bk.title,
          lastUpdate: bk.last_update,
        })),
    };
  });
}

/**
 * GET /api/public/odds/:sport
 *   :sport in { nba, mlb, nhl, nfl }
 * Query (optional):
 *   regions=us | us,us2,...       (default us)
 *   markets=h2h                    (default h2h)
 *   bookmakers=draftkings,fanduel  (default popular set)
 *   oddsFormat=american            (default american)
 *   dateFormat=iso                 (default iso)
 *   ttl=60                         (cache seconds; default 60)
 */
router.get('/odds/:sport', async (req, res) => {
  try {
    if (!KEY) return bad(res, 'ODDS_API_KEY not configured on server');

    const sport = String(req.params.sport || '').toLowerCase();
    const sportKey = SPORT_KEYS[sport];
    if (!sportKey) return bad(res, `Unsupported sport "${sport}". Use nba, mlb, nhl, nfl`);

    const {
      regions = 'us',
      markets = 'h2h',
      bookmakers = 'draftkings,fanduel,betmgm,pointsbetus,williamhill_us',
      oddsFormat = 'american',
      dateFormat = 'iso',
      ttl = '60',
    } = req.query;

    const cacheKey = `odds:${sportKey}:${regions}:${markets}:${bookmakers}:${oddsFormat}:${dateFormat}`;
    const ttlMs = Math.max(5, Number(ttl)) * 1000;

    const data = await memo(cacheKey, ttlMs, async () => {
      const url =
        `${BASE}/sports/${encodeURIComponent(sportKey)}/odds` +
        `?regions=${encodeURIComponent(regions)}` +
        `&markets=${encodeURIComponent(markets)}` +
        `&bookmakers=${encodeURIComponent(bookmakers)}` +
        `&oddsFormat=${encodeURIComponent(oddsFormat)}` +
        `&dateFormat=${encodeURIComponent(dateFormat)}` +
        `&apiKey=${encodeURIComponent(KEY)}`;

      const r = await fetch(url);
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(`GET ${url} -> ${r.status} ${r.statusText} ${t}`);
      }
      const j = await r.json();
      return normalizeOdds(sport, j);
    });

    res.json({ ok: true, sport: sport.toUpperCase(), count: data.length, items: data });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err?.message || err) });
  }
});

module.exports = router;
