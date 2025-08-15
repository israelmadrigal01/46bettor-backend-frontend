const axios = require('axios');

const getMLBHistoricalGames = async (req, res) => {
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: 'Missing ?date=YYYY-MM-DD' });

  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team,game(content(summary))`;
    const response = await axios.get(url);
    const games = response.data.dates[0]?.games || [];

    const formatted = games.map((game) => ({
      gamePk: game.gamePk,
      homeTeam: game.teams.home.team.name,
      awayTeam: game.teams.away.team.name,
      homeScore: game.teams.home.score,
      awayScore: game.teams.away.score,
      status: game.status.detailedState,
      isFinal: game.status.abstractGameCode === 'F',
      inning: game.linescore?.currentInning,
      inningHalf: game.linescore?.inningHalf,
    }));

    res.json({ date, games: formatted });
  } catch (err) {
    console.error('Error fetching historical MLB games:', err.message);
    res.status(500).json({ error: 'Failed to fetch historical games' });
  }
};

module.exports = { getMLBHistoricalGames };
