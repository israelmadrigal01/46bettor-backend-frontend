const express = require('express');
const router = express.Router();
const { getTennisStats } = require('../services/tennisService');

router.get('/:player', async (req, res) => {
  try {
    const player = req.params.player;
    const data = await getTennisStats(player);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch Tennis stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch Tennis stats' });
  }
});

module.exports = router;
