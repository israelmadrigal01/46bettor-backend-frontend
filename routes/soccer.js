const express = require('express');
const router = express.Router();
const { getSoccerStats } = require('../services/soccerService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const data = await getSoccerStats(team);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch Soccer stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch Soccer stats' });
  }
});

module.exports = router;
