const express = require('express');
const router = express.Router();
const { getUFCFighterStats } = require('../services/ufcStatsServices');

router.get('/:fighterName', async (req, res) => {
  try {
    const fighterName = req.params.fighterName;
    const stats = await getUFCFighterStats(fighterName);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching UFC fighter stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch UFC fighter stats' });
  }
});

module.exports = router;
