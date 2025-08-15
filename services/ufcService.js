// services/ufcService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchUFCData = async () => {
  console.log('\n🥋 Starting UFC odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const fights = res.data;

    for (const fight of fights) {
      const fighter1 = fight.home_team;
      const fighter2 = fight.away_team;
      const odds = fight.bookmakers[0]?.markets[0]?.outcomes;

      const fighter1Data = new TeamData({
        sport: 'UFC',
        team: fighter1,
        odds
      });

      const fighter2Data = new TeamData({
        sport: 'UFC',
        team: fighter2,
        odds
      });

      await fighter1Data.save();
      await fighter2Data.save();

      console.log(`💾 Saved odds for ${fighter1} vs ${fighter2}`);
    }

    console.log('\n✅ UFC data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching UFC odds:', err.message);
  }
};

module.exports = { fetchUFCData };
