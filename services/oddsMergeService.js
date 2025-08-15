// services/oddsMergeService.js
const axios = require('axios');

const BASE = `http://127.0.0.1:${process.env.PORT || 5050}`;

/* ---------------------------- helpers ---------------------------- */
function arr(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.data)) return x.data;
  if (Array.isArray(x.items)) return x.items;
  if (Array.isArray(x.results)) return x.results;
  if (Array.isArray(x.events)) return x.events;
  return [];
}

function val(v, ...keys) {
  if (!v) return undefined;
  for (const k of keys) {
    if (v[k] != null) return v[k];
  }
  return undefined;
}

function clean(s) { return (s || '').toString().trim(); }
function upper(s) { return clean(s).toUpperCase(); }

function betterAmerican(a, b) {
  if (typeof a !== 'number') return false;
  if (typeof b !== 'number') return true;
  // “Better” for a bettor = higher number (+150 > +120, -105 > -120)
  return a > b;
}

/** infer sport from league so the frontend doesn’t need to send it */
function inferSportFromLeague(league) {
  const L = (league || '').toString().toLowerCase();
  if (!L) return undefined;
  if (['nfl', 'cfb', 'ncaa-fb', 'college-football'].includes(L)) return 'football';
  if (['nba', 'wnba', 'cfb-bball', 'ncaab', 'mens-college-basketball', 'womens-college-basketball'].includes(L)) return 'basketball';
  if (['mlb'].includes(L)) return 'baseball';
  if (['nhl'].includes(L)) return 'hockey';
  if (L.includes('soccer') || L.includes('usa.1') || L.includes('epl') || L.includes('la-liga') || L.includes('bundesliga') || L.includes('serie-a')) return 'soccer';
  return undefined;
}

function isMatch(outcomeName, aliases) {
  const o = upper(outcomeName);
  return aliases.some((a) => o === upper(a));
}

function pickDisplayAbbr(team) {
  return upper(team?.abbreviation || team?.abbr || team?.shortName || team?.name || team);
}

function aliasesForTeam(team) {
  const a = [];
  const t = team || {};
  [t.abbreviation, t.abbr, t.shortName, t.nickname, t.code, t.tla, t.name, t.fullName, t.displayName].forEach((x) => {
    if (x) a.push(x);
  });
  return a.filter(Boolean);
}

function bestMoneylinesGeneric(books, homeAliases, awayAliases) {
  let bestHome = null, bestAway = null;

  (books || []).forEach((book) => {
    const site = book.site || book.book || book.name || book.key || book.title || book.bookmaker || 'book';

    // TheOddsAPI v4: book.bookmakers[].markets[].outcomes[]
    const bookmakers = arr(book.bookmakers);
    if (bookmakers.length) {
      bookmakers.forEach((bm) => {
        const siteName = bm.title || bm.key || site;
        arr(bm.markets).forEach((m) => {
          const mk = (m.key || m.market || m.name || '').toLowerCase();
          if (mk === 'h2h' || mk === 'moneyline' || mk === 'ml') {
            arr(m.outcomes).forEach((o) => {
              const price = Number(o.price ?? o.odds ?? o.american ?? o.americanOdds ?? o.line ?? o.point);
              if (!Number.isFinite(price)) return;
              const n = o.name || o.team || o.selection || o.participant || o.abbr || '';
              if (isMatch(n, homeAliases)) {
                if (!bestHome || betterAmerican(price, bestHome.price)) bestHome = { book: siteName, price };
              } else if (isMatch(n, awayAliases)) {
                if (!bestAway || betterAmerican(price, bestAway.price)) bestAway = { book: siteName, price };
              }
            });
          }
        });
      });
    }

    // “sites/odds.h2h” shape
    if (book.odds && (Array.isArray(book.odds.h2h) || Array.isArray(book.odds.moneyline))) {
      const h2h = book.odds.h2h || book.odds.moneyline || [];
      h2h.forEach((o) => {
        const price = Number(o?.price ?? o?.odds ?? o?.american);
        if (!Number.isFinite(price)) return;
        const n = o.name || o.team || '';
        if (isMatch(n, homeAliases)) {
          if (!bestHome || betterAmerican(price, bestHome.price)) bestHome = { book: site, price };
        } else if (isMatch(n, awayAliases)) {
          if (!bestAway || betterAmerican(price, bestAway.price)) bestAway = { book: site, price };
        }
      });
    }

    // Generic: book.markets[].outcomes[] | book.lines[].runners[]
    const markets = arr(book.markets || book.market || book.lines || book.odds);
    markets.forEach((m) => {
      const mk = (m.key || m.market || m.name || '').toLowerCase();
      if (mk && !['h2h', 'moneyline', 'ml'].includes(mk)) return;

      const outcomes = arr(m.outcomes || m.prices || m.lines || m.runners);
      outcomes.forEach((o) => {
        const price = Number(o.price ?? o.odds ?? o.american ?? o.americanOdds ?? o.line);
        if (!Number.isFinite(price)) return;
        const n = o.name || o.team || o.selection || o.participant || o.abbr || '';
        if (isMatch(n, homeAliases)) {
          if (!bestHome || betterAmerican(price, bestHome.price)) bestHome = { book: site, price };
        } else if (isMatch(n, awayAliases)) {
          if (!bestAway || betterAmerican(price, bestAway.price)) bestAway = { book: site, price };
        }
      });
    });
  });

  return { home: bestHome, away: bestAway };
}

