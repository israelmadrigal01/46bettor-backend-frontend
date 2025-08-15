// services/cricketService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchCricketData = async () => {
  console.log('\n🏏 Starting Cricket odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/cricket/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const matches = res.data;

    if (!matches || matches.length === 0) {
      console.log('📭 No cricket matches available today.');
      return;
    }

    for (const match of matches) {
      const team1 = match.home_team;
      const team2 = match.away_team;
      const odds = match.bookmakers[0]?.markets[0]?.outcomes;

      const team1Data = new TeamData({
        sport: 'Cricket',
        team: team1,
        odds
      });

      const team2Data = new TeamData({
        sport: 'Cricket',
        team: team2,
        odds
      });

      await team1Data.save();
      await team2Data.save();

      console.log(`💾 Saved odds for ${team1} vs ${team2}`);
    }

    console.log('\n✅ Cricket data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching Cricket odds:', err.message);
  }
};

module.exports = { fetchCricketData };
