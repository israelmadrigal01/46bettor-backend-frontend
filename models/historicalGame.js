// models/HistoricalGame.js
'use strict';
const mongoose = require('mongoose');

const TeamSideSchema = new mongoose.Schema(
  {
    id: { type: Number, index: true },   // optional modern id
    name: String,                        // e.g., "Los Angeles Dodgers"
    abbreviation: String,                // e.g., "LAD"
    score: { type: Number, default: null },
  },
  { _id: false }
);

const HistoricalGameSchema = new mongoose.Schema(
  {
    /* ===== Legacy fields already in your DB ===== */
    sport: { type: String, index: true },       // e.g., "MLB"
    gamePk: { type: Number, index: true },      // old identifier (we keep it for compatibility)
    date: { type: String, index: true },        // "YYYY-MM-DD"
    homeTeam: { type: String, index: true },    // team name (flat string)
    awayTeam: { type: String, index: true },
    homeScore: Number,
    awayScore: Number,
    isFinal: { type: Boolean, default: false },

    /* ===== Newer/richer fields (safe additions) ===== */
    league: { type: String, index: true },      // mirrors sport (e.g., "MLB")
    season: { type: Number, index: true },
    gameId: { type: String, index: true },      // normalized id as string
    gameDate: { type: Date, index: true },      // real Date object
    status: { type: String, index: true },
    venue: String,
    winner: { type: String, enum: ['HOME', 'AWAY', 'TIE', null], default: null },

    // Optional structured teams if you ever populate by id
    homeTeamObj: { type: TeamSideSchema, default: undefined },
    awayTeamObj: { type: TeamSideSchema, default: undefined },

    meta: mongoose.Schema.Types.Mixed,          // keep raw crumbs as needed
  },
  { timestamps: true }
);

/* ===== Indexes =====
   We keep flexible indexes so either legacy or new fields work.
*/
HistoricalGameSchema.index({ league: 1, gameId: 1 }, { unique: true, sparse: true }); // primary going forward
HistoricalGameSchema.index({ sport: 1, date: 1 });                                     // fast daily lookups
HistoricalGameSchema.index({ sport: 1, homeTeam: 1, date: -1 });
HistoricalGameSchema.index({ sport: 1, awayTeam: 1, date: -1 });
HistoricalGameSchema.index({ gameDate: 1 });
HistoricalGameSchema.index({ season: 1 });

/* ===== Export (no OverwriteModelError) ===== */
let Model;
try {
  Model = mongoose.model('HistoricalGame');
} catch {
  Model = mongoose.model('HistoricalGame', HistoricalGameSchema);
}
module.exports = Model;
// Optional named alias if some code does: const { HistoryGame } = require(...)
module.exports.HistoryGame = Model;
