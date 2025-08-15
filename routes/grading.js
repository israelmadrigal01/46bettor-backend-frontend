// routes/grade.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/gradingController');

router.post('/', controller.grade);
router.post('/bulk', controller.gradeBulk);

module.exports = router;
