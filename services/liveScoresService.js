// services/liveScoresService.js
const axios = require('axios');
const LiveScore = require('../models/LiveScore');

/**
 * ESPN scoreboards (correct path: /apis/site/v2/)
 * Add ?dates=YYYYMMDD to filter by date.
 */
const ESPN_ENDPOINTS = [
  { sport: 'football',   league: 'nfl',                     url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard' },
  { sport: 'football',   league: 'college-football',        url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard' },
  { sport: 'basketball', league: 'nba',                     url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard' },
  { sport: 'basketball', league: 'wnba',                    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard' },
  { sport: 'basketball', league: 'mens-college-basketball', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard' },
  { sport: 'baseball',   league: 'mlb',                     url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard' },
  { sport: 'hockey',     league: 'nhl',                     url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard' },
  { sport: 'soccer',     league: 'usa.1',                   url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard' },
];

const SAVE_TO_DB = String(process.env.SAVE_LIVE_SCORES || '').toLowerCase() === 'true';

/* -------------------------- helpers -------------------------- */
function addQuery(url, params) {
  const usp = new URLSearchParams(params || {});
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}
function yyyymmddToIso(d) {
  if (!d) return undefined;
  if (/^\d{8}$/.test(d)) return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  return undefined;
}
function todayIsoNY() {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
    return fmt.format(new Date());
  } catch {
    return new Date().toISOString().slice(0,10);
  }
}
function periodOrShort(statusObj) {
  const t = statusObj?.type || {};
  return t?.shortDetail || (statusObj?.period != null ? String(statusObj.period) : '');
}
function toDateUTCFromYYYYMMDD(d) {
  const y = Number(d.slice(0,4));
  const m = Number(d.slice(4,6)) - 1;
  const dd = Number(d.slice(6,8));
  return new Date(Date.UTC(y, m, dd));
}
function toYYYYMMDD(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
function shiftYYYYMMDD(d, deltaDays) {
  const base = toDateUTCFromYYYYMMDD(d);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return toYYYYMMDD(base);
}

/* ----------------------- ESPN normalizer ---------------------- */
function normalizeEspnEvent(sport, league, event) {
  const comp = event.competitions?.[0];
  const statusObj = comp?.status || event?.status || {};
  const t = statusObj?.type || {};
  const completed = t?.completed === true;
  const inProgress = t?.state === 'in';

  const status = completed ? 'post' : inProgress ? 'in' : 'pre';
  const neutralSite = !!comp?.neutralSite;

  const competitors = comp?.competitors || [];
  const homeRaw = competitors.find((x) => x.homeAway === 'home') || {};
  const awayRaw = competitors.find((x) => x.homeAway === 'away') || {};

  const teamShape = (entry) => ({
    id: entry?.id || entry?.team?.id || '',
    name: entry?.team?.displayName || entry?.team?.name || '',
    shortName: entry?.team?.shortDisplayName || entry?.team?.teamName || '',
    abbreviation: entry?.team?.abbreviation || '',
    score: Number(entry?.score || 0),
    ranking: entry?.curatedRank?.current ?? null,
  });

  const homeTeam = teamShape(homeRaw);
  const awayTeam = teamShape(awayRaw);

  const startTime = comp?.date || event?.date || null;

  return {
    sport,
    league,
    gameId: event?.id || comp?.id || '',
    startTime: startTime ? new Date(startTime) : null,
    status,
    period: periodOrShort(statusObj),
    clock: statusObj?.displayClock || '',
    neutralSite,
    homeTeam,
    awayTeam,
    key: `${league}:${event?.id || comp?.id || ''}`,
    raw: { source: 'espn', id: event?.id, statusObj },
  };
}

/* --------------------- MLB Stats API fallback --------------------- */
async function fetchMlbStatsSchedule(dateIso) {
  const date = dateIso || todayIsoNY();
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    const dates = data?.dates || [];
    const games = dates.flatMap((d) => d.games || []);
    return games.map((g) => {
      const h = g.teams?.home;
      const a = g.teams?.away;
      const detailed = g?.status?.detailedState || '';
      const abstract = (g?.status?.abstractGameState || '').toLowerCase(); // Preview/Live/Final

      let status = 'pre';
      if (abstract === 'live') status = 'in';
      else if (abstract === 'final') status = 'post';

      const homeTeam = {
        id: h?.team?.id ? String(h.team.id) : '',
        name: h?.team?.name || '',
        shortName: h?.team?.teamName || '',
        abbreviation: h?.team?.abbreviation || '',
        score: Number(h?.score ?? 0),
        ranking: null,
      };
      const awayTeam = {
        id: a?.team?.id ? String(a.team.id) : '',
        name: a?.team?.name || '',
        shortName: a?.team?.teamName || '',
        abbreviation: a?.team?.abbreviation || '',
        score: Number(a?.score ?? 0),
        ranking: null,
      };

      return {
        sport: 'baseball',
        league: 'mlb',
        gameId: String(g.gamePk),
        startTime: g.gameDate ? new Date(g.gameDate) : null,
        status,
        period: detailed || (status === 'post' ? 'Final' : ''),
        clock: '',
        neutralSite: false,
        homeTeam,
        awayTeam,
        key: `mlb:${g.gamePk}`,
        raw: { source: 'mlb-stats', gamePk: g.gamePk, status: g.status },
      };
    });
  } catch (err) {
    console.log(`[liveScoresService] MLB Stats fallback 404/err: ${err.message}`);
    return [];
  }
}

async function fetchMlbLinescore(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return {
    currentInning: data?.currentInning || null,
    inningState: data?.inningState || '',
    isTopInning: data?.isTopInning ?? null,
    balls: data?.balls ?? null,
    strikes: data?.strikes ?? null,
    outs: data?.outs ?? null,
    teams: data?.teams || null,
    innings: data?.innings || [],
  };
}

/* --------------------------- fetchers ---------------------------- */
/**
 * Fetch a league’s scoreboard. If a specific YYYYMMDD is provided and returns
 * zero events, also try the previous and next day and merge results.
 */
async function fetchLeague({ sport, league, url, date }) {
  const seen = new Set();
  const out = [];

  async function oneFetch(d) {
    try {
      const u = d ? addQuery(url, { dates: d }) : url; // ESPN supports ?dates=YYYYMMDD
      const { data } = await axios.get(u, { timeout: 15000 });
      const events = data?.events || [];
      for (const ev of events) {
        const key = ev?.id || ev?.uid || JSON.stringify(ev).slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(normalizeEspnEvent(sport, league, ev));
      }
    } catch (err) {
      const code = err.response?.status;
      if (code === 404) {
        console.log(`[liveScoresService] ${league} none/endpoint off for ${d || 'today'} (404)`);
      } else {
        console.warn(`[liveScoresService] ${league} fetch failed for ${d || 'today'}: ${err.message}`);
      }
    }
  }

  if (!date) {
    await oneFetch(undefined);
  } else {
    // Try date, date-1, date+1 to cover late games / timezone edges
    const prev = shiftYYYYMMDD(date, -1);
    const next = shiftYYYYMMDD(date, +1);
    await Promise.all([oneFetch(date), oneFetch(prev), oneFetch(next)]);
  }

  return out;
}

function deriveTags(game) {
  const tags = [];
  const h = game.homeTeam?.score ?? 0;
  const a = game.awayTeam?.score ?? 0;

  if (game.status === 'pre') {
    tags.push('Not Started');
    if (game.startTime) {
      const ms = new Date(game.startTime).getTime() - Date.now();
      if (ms > 0 && ms <= 30 * 60 * 1000) tags.push('Starting Soon');
    }
    return tags;
  }

  if (game.status === 'in') {
    tags.push('Live');
    if (h > a) tags.push('Home Winning');
    if (a > h) tags.push('Away Winning');
    if (h === a) tags.push('Tied');

    const sport = (game.sport || '').toLowerCase();
    const margin = Math.abs(h - a);
    if (['basketball'].includes(sport) && margin <= 5) tags.push('Close Game');
    if (['football', 'hockey', 'soccer'].includes(sport) && margin <= 1) tags.push('Close Game');
    if (['baseball'].includes(sport) && margin <= 1) tags.push('Close Game');

    const p = (game.period || '').toLowerCase();
    if (sport === 'basketball' && /q4|ot/i.test(p)) tags.push('Late Game');
    if (sport === 'football' && /q4|ot/i.test(p)) tags.push('Late Game');
    if (sport === 'baseball' && /8th|9th|10th|11th|12th|end 7th|end 8th|end 9th/i.test(p)) tags.push('Late Game');
    if (sport === 'hockey' && /3rd|ot/i.test(p)) tags.push('Late Game');
    if (sport === 'soccer' && /90|stoppage|et/i.test(p)) tags.push('Late Game');

    return tags;
  }

  tags.push('Final');
  const diff = Math.abs(h - a);
  if (diff <= 1) tags.push('Nail-biter');
  if (h > a) tags.push('Home Won');
  if (a > h) tags.push('Away Won');
  return tags;
}

/* ------------------------ main entrypoint ------------------------ */
async function fetchLiveScores(opts = {}) {
  const { sport, league, save, date, demo } = opts;

  // Demo mode
  if (demo === true) {
    const sample = [
      {
        sport: 'baseball',
        league: 'mlb',
        gameId: 'demo-mlb-1',
        startTime: new Date(),
        status: 'in',
        period: 'Top 7th',
        clock: '',
        neutralSite: false,
        homeTeam: { id: 'H1', name: 'Home Demo', shortName: 'HOME', abbreviation: 'HOM', score: 3, ranking: null },
        awayTeam: { id: 'A1', name: 'Away Demo', shortName: 'AWAY', abbreviation: 'AWY', score: 3, ranking: null },
        key: 'mlb:demo-mlb-1',
        tags: ['Live', 'Tied', 'Close Game'],
      },
    ];
    return sample;
  }

  const dateIso = yyyymmddToIso(date);
  const selected = ESPN_ENDPOINTS.filter((e) => {
    if (sport && e.sport !== sport) return false;
    if (league && e.league !== league) return false;
    return true;
  });

  const results = await Promise.all(
    selected.map(async (e) => {
      let arr = await fetchLeague({ ...e, date });
      if (e.league === 'mlb' && arr.length === 0) {
        const mlbArr = await fetchMlbStatsSchedule(dateIso);
        arr = mlbArr.length ? mlbArr : arr;
      }
      return arr;
    })
  );

  if (!selected.length && league === 'mlb') {
    const mlbArr = await fetchMlbStatsSchedule(dateIso);
    results.push(mlbArr);
  }

  const flat = results.flat().map((g) => ({ ...g, tags: deriveTags(g) }));

  const doSave = typeof save === 'boolean' ? save : SAVE_TO_DB;
  if (doSave && flat.length) {
    await Promise.all(
      flat.map(async (g) => {
        await LiveScore.findOneAndUpdate(
          { league: g.league, gameId: g.gameId },
          { ...g, lastUpdated: new Date() },
          { upsert: true, setDefaultsOnInsert: true, new: true }
        );
      })
    );
  }

  return flat.sort((a, b) => {
    const at = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
    return at - bt;
  });
}

/* --------------------------- summaries --------------------------- */
function summarize(games) {
  const out = {
    totals: { all: games.length, pre: 0, in: 0, post: 0 },
    bySport: {},
    byLeague: {},
    startingSoon: [],
    liveClose: [],
  };

  for (const g of games) {
    out.totals[g.status] = (out.totals[g.status] || 0) + 1;

    const s = g.sport || 'other';
    const l = g.league || 'other';
    out.bySport[s] = out.bySport[s] || { pre: 0, in: 0, post: 0, total: 0 };
    out.byLeague[l] = out.byLeague[l] || { pre: 0, in: 0, post: 0, total: 0 };

    out.bySport[s][g.status] += 1;
    out.bySport[s].total += 1;

    out.byLeague[l][g.status] += 1;
    out.byLeague[l].total += 1;

    if (g.tags?.includes('Starting Soon')) out.startingSoon.push(g);
    if (g.tags?.includes('Live') && g.tags?.includes('Close Game')) out.liveClose.push(g);
  }
  return out;
}

/* ----------------------------- DB ops & utils ----------------------------- */
async function getSavedFromDB({ sport, league, status, limit = 200, sort = '-updatedAt' } = {}) {
  const q = {};
  if (sport) q.sport = sport;
  if (league) q.league = league;
  if (status) q.status = status;
  const cursor = LiveScore.find(q).sort(sort).limit(limit);
  return cursor.lean();
}
async function clearSavedFromDB({ sport, league, status } = {}) {
  const q = {};
  if (sport) q.sport = sport;
  if (league) q.league = league;
  if (status) q.status = status;
  const res = await LiveScore.deleteMany(q);
  return { deletedCount: res.deletedCount || 0 };
}

module.exports = {
  fetchLiveScores,
  summarize,
  getSavedFromDB,
  clearSavedFromDB,
  fetchMlbLinescore,
};
