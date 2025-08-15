const express = require('express');
const router = express.Router();
const { getPlayerStats } = require('../services/playerStatsService');

router.get('/:playerId', async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const stats = await getPlayerStats(playerId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

module.exports = router;
