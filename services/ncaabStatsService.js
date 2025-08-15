const axios = require('axios');

async function getNCAABPlayerStats(playerId) {
  try {
    const url = `https://api.collegefootballdata.com/player/season/statistics?playerId=${playerId}`;
    const response = await axios.get(url);
    return response.data || { message: 'No stats available' };
  } catch (error) {
    console.error('❌ Error in NCAAB stats service:', error.message);
    throw error;
  }
}

module.exports = { getNCAABPlayerStats };
