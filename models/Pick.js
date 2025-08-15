// models/Pick.js
const mongoose = require('mongoose');

const PickSchema = new mongoose.Schema(
  {
    sport: { type: String, required: true, index: true },
    league: { type: String },
    eventId: { type: String, index: true },
    startTime: { type: Date, index: true },

    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },

    market: { type: String, required: true }, // moneyline | spread | total
    selection: { type: String, required: true },
    line: { type: Number },
    odds: { type: Number, required: true }, // American odds
    book: { type: String },

    stake: { type: Number, default: 0 },
    toWin: { type: Number, default: 0 },
    impliedProb: { type: Number, default: 0 },

    riskLevel: { type: String, index: true }, // Safe Bet | Value Pick | High Risk, High Reward
    confidence: { type: Number, default: 0 },
    source: { type: String, default: 'User' },
    userNotes: { type: String },

    status: { type: String, enum: ['pending', 'won', 'lost', 'push', 'void'], default: 'pending', index: true },
    outcomeDetail: { type: String }
  },
  { timestamps: true }
);

PickSchema.index({ sport: 1, startTime: 1 });
PickSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Pick', PickSchema);
