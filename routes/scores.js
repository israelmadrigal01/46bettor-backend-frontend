// routes/scores.js
const express = require('express');
const router = express.Router();
const { getLiveScores } = require('../services/scoresService');

router.get('/:sport', async (req, res) => {
  const sport = req.params.sport;
  try {
    const scores = await getLiveScores(sport);
    if (!scores) return res.status(500).json({ error: 'Failed to fetch scores' });
    res.json(scores);
  } catch (err) {
    console.error('❌ Error in /scores route:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
