const express = require('express');
const router = express.Router();
const { getNCAABTeamStats } = require('../services/ncaabService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const data = await getNCAABTeamStats(team);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch NCAAB stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch NCAAB stats' });
  }
});

module.exports = router;
