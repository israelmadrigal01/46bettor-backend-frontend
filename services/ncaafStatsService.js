const axios = require('axios');

async function getNCAAFPlayerStats(playerId) {
  try {
    // Example using sportsdata.io or similar free source
    const url = `https://api.collegefootballdata.com/player/season/statistics?playerId=${playerId}`;
    const response = await axios.get(url);
    return response.data || { message: 'No stats available' };
  } catch (error) {
    console.error('❌ Error in NCAAF stats service:', error.message);
    throw error;
  }
}

module.exports = { getNCAAFPlayerStats };
