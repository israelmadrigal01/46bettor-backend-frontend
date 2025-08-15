const express = require('express');
const router = express.Router();
const { getNCAABPlayerStats } = require('../services/ncaabStatsService');

router.get('/:playerId', async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const stats = await getNCAABPlayerStats(playerId);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching NCAAB player stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch NCAAB player stats' });
  }
});

module.exports = router;
