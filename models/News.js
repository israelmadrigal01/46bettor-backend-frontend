const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: String,
  url: String,
  source: String,
  publishedAt: Date,
  team: String,
  sport: String,
});

module.exports = mongoose.model('News', newsSchema);
