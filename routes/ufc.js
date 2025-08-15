const express = require('express');
const router = express.Router();
const { getUFCStats } = require('../services/ufcService');

router.get('/:fighter', async (req, res) => {
  try {
    const fighter = req.params.fighter;
    const data = await getUFCStats(fighter);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch UFC stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch UFC stats' });
  }
});

module.exports = router;
