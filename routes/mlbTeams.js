// routes/mlbTeams.js
const express = require('express');
const router = express.Router();
const { fetchAllMLBTeams } = require('../services/teamService');

router.get('/', async (req, res) => {
  try {
    const teams = await fetchAllMLBTeams();
    res.json({ success: true, count: teams.length, teams });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch MLB teams', error: err.message });
  }
});

module.exports = router;
