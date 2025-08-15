// services/scoresService.js
const axios = require('axios');

const ODDS_API_KEY = process.env.ODDS_API_KEY;

async function getLiveScores(sport = 'baseball_mlb') {
  try {
    const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/scores`, {
      params: {
        apiKey: ODDS_API_KEY
      }
    });

    return response.data.map(game => ({
      id: game.id,
      sport: game.sport_title,
      commence_time: game.commence_time,
      home_team: game.home_team,
      away_team: game.away_team,
      completed: game.completed,
      scores: game.scores,
      last_update: game.last_update
    }));
  } catch (error) {
    console.error('❌ Error fetching live scores:', error.message);
    return null;
  }
}

module.exports = { getLiveScores };
