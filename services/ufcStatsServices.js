const axios = require('axios');

async function getUFCFighterStats(fighterName) {
  try {
    const encodedName = encodeURIComponent(fighterName);
    const url = `https://mma-stats-api.p.rapidapi.com/fighter?name=${encodedName}`;

    const response = await axios.get(url, {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'mma-stats-api.p.rapidapi.com'
      }
    });

    return response.data || { message: 'No stats available for this fighter' };
  } catch (error) {
    console.error('❌ Error in UFC stats service:', error.message);
    throw error;
  }
}

module.exports = { getUFCFighterStats };
