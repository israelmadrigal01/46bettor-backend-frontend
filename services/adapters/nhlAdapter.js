/* eslint-disable */ // @ts-nocheck
'use strict';
const dayjs = require('dayjs');
const { httpGet } = require('../ext/http');

// ✅ Use the new NHL Web API (NOT statsapi)
/**
 * Docs / examples (unofficial but accurate):
 *  - standings:  https://api-web.nhle.com/v1/standings/now
 *  - schedule:   https://api-web.nhle.com/v1/schedule/now  or /v1/score/now
 *  - team season schedule: /v1/club-schedule-season/{TEAM}/{SEASON_YYYYYYYY}
 */
const API_WEB = 'https://api-web.nhle.com/v1';

/**
 * Normalize a game (best-effort; schema varies slightly per endpoint).
 */
function mapGameWeb(g) {
  // Handle multiple shapes: some endpoints use "homeTeam", others "homeAbbrev"
  const homeName = g?.homeTeam?.name || g?.homeTeam?.placeName?.default || g?.homeAbbrev || g?.homeTeam || null;
  const awayName = g?.awayTeam?.name || g?.awayTeam?.placeName?.default || g?.awayAbbrev || g?.awayTeam || null;
  const homeScore = g?.homeTeam?.score ?? g?.homeScore ?? null;
  const awayScore = g?.awayTeam?.score ?? g?.awayScore ?? null;

  return {
    id: g?.id || g?.gameId || g?.gamePk || null,
    dateUTC: g?.startTimeUTC || g?.gameDate || g?.startTime || null,
    status: g?.gameState || g?.gameStatus || g?.status || null,
    venue: g?.venue?.default || g?.venue || null,
    home: { name: homeName, score: homeScore },
    away: { name: awayName, score: awayScore },
    raw: g
  };
}

/** Today / "now" */
async function fetchToday() {
  // prefer scoreboard/now for concise list or score/now for details
  const data = await httpGet(`${API_WEB}/score/now`, { timeout: 15000, retries: 2 });
  const games = (data?.games || data?.gameWeek || data?.gamesByDate || [])
    .flat?.() || data?.games || [];
  const list = Array.isArray(games) ? games : [];
  return list.map(mapGameWeb);
}

/** Standings (as of now) */
async function fetchStandings() {
  const data = await httpGet(`${API_WEB}/standings/now`, { timeout: 15000, retries: 2 });
  // Return as-is plus a simple projection
  const teams = Array.isArray(data?.standings) ? data.standings : data;
  return teams;
}

/**
 * Team season schedule using team 3-letter code and season YYYYYYYY (e.g., 20232024).
 * If user passes ?season=2023 we transform -> 20232024.
 */
function toSeasonKey(s) {
  const str = String(s);
  if (str.length === 8) return str;
  if (str.length === 4) return `${str}${Number(str) + 1}`;
  if (str.includes('-')) {
    const [a,b] = str.split('-');
    if (a?.length === 4 && b?.length >= 2) return `${a}${a.slice(0,2)}${b}`;
  }
  // fallback: current NHL season guess by month
  const now = dayjs();
  const y = now.month() >= 6 ? now.year() : now.year() - 1; // season starts ~Oct (month 9), buffer to July
  return `${y}${y+1}`;
}

/** Full season schedule by team code + season key */
async function fetchTeamScheduleSeason({ teamCode, season }) {
  if (!teamCode) throw new Error('Missing team code (e.g., TOR, BOS)');
  const seasonKey = toSeasonKey(season || dayjs().year());
  const url = `${API_WEB}/club-schedule-season/${teamCode.toUpperCase()}/${seasonKey}`;
  const data = await httpGet(url, { timeout: 15000, retries: 2 });

  // Data shape: likely { games: [] } or nested arrays; normalize best-effort
  const games = data?.games || data?.gameWeek || data?.gamesByDate || data || [];
  const flat = Array.isArray(games?.flat?.()) ? games.flat() : (Array.isArray(games) ? games : []);
  return flat.map(mapGameWeb);
}

/** Helper to validate 3-letter codes quickly */
const TEAM_CODES = new Set([
  'ANA','ARI','BOS','BUF','CGY','CAR','CHI','COL','CBJ','DAL','DET','EDM','FLA','LAK','MIN','MTL','NJD','NSH','NYI','NYR','OTT','PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK','WPG','WSH'
  // Note: UTA = Utah (formerly ARI / PHX moved), LAK code per NHL site
]);

module.exports = {
  fetchToday,
  fetchStandings,
  fetchTeamScheduleSeason,
  TEAM_CODES
};
