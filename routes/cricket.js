const express = require('express');
const router = express.Router();
const { getCricketStats } = require('../services/cricketService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const data = await getCricketStats(team);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch Cricket stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch Cricket stats' });
  }
});

module.exports = router;
