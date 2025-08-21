// integrations/mysportsfeeds.js (CommonJS)
const { getJson } = require('../integrations/http');

const BASE = 'https://api.mysportsfeeds.com/v2.1/pull';
const KEY  = process.env.MYSPORTSFEEDS_API_KEY || '';

function msfAuth() {
  if (!KEY) throw new Error('MYSPORTSFEEDS_API_KEY missing');
  const token = Buffer.from(`${KEY}:MYSPORTSFEEDS`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function yyyymmdd(iso) { return String(iso).replace(/-/g, ''); }

async function msfGamesByDate({ sport /* mlb|nba|nhl|nfl */, isoDate }) {
  const league = String(sport).toLowerCase();
  const date = yyyymmdd(isoDate);
  const url = `${BASE}/${league}/current/date/${date}/games.json`;
  const raw = await getJson(url, { headers: msfAuth() }); // { games: [...] }

  return (raw?.games || []).map(g => {
    const sch = g.schedule || {};
    const sc  = g.score || {};
    return {
      provider: 'mysportsfeeds',
      sport: league.toUpperCase(),
      league: league.toUpperCase(),
      id: String(g.gameId || `${league}-${date}-${sch.homeTeam?.abbreviation}-${sch.awayTeam?.abbreviation}`),
      startsAt: sch.startTime || sch.startTimeLocal || null,
      status: sc.isUnplayed ? 'SCHEDULED' : (sc.isCompleted ? 'FINAL' : 'IN_PROGRESS'),
      homeTeam: sch.homeTeam?.name || sch.homeTeam?.abbreviation,
      awayTeam: sch.awayTeam?.name || sch.awayTeam?.abbreviation,
      homeScore: sc.homeScoreTotal ?? null,
      awayScore: sc.awayScoreTotal ?? null,
      venue: sch.venue?.name,
      extras: { home: sch.homeTeam, away: sch.awayTeam },
    };
  });
}

module.exports = { msfGamesByDate };
