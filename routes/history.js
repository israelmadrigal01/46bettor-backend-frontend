// routes/history.js
'use strict';
const express = require('express');
const router = express.Router();
const controller = require('../controllers/historyController');

// Backfill MLB (or other) by date range
// POST /api/history/backfill?sport=MLB&start=2024-04-01&end=2024-04-02
router.post('/backfill', controller.backfill);

// List games by day
// GET /api/history/list?sport=MLB&date=2024-04-01
router.get('/list', controller.list);

// Simple team record in range
// GET /api/history/team-record?sport=MLB&team=Los%20Angeles%20Dodgers&start=2024-04-01&end=2024-04-30
router.get('/team-record', controller.teamRecord);

module.exports = router;
