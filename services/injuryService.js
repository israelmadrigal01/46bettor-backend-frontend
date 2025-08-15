const axios = require('axios');
require('dotenv').config();

const ODDS_API_KEY = process.env.ODDS_API_KEY;

const getInjuries = async () => {
  try {
    const response = await axios.get('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/injuries', {
      params: {
        apiKey: ODDS_API_KEY,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching injuries:', error.message);
    return [];
  }
};

module.exports = { getInjuries };
