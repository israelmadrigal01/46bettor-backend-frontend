const axios = require('axios'); // balldontlie API

async function fetchGamesByDate(date) {
  const url = `https://www.balldontlie.io/api/v1/games?dates[]=${date}&per_page=100`;
  const { data } = await axios.get(url);
  const games = data?.data || [];
  return games.map(g => ({
    sport: 'NBA',
    gamePk: g.id,
    date,
    homeTeam: g.home_team?.full_name || g.home_team?.name || 'Home',
    awayTeam: g.visitor_team?.full_name || g.visitor_team?.name || 'Away',
    homeScore: g.home_team_score ?? null,
    awayScore: g.visitor_team_score ?? null,
    status: String(g.status || ''),
    isFinal: String(g.status || '').toLowerCase().includes('final'),
    inning: null,
    inningHalf: null
  }));
}

module.exports = { fetchGamesByDate };
