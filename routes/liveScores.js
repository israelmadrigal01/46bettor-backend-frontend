// routes/liveScores.js
const express = require('express');
const router = express.Router();
const {
  getLiveScores,
  getLiveSummary,
  getSavedLiveScores,
  clearSavedLiveScores,
  getGameById,
  getMlbLinescore,
  findByTeam,
} = require('../controllers/liveScoresController');

// sanity
router.get('/ping', (_req, res) => res.json({ ok: true, router: 'live-scores' }));

// live fetchers
router.get('/', getLiveScores);
router.get('/summary', getLiveSummary);

// db tools
router.get('/db', getSavedLiveScores);           // view saved docs
router.delete('/db/clear', clearSavedLiveScores); // clear saved docs quickly

// utilities
router.get('/game/:id', getGameById);            // fetch a single game (live fetch or fallback to DB)
router.get('/linescore', getMlbLinescore);       // MLB only: ?gamePk=########
router.get('/find-by-team', findByTeam);         // fuzzy team search: ?league=mlb&name=Yankees&date=YYYYMMDD

module.exports = router;
