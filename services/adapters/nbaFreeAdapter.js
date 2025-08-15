/* eslint-disable */ // @ts-nocheck
'use strict';
const dayjs = require('dayjs');
const { httpGet } = require('../ext/http');

const CDN   = 'https://cdn.nba.com/static/json';
const DATA  = 'https://data.nba.com/data/10s/prod/v1';
const ESPN1 = 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba';
const ESPN2 = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// ---------- tiny in-memory cache (60s) ----------
const CACHE = new Map();
function cacheGet(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) { CACHE.delete(key); return null; }
  return hit.val;
}
function cacheSet(key, val, ttlMs = 60_000) {
  CACHE.set(key, { val, exp: Date.now() + ttlMs });
}

const toInt = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const yyyymmdd = (d) => dayjs(d).format('YYYYMMDD');
const ymdISO   = (d) => dayjs(d).format('YYYY-MM-DD');

// ---------- mappers ----------
function mapCdnScoreboardGame(g) {
  const home = g.homeTeam || g.hTeam || {};
  const away = g.awayTeam || g.vTeam || {};
  const hName = [home.teamCity || home.city, home.teamName || home.name].filter(Boolean).join(' ') || home.teamTricode || home.triCode || null;
  const aName = [away.teamCity || away.city, away.teamName || away.name].filter(Boolean).join(' ') || away.teamTricode || away.triCode || null;
  return {
    id: g.gameId || g.gameCode || null,
    dateUTC: g.gameDateTimeUTC || g.gameTimeUTC || g.startTimeUTC || null,
    status: g.gameStatusText || g.gameStatus || g.gameState || null,
    period: g.period || g.periodValue || null,
    clock: g.gameClock || g.clock || null,
    venue: g.arenaName || g.venue || null,
    home: { name: hName, tri: home.teamTricode || home.triCode || null, score: toInt(home.score) },
    away: { name: aName, tri: away.teamTricode || away.triCode || null, score: toInt(away.score) },
    raw: g
  };
}
function mapCdnScheduleGame(g, dateISO) {
  const homeName = [g.homeTeam?.teamCity, g.homeTeam?.teamName].filter(Boolean).join(' ') || g.homeTeam?.teamTricode || null;
  const awayName = [g.awayTeam?.teamCity, g.awayTeam?.teamName].filter(Boolean).join(' ') || g.awayTeam?.teamTricode || null;
  return {
    id: g.gameId || g.gameCode || null,
    dateUTC: g.gameDateUTC || g.gameDateTimeUTC || null,
    status: g.gameStatusText || g.gameStatus || 'FUT',
    period: null,
    clock: null,
    venue: g.arenaName || null,
    home: { name: homeName, tri: g.homeTeam?.teamTricode || null, score: null },
    away: { name: awayName, tri: g.awayTeam?.teamTricode || null, score: null },
    dateISO,
    raw: g
  };
}
function mapDataScoreboardGame(g) {
  const h = g.hTeam || {};
  const a = g.vTeam || {};
  const statusNum = Number(g.statusNum || g.gameStatus || 0);
  const status = statusNum === 3 ? 'Final' : statusNum === 2 ? 'Live' : 'FUT';
  return {
    id: g.gameId || g.gameCode || null,
    dateUTC: g.startTimeUTC || g.startTimeEastern || null,
    status,
    period: g.period?.current ?? null,
    clock: g.clock ?? null,
    venue: g.arena?.name || null,
    home: { name: [h.teamCity, h.nickName].filter(Boolean).join(' ') || h.triCode, tri: h.triCode || null, score: toInt(h.score) },
    away: { name: [a.teamCity, a.nickName].filter(Boolean).join(' ') || a.triCode, tri: a.triCode || null, score: toInt(a.score) },
    raw: g
  };
}
function mapEspnEvent(ev) {
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const teams = comp.competitors || [];
  const home = teams.find(t => t.homeAway === 'home') || {};
  const away = teams.find(t => t.homeAway === 'away') || {};
  const homeName = home.team?.shortDisplayName || home.team?.displayName || home.team?.abbreviation || null;
  const awayName = away.team?.shortDisplayName || away.team?.displayName || away.team?.abbreviation || null;
  const state = ev?.status?.type?.state || comp?.status?.type?.state;
  const status = state === 'post' ? 'Final' : state === 'in' ? 'Live' : 'FUT';
  return {
    id: ev.id || comp.id || null,
    dateUTC: ev.date || comp.date || null,
    status,
    period: comp?.status?.period ?? null,
    clock: comp?.status?.displayClock ?? null,
    venue: comp?.venue?.fullName || null,
    home: { name: homeName, tri: home.team?.abbreviation || null, score: toInt(home.score) },
    away: { name: awayName, tri: away.team?.abbreviation || null, score: toInt(away.score) },
    raw: ev
  };
}

