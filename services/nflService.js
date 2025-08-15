// services/nflService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchNFLData = async () => {
  console.log('\n🏈 Starting NFL odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const games = res.data;

    for (const game of games) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const odds = game.bookmakers[0]?.markets[0]?.outcomes;

      const entryHome = new TeamData({
        sport: 'NFL',
        team: homeTeam,
        odds
      });

      const entryAway = new TeamData({
        sport: 'NFL',
        team: awayTeam,
        odds
      });

      await entryHome.save();
      await entryAway.save();

      console.log(`💾 Saved odds for ${homeTeam} and ${awayTeam}`);
    }

    console.log('\n✅ NFL data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching NFL odds:', err.message);
  }
};

module.exports = { fetchNFLData };
