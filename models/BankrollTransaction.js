// models/BankrollTransaction.js
const mongoose = require('mongoose');

const BankrollTransactionSchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now, index: true },
    type: {
      type: String,
      enum: ['bet_win', 'bet_loss', 'bet_push', 'adjustment', 'reversal'],
      required: true,
      index: true
    },
    amountUnits: { type: Number, required: true },
    pickId: { type: mongoose.Schema.Types.ObjectId, ref: 'PremiumPick' },
    note: { type: String }
  },
  {
    timestamps: true,
    // If your historical data is in another collection name, flip this to match.
    collection: 'bankroll_transactions'
  }
);

module.exports = mongoose.model('BankrollTransaction', BankrollTransactionSchema);
