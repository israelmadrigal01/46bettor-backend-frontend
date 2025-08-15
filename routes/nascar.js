const express = require('express');
const router = express.Router();
const { getNascarStats } = require('../services/nascarService');

router.get('/:driver', async (req, res) => {
  try {
    const driver = req.params.driver;
    const data = await getNascarStats(driver);
    res.json(data);
  } catch (error) {
    console.error('❌ Failed to fetch NASCAR stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch NASCAR stats' });
  }
});

module.exports = router;
