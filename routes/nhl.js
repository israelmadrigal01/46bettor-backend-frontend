const express = require('express');
const router = express.Router();
const { getNHLTeamStats } = require('../services/nhlService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const stats = await getNHLTeamStats(team);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error in NHL stats route:', error.message);
    res.status(500).json({ error: 'Failed to fetch NHL stats' });
  }
});

module.exports = router;
