// routes/picksLive.js
const express = require('express');
const router = express.Router();
const {
  ping,
  demo,
  enrichGet,
  enrich,
  summary,
  aliases,
  fromExisting,
} = require('../controllers/picksLiveController');

// sanity
router.get('/ping', ping);

// GET helpers (no body required)
router.get('/demo', demo);
router.get('/enrich-get', enrichGet);
router.get('/aliases', aliases);
router.get('/from-existing', fromExisting);

// POST endpoints (require JSON body with { picks: [...] })
router.post('/enrich', enrich);
router.post('/summary', summary);

module.exports = router;
