const axios = require('axios');

async function fetchGamesByDate(date) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team`;
  const { data } = await axios.get(url);
  const games = data?.dates?.[0]?.games || [];
  return games.map(g => ({
    sport: 'MLB',
    gamePk: g.gamePk,
    date,
    homeTeam: g.teams.home.team.name,
    awayTeam: g.teams.away.team.name,
    homeScore: g.teams.home.score ?? null,
    awayScore: g.teams.away.score ?? null,
    status: g.status?.detailedState || '',
    isFinal: g.status?.abstractGameCode === 'F',
    inning: g.linescore?.currentInning ?? null,
    inningHalf: g.linescore?.inningHalf ?? null
  }));
}

module.exports = { fetchGamesByDate };
