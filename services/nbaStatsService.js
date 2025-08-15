// services/nbaStatsService.js
const axios = require('axios');

async function getNBAPlayerStats(playerName) {
  try {
    const searchQuery = playerName.trim().toLowerCase();

    const response = await axios.get(`https://www.balldontlie.io/api/v1/players?search=${searchQuery}`);
    const players = response.data.data;

    if (!players.length) {
      console.error('❌ No players found for:', searchQuery);
      return { message: 'Player not found' };
    }

    // Try to find exact match
    const player = players.find(p =>
      `${p.first_name.toLowerCase()} ${p.last_name.toLowerCase()}` === searchQuery
    ) || players[0];

    console.log(`✅ Found: ${player.first_name} ${player.last_name} (ID: ${player.id})`);

    const statsResponse = await axios.get(`https://www.balldontlie.io/api/v1/stats?player_ids[]=${player.id}`);
    return statsResponse.data;
  } catch (error) {
    console.error('❌ NBA Stats API error:', error.message);
    throw error;
  }
}

module.exports = { getNBAPlayerStats };
