// integrations/balldontlie.js
// BallDontLie v1 client. Always sends Authorization: Bearer <key>.

const axios = require('axios');

const API_BASE = 'https://api.balldontlie.io/v1';

// Accept either env var name
function getKey() {
  return process.env.BALLDONTLIE_API_KEY || process.env.BALLDONTLIE_KEY || '';
}

function authHeaders() {
  const k = getKey();
  return k ? { Authorization: `Bearer ${k}` } : {};
}

// Fetch games for a single date YYYY-MM-DD
async function gamesByDate(dateStr) {
  const url = `${API_BASE}/games`;
  const params = { 'dates[]': dateStr, per_page: 100 };

  const res = await axios.get(url, {
    params,
    headers: { Accept: 'application/json', ...authHeaders() },
    timeout: 15000,
    validateStatus: () => true, // let us throw a useful error below
  });

  if (res.status !== 200) {
    const qs = `dates[]=${dateStr}&per_page=100`;
    let body = res.data;
    try { body = typeof body === 'string' ? body : JSON.stringify(body); } catch (_) {}
    throw new Error(
      `GET ${url}?${qs} -> ${res.status} ${res.statusText} ${String(body).slice(0,200)}`
    );
  }

  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  const items = rows.map((g) => ({
    provider: 'balldontlie',
    sport: 'NBA',
    league: 'NBA',
    id: String(g.id),
    startsAt: g.date ? new Date(g.date).toISOString() : null,
    status: g.status || null,
    homeTeam: g.home_team?.full_name || g.home_team?.name || null,
    awayTeam: g.visitor_team?.full_name || g.visitor_team?.name || null,
    homeScore: g.home_team_score ?? null,
    awayScore: g.visitor_team_score ?? null,
    extras: { season: g.season },
  }));

  return { ok: true, count: items.length, items };
}

// Export both names so older routes still work
module.exports = {
  gamesByDate,
  nbaGamesByDate: gamesByDate,
  getKey,
};