function normalizeTeams(e) {
  let homeTeam =
    val(e, 'homeTeam') ||
    val(e, 'home') ||
    val(e?.teams, 'home') ||
    (Array.isArray(e?.teams) ? e.teams.find((t) => t.home === true || t.location === 'home') : null) ||
    null;

  let awayTeam =
    val(e, 'awayTeam') ||
    val(e, 'away') ||
    val(e?.teams, 'away') ||
    (Array.isArray(e?.teams) ? e.teams.find((t) => t.away === true || t.location === 'away') : null) ||
    null;

  if (typeof homeTeam === 'string') homeTeam = { name: homeTeam };
  if (typeof awayTeam === 'string') awayTeam = { name: awayTeam };

  if (!homeTeam && e.home_team) homeTeam = { name: e.home_team, abbreviation: e.home_team };
  if (!awayTeam && e.away_team) awayTeam = { name: e.away_team, abbreviation: e.away_team };

  if ((!homeTeam || !awayTeam) && Array.isArray(e?.teams) && e.teams.length === 2) {
    const [t1, t2] = e.teams;
    homeTeam = homeTeam || t1 || null;
    awayTeam = awayTeam || t2 || null;
  }

  return { homeTeam: homeTeam || {}, awayTeam: awayTeam || {} };
}

function normalizeOddsEvent(e) {
  const gameId = e.gameId || e.id || e.eventId || e.key || e.uid || null;
  const { homeTeam, awayTeam } = normalizeTeams(e);

  const homeAliases = aliasesForTeam(homeTeam);
  const awayAliases = aliasesForTeam(awayTeam);

  const books = e.books || e.bookmakers || e.sites || e.markets || e.odds || [];

  const homeAbbr = pickDisplayAbbr(homeTeam);
  const awayAbbr = pickDisplayAbbr(awayTeam);

  return { gameId, homeTeam, awayTeam, homeAbbr, awayAbbr, homeAliases, awayAliases, books: arr(books) };
}

function matchupKeyAbbr(awayAbbr, homeAbbr) {
  const A = upper(awayAbbr);
  const H = upper(homeAbbr);
  if (!A || !H) return null;
  return `${A}@${H}`;
}
function matchupKeyName(awayName, homeName) {
  const A = upper(awayName);
  const H = upper(homeName);
  if (!A || !H) return null;
  return `${A}@${H}`;
}

/* ---------------------------- main API ---------------------------- */
async function getMergedOdds({ league, sport, date }) {
  let data = [];
  try {
    const q = new URLSearchParams();
    const inferred = sport || inferSportFromLeague(league);
    if (inferred) q.set('sport', inferred);
    if (league) q.set('league', league);
    if (date) q.set('date', date);
    const url = `${BASE}/api/odds${q.toString() ? `?${q.toString()}` : ''}`;
    const res = await axios.get(url, { timeout: 20000 });
    data = arr(res.data);
  } catch (e) {
    data = arr(e?.response?.data) || [];
  }

  const byGameId = {};
  const byMatchup = {};
  const byMatchupName = {};
  let count = 0;

  data.forEach((raw) => {
    const n = normalizeOddsEvent(raw);
    if (!n.homeAliases.length || !n.awayAliases.length) return;

    const best = bestMoneylinesGeneric(n.books, n.homeAliases, n.awayAliases);
    if (!best.home && !best.away) return;

    if (n.gameId) byGameId[n.gameId] = { home: best.home, away: best.away, homeAbbr: n.homeAbbr, awayAbbr: n.awayAbbr };

    const keyAbbr = matchupKeyAbbr(n.awayAbbr, n.homeAbbr);
    if (keyAbbr) byMatchup[keyAbbr] = { home: best.home, away: best.away, homeAbbr: n.homeAbbr, awayAbbr: n.awayAbbr };

    const keyName = matchupKeyName(n.awayTeam?.name, n.homeTeam?.name);
    if (keyName) byMatchupName[keyName] = { home: best.home, away: best.away, homeName: n.homeTeam?.name, awayName: n.awayTeam?.name };

    count++;
  });

  return {
    byGameId,
    byMatchup,
    byMatchupName,
    count,
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = {
  getMergedOdds,
  matchupKeyAbbr,
  matchupKeyName,
  pickDisplayAbbr,
  inferSportFromLeague,
};
