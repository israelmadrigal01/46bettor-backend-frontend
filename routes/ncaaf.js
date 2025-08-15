const express = require('express');
const router = express.Router();
const { getNCAAFTeamStats } = require('../services/ncaafService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const data = await getNCAAFTeamStats(team);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch NCAAF stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch NCAAF stats' });
  }
});

module.exports = router;
