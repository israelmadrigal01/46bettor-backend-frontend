const mongoose = require('mongoose');

const DataSchema = new mongoose.Schema({
  sport: String,
  team: String,
  date: String,
  odds: Object,
  weather: Object,
  injuries: Object,
  riskLevel: String,
}, { timestamps: true });

module.exports = mongoose.model('Data', DataSchema);
