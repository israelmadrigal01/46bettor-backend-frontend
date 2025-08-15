// services/nascarService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchNASCARData = async () => {
  console.log('\n🏁 Starting NASCAR odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/motorsport_nascar/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const races = res.data;

    if (!races || races.length === 0) {
      console.log('📭 No NASCAR races available today.');
      return;
    }

    for (const race of races) {
      const driver1 = race.home_team;
      const driver2 = race.away_team;
      const odds = race.bookmakers[0]?.markets[0]?.outcomes;

      const driver1Data = new TeamData({
        sport: 'NASCAR',
        team: driver1,
        odds
      });

      const driver2Data = new TeamData({
        sport: 'NASCAR',
        team: driver2,
        odds
      });

      await driver1Data.save();
      await driver2Data.save();

      console.log(`💾 Saved odds for ${driver1} vs ${driver2}`);
    }

    console.log('\n✅ NASCAR data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching NASCAR odds:', err.message);
  }
};

module.exports = { fetchNASCARData };
