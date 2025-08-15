const axios = require('axios');

const getTodayGames = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}`;

    const response = await axios.get(url);
    const games = response.data.dates?.[0]?.games || [];

    return games.map(game => ({
      gamePk: game.gamePk,
      date: game.gameDate,
      status: game.status.detailedState,
      homeTeam: game.teams.home.team.name,
      awayTeam: game.teams.away.team.name,
      venue: game.venue.name,
    }));
  } catch (error) {
    console.error('Error fetching MLB games:', error);
    return [];
  }
};

module.exports = { getTodayGames };
