const express = require('express');
const router = express.Router();
const { getNCAABaseballStats } = require('../services/ncaabaseballService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const data = await getNCAABaseballStats(team);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch NCAABaseball stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch NCAABaseball stats' });
  }
});

module.exports = router;
