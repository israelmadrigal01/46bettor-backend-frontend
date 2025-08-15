// routes/videos.js
const express = require('express');
const router = express.Router();

router.get('/ping', (_req, res) => res.json({ ok: true, router: 'videos' }));
router.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Videos route placeholder. We will add YouTube/TikTok scrapers later.' });
});

module.exports = router;
