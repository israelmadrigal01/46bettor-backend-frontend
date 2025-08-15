/* eslint-disable */ // @ts-nocheck
'use strict';
const express = require('express');
const router = express.Router();
const {
  fetchToday,
  fetchStandings,
  fetchTeamScheduleSeason,
  TEAM_CODES
} = require('../services/adapters/nhlAdapter');

/* ---------- small helpers ---------- */
function toBool(v, def=false){
  if (v === undefined) return def;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return ['1','true','yes','y','on'].includes(s);
}

function pick(obj, fieldsCsv){
  if (!fieldsCsv) return obj;
  const fields = String(fieldsCsv).split(',').map(s=>s.trim()).filter(Boolean);
  const out = {};
  for (const f of fields){
    // shallow pick only (simple + fast)
    if (obj != null && Object.prototype.hasOwnProperty.call(obj, f)){
      out[f] = obj[f];
    }
  }
  return out;
}

function compactGame(g){
  return {
    id: g.id ?? g.gameId ?? g.gamePk ?? null,
    dateUTC: g.dateUTC ?? g.startTimeUTC ?? g.startTime ?? null,
    status: g.status ?? g.gameState ?? g.gameStatus ?? null,
    venue: typeof g.venue === 'string' ? g.venue : (g.venue?.default ?? null),
    home: {
      name: typeof g.home?.name === 'string' ? g.home.name : (g.home?.name?.default ?? g.home ?? null),
      score: g.home?.score ?? null,
    },
    away: {
      name: typeof g.away?.name === 'string' ? g.away.name : (g.away?.name?.default ?? g.away ?? null),
      score: g.away?.score ?? null,
    },
  };
}

function applyView(items, { compact=true, fields, limit }){
  let out = Array.isArray(items) ? items : [];
  if (compact) out = out.map(compactGame);
  if (fields) out = out.map(x => pick(x, fields));
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

/* ---------- endpoints ---------- */

/**
 * GET /api/nhl-free/today
 * Query:
 *   - compact=1 (default) → small objects
 *   - raw=1              → include raw item under each object (big)
 *   - fields=id,dateUTC,status,venue,home,away
 *   - limit=10
 */
router.get('/today', async (req, res) => {
  try {
    const compact = toBool(req.query.compact, true);
    const includeRaw = toBool(req.query.raw, false);
    const { fields, limit } = req.query;

    const games = await fetchToday();
    let data = applyView(games, { compact, fields, limit });

    if (includeRaw) {
      // stitch raw back by index to avoid heavy default payloads
      data = data.map((d, i) => ({ ...d, raw: games[i] }));
    }

    res.json({ ok: true, count: data.length, games: data });
  } catch (e) {
    console.error('[nhl-free:today]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/nhl-free/standings
 * Query:
 *   - compact=1 (default) → team, points, division, conference, record
 *   - raw=1               → include original row
 *   - limit=32
 *   - fields=teamName,points,division,conference
 */
router.get('/standings', async (req, res) => {
  try {
    const compact = toBool(req.query.compact, true);
    const includeRaw = toBool(req.query.raw, false);
    const { fields, limit } = req.query;

    const table = await fetchStandings();

    let rows = Array.isArray(table) ? table : [];

    if (compact) {
      rows = rows.map(r => ({
        teamName: r?.teamName?.default || r?.teamCommonName?.default || r?.teamAbbrev || r?.teamName || null,
        teamAbbrev: r?.teamAbbrev || null,
        points: r?.points ?? r?.pts ?? null,
        division: r?.divisionName ?? r?.divisionNameShort ?? null,
        conference: r?.conferenceName ?? null,
        record: r?.record || {
          wins: r?.wins ?? r?.w,
          losses: r?.losses ?? r?.l,
          ot: r?.otLosses ?? r?.ot,
        },
      }));
    }

    if (fields) rows = rows.map(x => pick(x, fields));
    if (limit) rows = rows.slice(0, Number(limit));
    if (includeRaw) {
      rows = rows.map((row, i) => ({ ...row, raw: table[i] }));
    }

    res.json({ ok: true, count: rows.length, standings: rows });
  } catch (e) {
    console.error('[nhl-free:standings]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/nhl-free/team-schedule
 * Query:
 *   - team=TOR (required)  → 3-letter NHL code
 *   - season=2023 (optional; also accepts 20232024)
 *   - compact=1 (default)
 *   - raw=0/1
 *   - fields=...
 *   - limit=20
 */
router.get('/team-schedule', async (req, res) => {
  try {
    const team = (req.query.team || req.query.teamCode || '').toUpperCase();
    const season = req.query.season;
    const compact = toBool(req.query.compact, true);
    const includeRaw = toBool(req.query.raw, false);
    const { fields, limit } = req.query;

    if (!team || !TEAM_CODES.has(team)) {
      return res.status(400).json({
        ok: false,
        error: 'Missing or invalid team (use 3-letter code, e.g. TOR, BOS, DAL).',
        validExamples: Array.from(TEAM_CODES).slice(0, 10).join(', ') + ' ...',
      });
    }

    const games = await fetchTeamScheduleSeason({ teamCode: team, season });
    let data = applyView(games, { compact, fields, limit });
    if (includeRaw) data = data.map((d, i) => ({ ...d, raw: games[i] }));

    res.json({ ok: true, team, season: season || null, count: data.length, games: data });
  } catch (e) {
    console.error('[nhl-free:team-schedule]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** Optional: list team codes */
router.get('/team-codes', (_req, res) => {
  res.json({ ok: true, count: TEAM_CODES.size, teams: Array.from(TEAM_CODES).sort() });
});

module.exports = router;
