// services/horseRacingService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchHorseRacingData = async () => {
  console.log('\n🐎 Starting Horse Racing odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/racing_us/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const races = res.data;

    if (!races || races.length === 0) {
      console.log('📭 No horse races available today.');
      return;
    }

    for (const race of races) {
      const runner1 = race.home_team;
      const runner2 = race.away_team;
      const odds = race.bookmakers[0]?.markets[0]?.outcomes;

      const entry1 = new TeamData({
        sport: 'Horse Racing',
        team: runner1,
        odds
      });

      const entry2 = new TeamData({
        sport: 'Horse Racing',
        team: runner2,
        odds
      });

      await entry1.save();
      await entry2.save();

      console.log(`💾 Saved odds for ${runner1} vs ${runner2}`);
    }

    console.log('\n✅ Horse Racing data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching Horse Racing odds:', err.message);
  }
};

module.exports = { fetchHorseRacingData };
