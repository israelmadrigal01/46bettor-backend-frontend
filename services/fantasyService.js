const axios = require('axios');

// Example sports supported: NFL, NBA, MLB, etc.
const supportedSports = {
  nfl: 'american-football',
  nba: 'basketball',
  mlb: 'baseball',
};

const fetchFantasyStats = async (sport = 'nfl') => {
  const sportPath = supportedSports[sport.toLowerCase()];
  if (!sportPath) return [];

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/${sport}/players`;
    const response = await axios.get(url);

    const players = response.data?.athletes || [];

    return players.map(player => ({
      id: player.id,
      name: player.fullName,
      team: player.team?.name,
      position: player.position?.name,
      stats: player.stats,
      headshot: player.headshot?.href || '',
    }));
  } catch (err) {
    console.error('Fantasy API error:', err.message);
    return [];
  }
};

module.exports = { fetchFantasyStats };
