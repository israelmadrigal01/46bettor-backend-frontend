// routes/data.js
const express = require('express');
const router = express.Router();
const TeamData = require('../models/TeamData');

// GET /api/data?team=Yankees&after=2025-08-07&limit=10
router.get('/', async (req, res) => {
  try {
    const { team, after, limit } = req.query;

    const filter = {};
    if (team) {
      filter.team = team;
    }
    if (after) {
      filter.timestamp = { $gte: new Date(after) };
    }

    const results = await TeamData.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) || 100);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data', details: err.message });
  }
});

module.exports = router;
