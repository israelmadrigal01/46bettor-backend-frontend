// models/LiveScore.js
const mongoose = require('mongoose');

const LiveScoreSchema = new mongoose.Schema(
  {
    sport: { type: String, index: true },          // football, basketball, baseball, hockey, soccer, etc.
    league: { type: String, index: true },         // nfl, nba, mlb, nhl, wnba, ncaaf, ncaab, etc.
    gameId: { type: String, index: true, unique: false }, // ESPN event id or provider game id
    startTime: { type: Date, index: true },
    status: { type: String, index: true },         // pre, in, post
    period: { type: String },                      // Q4, 7th, 3rd, HT, etc.
    clock: { type: String },                       // 05:43, End, —
    neutralSite: { type: Boolean, default: false },

    homeTeam: {
      id: String,
      name: String,
      shortName: String,
      abbreviation: String,
      score: { type: Number, default: 0 },
      ranking: { type: Number, default: null },
    },
    awayTeam: {
      id: String,
      name: String,
      shortName: String,
      abbreviation: String,
      score: { type: Number, default: 0 },
      ranking: { type: Number, default: null },
    },

    // Useful for dedupe
    key: { type: String, unique: true, index: true }, // `${league}:${gameId}`

    raw: { type: Object }, // keep the source snippet for debugging
    lastUpdated: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Upsert helper index
LiveScoreSchema.index({ league: 1, gameId: 1 }, { unique: false });

module.exports = mongoose.model('LiveScore', LiveScoreSchema);
