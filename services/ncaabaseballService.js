// services/ncaabaseballService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchNCAABaseballData = async () => {
  console.log('\n⚾ Starting College Baseball odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/baseball_ncaa/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const games = res.data;

    if (!games || games.length === 0) {
      console.log('📭 No college baseball games available today.');
      return;
    }

    for (const game of games) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const odds = game.bookmakers[0]?.markets[0]?.outcomes;

      const homeEntry = new TeamData({
        sport: 'College Baseball',
        team: homeTeam,
        odds
      });

      const awayEntry = new TeamData({
        sport: 'College Baseball',
        team: awayTeam,
        odds
      });

      await homeEntry.save();
      await awayEntry.save();

      console.log(`💾 Saved odds for ${homeTeam} vs ${awayTeam}`);
    }

    console.log('\n✅ College Baseball data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching College Baseball odds:', err.message);
  }
};

module.exports = { fetchNCAABaseballData };
