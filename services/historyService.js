// services/historyService.js
// Works with your existing HistoricalGame collection shape (homeTeam/awayTeam strings, date, sport, gamePk)
// and also stores newer fields (league, gameId, gameDate) for future-proofing.

'use strict';
const axios = require('axios');
const dayjs = require('dayjs');
const mongoose = require('mongoose');

let HistoricalGame;
try {
  HistoricalGame = mongoose.model('HistoricalGame');
} catch {
  // Fallback schema if the model isn't compiled yet (keeps this file standalone)
  const schema = new mongoose.Schema(
    {
      // legacy fields (these are present in your DB already)
      sport: { type: String, index: true },          // e.g., 'MLB'
      gamePk: { type: Number, index: true },         // legacy id
      date: { type: String, index: true },           // 'YYYY-MM-DD'
      homeTeam: { type: String, index: true },
      awayTeam: { type: String, index: true },
      homeScore: Number,
      awayScore: Number,
      isFinal: { type: Boolean, default: false },

      // newer / richer fields (safe to add)
      league: { type: String, index: true },         // e.g., 'MLB'
      season: { type: Number, index: true },
      gameId: { type: String, index: true },         // normalized id as string
      gameDate: { type: Date, index: true },
      status: { type: String, index: true },
      venue: String,
      winner: { type: String, enum: ['HOME', 'AWAY', 'TIE', null], default: null },
      meta: mongoose.Schema.Types.Mixed,
    },
    { timestamps: true }
  );
  // helpful indexes
  schema.index({ league: 1, gameId: 1 }, { unique: true, sparse: true });
  schema.index({ sport: 1, date: 1 });
  HistoricalGame = mongoose.model('HistoricalGame', schema);
}

/* ============ helpers ============ */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ============ MLB (StatsAPI) FREE ============ */
/**
 * Fetch MLB games for a date range. Dates: 'YYYY-MM-DD'
 * We hydrate team & linescore so we can grab names/scores.
 */
async function fetchMLBRange(startDate, endDate) {
  const url =
    `https://statsapi.mlb.com/api/v1/schedule` +
    `?sportId=1&startDate=${startDate}&endDate=${endDate}` +
    `&hydrate=team,linescore,game,venue`;
  const { data } = await axios.get(url, { timeout: 20000 });

  const out = [];
  for (const d of data?.dates || []) {
    for (const g of d?.games || []) {
      const home = g?.teams?.home;
      const away = g?.teams?.away;
      const homeTeamName = home?.team?.name || null;
      const awayTeamName = away?.team?.name || null;
      const homeScore = toNum(home?.score);
      const awayScore = toNum(away?.score);
      const status =
        g?.status?.detailedState || g?.status?.abstractGameState || 'Unknown';
      const isFinal = status?.toLowerCase().includes('final');

      let winner = null;
      if (homeScore != null && awayScore != null) {
        winner = homeScore > awayScore ? 'HOME' : homeScore < awayScore ? 'AWAY' : 'TIE';
      }

      const gameDateISO = g?.gameDate ? new Date(g.gameDate) : null;
      const dateKey = g?.gameDate ? dayjs(g.gameDate).format('YYYY-MM-DD') : null;
      const season = toNum(g?.season) || (g?.gameDate ? dayjs(g.gameDate).year() : null);
      const gamePk = toNum(g?.gamePk);
      const gameId = g?.gamePk != null ? String(g.gamePk) : null;

      out.push({
        // legacy/flat fields that match your current docs
        sport: 'MLB',
        date: dateKey,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        isFinal,
        gamePk,

        // newer fields for richer queries later
        league: 'MLB',
        season,
        gameId,
        gameDate: gameDateISO,
        status,
        venue: g?.venue?.name || null,
        winner,
        meta: {
          gameType: g?.gameType || null,
          seriesDescription: g?.seriesDescription || null,
          doubleHeader: g?.doubleHeader || null,
          ifNecessary: g?.ifNecessary || null,
        },
      });
    }
  }
  return out;
}

/* ============ Upsert / Backfill ============ */
async function bulkUpsertLegacyFriendly(games) {
  if (!Array.isArray(games) || games.length === 0) return { upserted: 0, modified: 0 };

  const ops = games.map((g) => ({
    updateOne: {
      // prefer league+gameId if present, otherwise fall back to sport+gamePk, otherwise sport+date+teams
      filter: g.league && g.gameId
        ? { league: g.league, gameId: g.gameId }
        : g.sport && g.gamePk != null
          ? { sport: g.sport, gamePk: g.gamePk }
          : { sport: g.sport, date: g.date, homeTeam: g.homeTeam, awayTeam: g.awayTeam },
      update: { $set: g },
      upsert: true,
    },
  }));

  const res = await HistoricalGame.bulkWrite(ops, { ordered: false });
  return {
    upserted: res?.upsertedCount || 0,
    modified: res?.modifiedCount || 0,
    matched: res?.matchedCount || 0,
  };
}

async function backfillRange({ sport, start, end }) {
  const startDate = dayjs(start).format('YYYY-MM-DD');
  const endDate = dayjs(end).format('YYYY-MM-DD');

  if (sport?.toUpperCase() === 'MLB') {
    const games = await fetchMLBRange(startDate, endDate);
    const result = await bulkUpsertLegacyFriendly(games);
    return [{ sport: 'MLB', count: games.length, ...result }];
  }

  // Stubs for other sports; wire later
  return [{ sport, count: 0, upserted: 0, modified: 0, note: 'Only MLB implemented in backfillRange() for now.' }];
}

/* ============ Queries ============ */
async function listByDate({ sport, date, limit = 200, skip = 0 }) {
  const q = {};
  if (sport) q.sport = sport;
  if (date) q.date = date;
  const data = await HistoricalGame.find(q)
    .sort({ gameDate: -1, date: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();
  const total = await HistoricalGame.countDocuments(q);
  return { ok: true, total, count: data.length, data };
}

async function teamRecord({ sport, team, start, end }) {
  const q = { sport };
  if (team) q.$or = [{ homeTeam: team }, { awayTeam: team }];
  if (start || end) {
    q.gameDate = {};
    if (start) q.gameDate.$gte = new Date(dayjs(start).format('YYYY-MM-DD'));
    if (end) q.gameDate.$lte = new Date(dayjs(end).format('YYYY-MM-DD'));
  }

  const games = await HistoricalGame.find(q).lean();
  let wins = 0, losses = 0, ties = 0;
  for (const g of games) {
    if (!g.isFinal && !String(g.status || '').toLowerCase().includes('final')) continue;
    const home = g.homeTeam, away = g.awayTeam;
    const hs = toNum(g.homeScore), as = toNum(g.awayScore);
    if (hs == null || as == null) continue;
    let w = null;
    if (hs > as) w = home;
    else if (as > hs) w = away;
    if (w === team) wins++;
    else if (w == null) ties++;
    else losses++;
  }
  return { ok: true, team, sport, start, end, games: games.length, wins, losses, ties };
}

module.exports = {
  backfillRange,
  listByDate,
  teamRecord,
};
