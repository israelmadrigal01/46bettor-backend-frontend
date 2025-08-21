// routes/public/health.js
const express = require('express');
const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: '46bettor-backend/public',
    ts: new Date().toISOString(),
  });
});

module.exports = router;
