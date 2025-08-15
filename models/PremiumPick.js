// models/PremiumPick.js
const mongoose = require('mongoose');
const crypto = require('crypto');

function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex'); }

const PremiumPickSchema = new mongoose.Schema(
  {
    // core
    date: { type: String, index: true }, // YYYY-MM-DD
    sport: { type: String, index: true },
    league: { type: String },
    eventId: { type: String },

    // teams & market
    homeTeam: { type: String },
    awayTeam: { type: String },
    market: { type: String, default: 'ml' }, // moneyline by default
    selection: { type: String }, // 'home' | 'away' | etc.

    // pricing
    line: { type: Number, default: null }, // spread/total if relevant
    odds: { type: Number, default: null }, // American odds

    // staking & status
    stakeUnits: { type: Number, default: 1 },
    status: { type: String, default: 'open' }, // open|won|lost|push|void
    settledAt: { type: Date, default: null },
    finalScore: { type: String, default: null },

    // meta
    tags: [{ type: String }],
    notes: { type: String, default: '' },

    // analytics
    fairProb: { type: Number, default: null },
    impliedProb: { type: Number, default: null },
    edgePct: { type: Number, default: null },

    // provenance
    source: { type: String, default: '' },       // demo|auto|recommend|…
    suggestTs: { type: Date, default: null },
    auditHash: { type: String, default: null },  // dedupe key
    explanation: { type: String, default: '' },  // human-readable reason
  },
  { timestamps: true, collection: 'premium_picks' }
);

// ---- Indexes ----
// Use a single partial unique index for auditHash so only real strings are enforced.
// This avoids the "duplicate key on null" and the "duplicate schema index" warnings.
PremiumPickSchema.index(
  { auditHash: 1 },
  { unique: true, partialFilterExpression: { auditHash: { $type: 'string' } } }
);
PremiumPickSchema.index({ date: 1, sport: 1 });

// ---- Helpers ----
function pctFromAmerican(odds) {
  if (odds == null) return null;
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}

// Pre-save: fill impliedProb if odds is present and impliedProb is missing.
// Also compute a stable auditHash if it’s still missing.
PremiumPickSchema.pre('save', function pre(next) {
  try {
    if (this.odds != null && (this.impliedProb == null || Number.isNaN(this.impliedProb))) {
      this.impliedProb = pctFromAmerican(this.odds);
    }
    if (!this.auditHash) {
      // Build a conservative string—don’t include fields that change post-commit.
      const parts = [
        this.date || '',
        this.sport || '',
        this.league || '',
        this.eventId || '',
        this.homeTeam || '',
        this.awayTeam || '',
        this.market || '',
        this.selection || '',
        (this.odds != null ? String(this.odds) : ''),
        (this.stakeUnits != null ? String(this.stakeUnits) : '')
      ];
      const src = parts.join('|');
      const h = sha1(src);
      this.auditHash = h;
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

module.exports = mongoose.model('PremiumPick', PremiumPickSchema);
