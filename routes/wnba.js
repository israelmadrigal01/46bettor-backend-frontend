// routes/wnba.js
const express = require('express');
const router = express.Router();
const { getWNBATeamStats } = require('../services/wnbaService');

router.get('/', async (req, res) => {
  try {
    const stats = await getWNBATeamStats();
    if (!stats) return res.status(500).json({ error: 'Failed to fetch WNBA stats' });
    res.json(stats);
  } catch (error) {
    console.error('❌ Error in WNBA route:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
