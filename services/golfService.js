// services/golfService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchGolfData = async () => {
  console.log('\n⛳ Starting Golf odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/golf_pga/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const events = res.data;

    for (const event of events) {
      const golfer1 = event.home_team;
      const golfer2 = event.away_team;
      const odds = event.bookmakers[0]?.markets[0]?.outcomes;

      const golfer1Data = new TeamData({
        sport: 'Golf',
        team: golfer1,
        odds
      });

      const golfer2Data = new TeamData({
        sport: 'Golf',
        team: golfer2,
        odds
      });

      await golfer1Data.save();
      await golfer2Data.save();

      console.log(`💾 Saved odds for ${golfer1} vs ${golfer2}`);
    }

    console.log('\n✅ Golf data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching Golf odds:', err.message);
  }
};

module.exports = { fetchGolfData };
