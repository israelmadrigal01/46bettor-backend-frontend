const express = require('express');
const router = express.Router();
const { getNCAAFPlayerStats } = require('../services/ncaafStatsService');

router.get('/:playerId', async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const stats = await getNCAAFPlayerStats(playerId);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching NCAAF player stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch NCAAF player stats' });
  }
});

module.exports = router;
