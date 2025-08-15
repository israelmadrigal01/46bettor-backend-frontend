const axios = require('axios');

const getPlayerStats = async (playerId) => {
  const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024`;

  const response = await axios.get(url);
  const data = response.data;

  if (!data.stats || !data.stats.length || !data.stats[0].splits.length) {
    return { message: 'No stats available for this player.' };
  }

  return data.stats[0].splits[0].stat;
};

module.exports = { getPlayerStats };