// ---------- shards for regular season ----------
function scheduleUrls() {
  const base = `${CDN}/staticData/scheduleLeagueV2`;
  const urls = [
    `${base}.json`,
    `${CDN}/staticData/staticData/scheduleLeagueV2.json`
  ];
  for (let i = 1; i <= 24; i++) {
    urls.push(`${base}_${i}.json`);
    urls.push(`${CDN}/staticData/staticData/scheduleLeagueV2_${i}.json`);
  }
  return urls;
}
function pushGamesByDate(destMap, arr) {
  for (const d of arr || []) {
    const iso = d.gameDate || d.date;
    if (!iso) continue;
    const bucket = destMap.get(iso) || { date: iso, games: [], ids: new Set() };
    for (const g of (d.games || [])) {
      const gid = g.gameId || g.gameCode || g.gameUuid || `${g.gameDateUTC}-${g.homeTeam?.teamTricode}-${g.awayTeam?.teamTricode}`;
      if (!bucket.ids.has(gid)) { bucket.ids.add(gid); bucket.games.push(g); }
    }
    destMap.set(iso, bucket);
  }
}

// ---------- low-level fetchers ----------
async function cdnScoreboardByDate(date) {
  const ymd = yyyymmdd(date);
  const d = await httpGet(`${CDN}/liveData/scoreboard/scoreboard_${ymd}.json`, {
    timeout: 20000, retries: 2,
    headers: { Referer: 'https://www.nba.com/scores', Origin: 'https://www.nba.com' },
  });
  const list = d?.scoreboard?.games || [];
  return { source: 'cdn', count: list.length, items: list.map(mapCdnScoreboardGame) };
}
async function dataScoreboardByDate(date) {
  const ymd = yyyymmdd(date);
  const d = await httpGet(`${DATA}/${ymd}/scoreboard.json`, { timeout: 20000, retries: 2 });
  const list = d?.games || [];
  return { source: 'data', count: list.length, items: list.map(mapDataScoreboardGame) };
}
async function espnScoreboardByDate(date) {
  const ymd = yyyymmdd(date);
  try {
    const d1 = await httpGet(`${ESPN1}/scoreboard?dates=${ymd}&regions=us&lang=en&tz=America/New_York`, {
      timeout: 12000, retries: 1
    });
    const ev = d1?.events || [];
    if (ev.length) return { source: 'espn', count: ev.length, items: ev.map(mapEspnEvent) };
  } catch (_) {}
  try {
    const d2 = await httpGet(`${ESPN2}/scoreboard?dates=${ymd}&region=us&lang=en&calendartype=blacklist`, {
      timeout: 12000, retries: 1
    });
    const ev2 = d2?.events || [];
    if (ev2.length) return { source: 'espn2', count: ev2.length, items: ev2.map(mapEspnEvent) };
  } catch (_) {}
  return { source: 'espn2', count: 0, items: [] };
}

// ---------- public API ----------
async function fetchNBAToday() {
  const cacheKey = 'sb:today';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const d = await httpGet(`${CDN}/liveData/scoreboard/todaysScoreboard_00.json`, {
      timeout: 8000, retries: 1,
      headers: { Referer: 'https://www.nba.com/scores', Origin: 'https://www.nba.com' },
    });
    const list = d?.scoreboard?.games || [];
    if (list.length) {
      const out = { items: list.map(mapCdnScoreboardGame), source: 'cdn', trace: { cdn: list.length } };
      cacheSet(cacheKey, out);
      return out;
    }
  } catch (_) {}

  const es = await espnScoreboardByDate(dayjs());
  const out = { items: es.items, source: es.source, trace: { [es.source]: es.count } };
  cacheSet(cacheKey, out);
  return out;
}

