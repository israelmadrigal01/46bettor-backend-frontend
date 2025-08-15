// services/tennisService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchTennisData = async () => {
  console.log('\n🎾 Starting Tennis odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/tennis_atp/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const matches = res.data;

    for (const match of matches) {
      const player1 = match.home_team;
      const player2 = match.away_team;
      const odds = match.bookmakers[0]?.markets[0]?.outcomes;

      const entryPlayer1 = new TeamData({
        sport: 'Tennis',
        team: player1,
        odds
      });

      const entryPlayer2 = new TeamData({
        sport: 'Tennis',
        team: player2,
        odds
      });

      await entryPlayer1.save();
      await entryPlayer2.save();

      console.log(`💾 Saved odds for ${player1} vs ${player2}`);
    }

    console.log('\n✅ Tennis data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching Tennis odds:', err.message);
  }
};

module.exports = { fetchTennisData };
