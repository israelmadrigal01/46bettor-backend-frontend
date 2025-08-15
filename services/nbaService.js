// services/nbaService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchNBAData = async () => {
  console.log('\n🏀 Starting NBA odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const games = res.data;

    for (const game of games) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const odds = game.bookmakers[0]?.markets[0]?.outcomes;

      const entryHome = new TeamData({
        sport: 'NBA',
        team: homeTeam,
        odds
      });

      const entryAway = new TeamData({
        sport: 'NBA',
        team: awayTeam,
        odds
      });

      await entryHome.save();
      await entryAway.save();

      console.log(`💾 Saved odds for ${homeTeam} and ${awayTeam}`);
    }

    console.log('\n✅ NBA data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching NBA odds:', err.message);
  }
};

module.exports = { fetchNBAData };
