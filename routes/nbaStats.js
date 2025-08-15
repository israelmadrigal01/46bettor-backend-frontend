// routes/nbaStats.js
const express = require('express');
const router = express.Router();
const { getNBAPlayerStats } = require('../services/nbaStatsService');

router.get('/:player', async (req, res) => {
  const playerName = req.params.player;
  console.log('🔍 Searching for player:', playerName);

  try {
    const data = await getNBAPlayerStats(playerName);
    console.log('📊 Data returned:', data);

    if (data.message) {
      return res.status(404).json({ error: data.message });
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Error in NBA stats route:', error.message);
    res.status(500).json({ error: 'Failed to fetch NBA stats' });
  }
});

module.exports = router;