async function fetchNBAScoreboardByDate(date, prefer) {
  const ymd = ymdISO(date);
  const cacheKey = `sb:${ymd}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const order = (prefer && Array.isArray(prefer))
    ? prefer
    : ['espn2', 'espn', 'cdn', 'data'];

  const trace = {};
  for (const src of order) {
    try {
      let out;
      if (src === 'espn2' || src === 'espn') { out = await espnScoreboardByDate(date); trace[out.source] = out.count; if (out.count) { const res = { items: out.items, source: out.source, trace, date: ymd }; cacheSet(cacheKey, res); return res; } }
      if (src === 'cdn')  { out = await cdnScoreboardByDate(date);  trace.cdn  = out.count; if (out.count) { const res = { items: out.items, source: 'cdn',  trace, date: ymd }; cacheSet(cacheKey, res); return res; } }
      if (src === 'data') { out = await dataScoreboardByDate(date); trace.data = out.count; if (out.count) { const res = { items: out.items, source: 'data', trace, date: ymd }; cacheSet(cacheKey, res); return res; } }
    } catch (e) {
      trace[src] = `error:${e?.message || 'err'}`;
    }
  }
  const res = { items: [], source: order.join('>'), trace, date: ymd };
  cacheSet(cacheKey, res);
  return res;
}

// ---- FAST next-day finder (parallel, with per-batch timeout) ----
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms))
  ]);
}

async function fetchNBANextDayWithGames({ from, horizonDays = 120, batchSize = 7, batchTimeoutMs = 4000 }, prefer) {
  const start = from ? dayjs(from) : dayjs();
  const dates = [];
  for (let i = 0; i <= horizonDays; i++) dates.push(start.add(i, 'day').format('YYYY-MM-DD'));

  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    const reqs = batch.map(d =>
      withTimeout(
        fetchNBAScoreboardByDate(d, prefer || ['espn2','espn','cdn','data']),
        batchTimeoutMs
      ).then(out => ({ ok: true, d, out })).catch(err => ({ ok: false, d, err }))
    );

    const results = await Promise.allSettled(reqs);

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok && r.value.out.items.length) {
        const { d, out } = r.value;
        return { date: d, items: out.items, source: out.source, trace: { ...out.trace, via: `parallel_probe(b=${batchSize},t=${batchTimeoutMs}ms)` } };
      }
    }
  }
  return { date: null, items: [], source: 'none', trace: { searchedDays: horizonDays + 1, via: 'parallel_probe' } };
}

async function fetchNBASchedule({ date }, prefer) {
  if (date) {
    return fetchNBAScoreboardByDate(date, prefer);
  }

  const cacheKey = 'sb:upcoming';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const urls = scheduleUrls();
  const byDate = new Map();
  const trace = { shards: 0 };
  for (const url of urls) {
    try {
      const data = await httpGet(url, { timeout: 20000, retries: 1 });
      const days = data?.leagueSchedule?.gameDates || data?.leagueSchedule?.gameDatesV2 || [];
      if (Array.isArray(days) && days.length) { pushGamesByDate(byDate, days); trace.shards++; }
    } catch (_) {}
  }
  if (byDate.size === 0) return { items: [], source: 'cdn-shards', trace };

  const today = ymdISO(new Date());
  const allDates = Array.from(byDate.keys()).sort();
  const upcoming = [];
  for (const iso of allDates) {
    if (iso >= today) {
      const entry = byDate.get(iso);
      for (const g of (entry?.games || [])) upcoming.push(mapCdnScheduleGame(g, iso));
      if (upcoming.length >= 30) break;
    }
  }
  const res = { items: upcoming, source: 'cdn-shards', trace };
  cacheSet(cacheKey, res);
  return res;
}

module.exports = {
  fetchNBAToday,
  fetchNBAScoreboardByDate,
  fetchNBANextDayWithGames,
  fetchNBASchedule
};
