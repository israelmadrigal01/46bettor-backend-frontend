// services/oddsService.js
const axios = require('axios');
const { fetchLiveScores } = require('./liveScoresService');

/* ----------------------- helpers & mapping ----------------------- */
function inferSportFromLeague(league) {
  const L = (league || '').toLowerCase();
  if (!L) return undefined;
  if (['nfl', 'cfb', 'college-football'].includes(L)) return 'football';
  if (['nba', 'wnba', 'ncaab', 'mens-college-basketball', 'womens-college-basketball'].includes(L)) return 'basketball';
  if (['mlb'].includes(L)) return 'baseball';
  if (['nhl'].includes(L)) return 'hockey';
  if (L.includes('soccer') || L.includes('usa.1') || L.includes('epl') || L.includes('la-liga') || L.includes('bundesliga') || L.includes('serie-a')) return 'soccer';
  return undefined;
}

function parseYMD(ymd) {
  if (!/^\d{8}$/.test(String(ymd || ''))) return null;
  const y = Number(ymd.slice(0,4));
  const m = Number(ymd.slice(4,6));
  const d = Number(ymd.slice(6,8));
  const dt = new Date(Date.UTC(y, m-1, d));
  return { y, m, d, date: dt };
}

/** Map our sport/league/date -> TheOddsAPI sport key */
function mapToTheOddsApiKey({ sport, league, date }) {
  const s = (sport || inferSportFromLeague(league) || '').toLowerCase();
  const L = (league || '').toLowerCase();
  const ymd = parseYMD(date);

  // crude preseason detection (Aug + early Sep)
  const isPreseason = () => {
    if (!ymd) return false;
    const m = ymd.m;
    const d = ymd.d;
    return m === 8 || (m === 9 && d <= 10);
  };

  if (s === 'football') {
    if (L.includes('nfl') && isPreseason()) return 'americanfootball_nfl_preseason';
    if (L.includes('nfl')) return 'americanfootball_nfl';
    if (L.includes('ncaaf') || L.includes('college')) return 'americanfootball_ncaaf';
    return 'americanfootball_nfl';
  }
  if (s === 'basketball') {
    if (L.includes('nba')) return 'basketball_nba';
    if (L.includes('wnba')) return 'basketball_wnba';
    if (L.includes('ncaab')) return 'basketball_ncaab';
    return 'basketball_nba';
  }
  if (s === 'baseball') return 'baseball_mlb';
  if (s === 'hockey') return 'icehockey_nhl';
  if (s === 'soccer') return 'soccer_usa_mls'; // example default
  return 'americanfootball_nfl';
}

function abbrOrName(team) {
  return team?.abbreviation || team?.shortName || team?.name || '';
}

/** demo odds if provider fails or DEMO_ODDS=true */
function demoPricesFor(game) {
  const homeScore = Number(game?.homeTeam?.score ?? NaN);
  const awayScore = Number(game?.awayTeam?.score ?? NaN);
  let homeFav = Math.random() < 0.5;
  if (game?.status === 'post' && Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore) {
    homeFav = homeScore > awayScore;
  }
  return { home: homeFav ? -125 : +110, away: homeFav ? +110 : -125 };
}

async function buildDemoFromScores({ sport, league, date }) {
  const games = await fetchLiveScores({ sport: sport || inferSportFromLeague(league), league, date, save: false });
  return games.map((g) => {
    const prices = demoPricesFor(g);
    return {
      sport: g.sport,
      league: g.league,
      gameId: g.gameId,
      startTime: g.startTime,
      homeTeam: {
        id: g.homeTeam?.id, name: g.homeTeam?.name,
        shortName: g.homeTeam?.shortName, abbreviation: g.homeTeam?.abbreviation,
      },
      awayTeam: {
        id: g.awayTeam?.id, name: g.awayTeam?.name,
        shortName: g.awayTeam?.shortName, abbreviation: g.awayTeam?.abbreviation,
      },
      books: [
        {
          site: 'DemoBook',
          markets: [
            {
              key: 'h2h',
              outcomes: [
                { name: abbrOrName(g.homeTeam), price: prices.home },
                { name: abbrOrName(g.awayTeam), price: prices.away },
              ],
            },
          ],
        },
      ],
    };
  });
}

/* ------------------------------ main ------------------------------ */
/**
 * Query TheOddsAPI and normalize to our event shape:
 *  - Keep bookmaker list as `bookmakers` (our normalizer supports this)
 *  - Map team objects (names; abbr may not be provided by TOA)
 *  - Optionally filter to a specific YYYYMMDD if provided
 */
async function getOddsForSport({ sport, league, date }) {
  const apiKey = process.env.ODDS_API_KEY;
  const demoFlag = String(process.env.DEMO_ODDS || '').toLowerCase() === 'true';

  // If no key, go demo immediately
  if (!apiKey) {
    if (demoFlag) return buildDemoFromScores({ sport, league, date });
    const err = new Error('ODDS_API_KEY missing and DEMO_ODDS is false');
    err.status = 500;
    throw err;
  }

  const sportKey = mapToTheOddsApiKey({ sport, league, date });

  const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/odds`;
  const params = {
    apiKey,
    regions: 'us',
    markets: 'h2h',
    oddsFormat: 'american',
    dateFormat: 'iso',
  };

  try {
    const { data } = await axios.get(url, { params, timeout: 15000 });
    let events = Array.isArray(data) ? data : [];

    // If user passed YYYYMMDD, filter to that date
    if (date && /^\d{8}$/.test(String(date))) {
      const want = parseYMD(date);
      events = events.filter((e) => {
        const t = new Date(e.commence_time);
        return (
          t.getUTCFullYear() === want.y &&
          t.getUTCMonth() + 1 === want.m &&
          t.getUTCDate() === want.d
        );
      });
    }

    // Normalize TOA events -> our shape (bookmakers left intact)
    return events.map((e) => {
      return {
        sport: sport || inferSportFromLeague(league) || '',
        league,
        gameId: e.id, // note: not ESPN id; we’ll match by names/aliases
        startTime: e.commence_time,
        homeTeam: { name: e.home_team },
        awayTeam: { name: e.away_team },
        // keep their structure so our normalizer sees `bookmakers[].markets[].outcomes[]`
        bookmakers: (e.bookmakers || []).map((bm) => ({
          key: bm.key,
          title: bm.title,
          last_update: bm.last_update,
          markets: (bm.markets || [])
            .filter((m) => (m.key || '').toLowerCase() === 'h2h')
            .map((m) => ({
              key: 'h2h',
              outcomes: (m.outcomes || []).map((o) => ({
                name: o.name, // full team name (our matcher handles names & abbrs)
                price: typeof o.price === 'number' ? o.price : undefined,
              })),
            })),
        })),
      };
    });
  } catch (err) {
    // Fallback to demo if allowed
    if (demoFlag) {
      try {
        return await buildDemoFromScores({ sport, league, date });
      } catch (e2) {
        const e = new Error(`TheOddsAPI failed (${err.message}); demo fallback also failed (${e2.message})`);
        e.status = 502;
        throw e;
      }
    }
    const e = new Error(`TheOddsAPI error: ${err?.response?.status || ''} ${err?.message || err}`);
    e.status = 502;
    throw e;
  }
}

module.exports = {
  getOddsForSport,
  inferSportFromLeague,
};
