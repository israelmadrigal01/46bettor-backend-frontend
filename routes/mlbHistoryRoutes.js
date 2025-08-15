const express = require('express');
const router = express.Router();
const { getMLBHistoricalGames } = require('../controllers/mlbHistoryController');

router.get('/', getMLBHistoricalGames);

module.exports = router;
