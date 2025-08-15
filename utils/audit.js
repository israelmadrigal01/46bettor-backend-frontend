// utils/audit.js
const crypto = require('crypto');

function canonicalizePick(p) {
  return {
    // keep only the fields that should define uniqueness for a pick
    date: p.date ? String(p.date).slice(0, 10) : '',
    sport: p.sport || '',
    league: p.league || '',
    eventId: p.eventId || '',
    homeTeam: p.homeTeam || '',
    awayTeam: p.awayTeam || '',
    market: p.market || '',
    selection: p.selection || '',
    // prefer normalized "odds" but accept "oddsAmerican"
    odds: p.odds ?? p.oddsAmerican ?? null,
    // normalize stake to a number
    stakeUnits: Number(p.stakeUnits ?? p.stake ?? 0) || 0,
    // provenance (helps keep two identical picks from different sources distinct if you want)
    source: p.source || '',
    suggestTs: p.suggestTs ? new Date(p.suggestTs).toISOString() : ''
  };
}

function makeAuditHash(pick) {
  const c = canonicalizePick(pick);
  const str = JSON.stringify(c);
  return crypto.createHash('sha1').update(str).digest('hex');
}

module.exports = { makeAuditHash, canonicalizePick };
