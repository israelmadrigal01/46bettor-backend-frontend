// integrations/balldontlie.js (CommonJS)
const { getJson } = require('../integrations/http');

const BASE = 'https://api.balldontlie.io/v1';
const KEY  = process.env.BALLDONTLIE_KEY || ''; // optional

async function nbaGamesByDate(isoDate /* YYYY-MM-DD */) {
  const url = new URL(`${BASE}/games`);
  url.searchParams.set('dates[]', isoDate);
  url.searchParams.set('per_page', '100');
  const headers = KEY ? { Authorization: KEY } : {};
  const raw = await getJson(url.toString(), { headers });

  return (raw?.data || []).map(g => ({
    provider: 'balldontlie',
    sport: 'NBA',
    league: 'NBA',
    id: String(g.id),
    startsAt: g.date,
    status: g.status, // Final / Scheduled / In Progress
    homeTeam: g.home_team?.full_name,
    awayTeam: g.visitor_team?.full_name,
    homeScore: g.home_team_score,
    awayScore: g.visitor_team_score,
    venue: undefined,
    extras: { season: g.season },
  }));
}

module.exports = { nbaGamesByDate };
