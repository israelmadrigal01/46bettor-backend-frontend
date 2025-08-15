// routes/youtube.js
const express = require('express');
const router = express.Router();
const { getYoutubeHighlights } = require('../services/youtubeService');

router.get('/:team', async (req, res) => {
  try {
    const team = req.params.team;
    const videos = await getYoutubeHighlights(team);
    res.json(videos);
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube videos' });
  }
});

module.exports = router;
