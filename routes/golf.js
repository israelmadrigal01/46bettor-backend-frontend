const express = require('express');
const router = express.Router();
const { getGolfStats } = require('../services/golfService');

router.get('/:player', async (req, res) => {
  try {
    const player = req.params.player;
    const data = await getGolfStats(player);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch Golf stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch Golf stats' });
  }
});

module.exports = router;
