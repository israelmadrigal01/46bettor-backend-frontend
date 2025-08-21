// integrations/footballdata.js (CommonJS)
const { getJson } = require('../integrations/http');

const BASE = 'https://api.football-data.org/v4';
const TOKEN = process.env.FOOTBALL_DATA_API_KEY || '';

function authHeaders() {
  if (!TOKEN) throw new Error('FOOTBALL_DATA_API_KEY missing');
  return { 'X-Auth-Token': TOKEN };
}

// comp codes: PL, PD, BL1, SA, FL1, CL
async function soccerMatchesByDate({ comp = 'PL', isoDate }) {
  const url = new URL(`${BASE}/competitions/${encodeURIComponent(comp)}/matches`);
  url.searchParams.set('dateFrom', isoDate);
  url.searchParams.set('dateTo', isoDate);
  const raw = await getJson(url.toString(), { headers: authHeaders() });

  return (raw?.matches || []).map(m => ({
    provider: 'football-data',
    sport: 'SOCCER',
    league: comp,
    id: String(m.id),
    startsAt: m.utcDate,
    status: m.status, // SCHEDULED/LIVE/FINISHED
    homeTeam: m.homeTeam?.name,
    awayTeam: m.awayTeam?.name,
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    venue: undefined,
    extras: { stage: m.stage, matchday: m.matchday },
  }));
}

module.exports = { soccerMatchesByDate };
