const express = require('express');
const router = express.Router();
const { getNFLTeamStats } = require('../services/nflService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const stats = await getNFLTeamStats(team);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error in NFL stats route:', error.message);
    res.status(500).json({ error: 'Failed to fetch NFL stats' });
  }
});

module.exports = router;
