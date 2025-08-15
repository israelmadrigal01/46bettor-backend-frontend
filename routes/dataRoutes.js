const express = require('express');
const router = express.Router();
const Data = require('../models/Data'); // Make sure this model exists

// @route   GET /api/data
// @desc    Get all stored data from MongoDB
router.get('/', async (req, res) => {
  try {
    const data = await Data.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error('Error fetching data:', err.message);
    res.status(500).json({ error: 'Server error while fetching data' });
  }
});

module.exports = router;
