// routes/fantasy.js
const express = require('express');
const router = express.Router();
const { getFantasyData } = require('../services/fantasyService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const data = await getFantasyData(team);
    res.json(data);
  } catch (error) {
    console.error('Error fetching fantasy data:', error);
    res.status(500).json({ error: 'Failed to fetch fantasy data' });
  }
});

module.exports = router;
