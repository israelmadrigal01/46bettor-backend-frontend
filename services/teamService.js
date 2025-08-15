// services/teamService.js
const axios = require('axios');

const fetchAllMLBTeams = async () => {
  try {
    const response = await axios.get('https://statsapi.mlb.com/api/v1/teams?sportId=1');
    return response.data.teams;
  } catch (error) {
    console.error('Error fetching MLB teams:', error.message);
    return [];
  }
};

module.exports = {
  fetchAllMLBTeams,
};
