// services/soccerService.js
const axios = require('axios');
const TeamData = require('../models/TeamData');
require('dotenv').config();

const fetchSoccerData = async () => {
  console.log('\n⚽ Starting Soccer odds fetch...\n');

  const url = `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?regions=us&markets=h2h&apiKey=${process.env.ODDS_API_KEY}`;

  try {
    const res = await axios.get(url);
    const matches = res.data;

    for (const match of matches) {
      const homeTeam = match.home_team;
      const awayTeam = match.away_team;
      const odds = match.bookmakers[0]?.markets[0]?.outcomes;

      const entryHome = new TeamData({
        sport: 'Soccer',
        team: homeTeam,
        odds
      });

      const entryAway = new TeamData({
        sport: 'Soccer',
        team: awayTeam,
        odds
      });

      await entryHome.save();
      await entryAway.save();

      console.log(`💾 Saved odds for ${homeTeam} vs ${awayTeam}`);
    }

    console.log('\n✅ Soccer data fetch complete.\n');
  } catch (err) {
    console.error('❌ Error fetching Soccer odds:', err.message);
  }
};

module.exports = { fetchSoccerData };
