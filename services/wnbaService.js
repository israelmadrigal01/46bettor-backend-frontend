// services/wnbaService.js
const axios = require('axios');

async function getWNBATeamStats() {
  try {
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard');
    const events = response.data.events || [];

    return events.map(event => ({
      id: event.id,
      name: event.name,
      date: event.date,
      status: event.status?.type?.description,
      competitors: event.competitions?.[0]?.competitors?.map(c => ({
        team: c.team?.displayName,
        score: c.score,
        winner: c.winner,
      })) || [],
    }));
  } catch (error) {
    console.error('❌ Error fetching WNBA stats:', error.message);
    return null;
  }
}

module.exports = { getWNBATeamStats };
