// utils/odds.js
// Helpers for American odds and unit PnL math

function americanToDecimal(odds) {
  if (odds === 0 || odds == null) return 1;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

function profitUnits(odds, stakeUnits = 1) {
  if (odds == null) return 0;
  return odds > 0 ? (odds / 100) * stakeUnits : (100 / Math.abs(odds)) * stakeUnits;
}

function resultPnLUnits({ status, odds, stakeUnits = 1 }) {
  if (status === 'won') return profitUnits(odds, stakeUnits);
  if (status === 'lost') return -1 * stakeUnits;
  if (status === 'push' || status === 'void') return 0;
  return 0; // open / pending
}

module.exports = { americanToDecimal, profitUnits, resultPnLUnits };
