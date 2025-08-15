// models/TeamData.js
const mongoose = require('mongoose');

const teamDataSchema = new mongoose.Schema({
  sport: { type: String, default: 'MLB' }, // NEW field
  team: String,
  timestamp: { type: Date, default: Date.now },
  weather: Object,
  odds: Object,
  injuries: Object,
});

module.exports = mongoose.model('TeamData', teamDataSchema);
