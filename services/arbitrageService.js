// services/arbitrageService.js
const { getMergedOdds } = require('./oddsMergeService');

function americanToDecimal(a) {
  const n = Number(a);
  if (!Number.isFinite(n)) return null;
  if (n > 0) return 1 + n / 100;
  if (n < 0) return 1 + 100 / Math.abs(n);
  return null;
}

/**
 * Compute 2-way moneyline arbitrage: need best home & best away prices (can be different books).
 * For decimal odds dH and dA, arbitrage if (1/dH + 1/dA) < 1.
 * Stake split for bankroll B:
 *  - stakeHome = B * (1/dH) / (1/dH + 1/dA)
 *  - stakeAway = B * (1/dA) / (1/dH + 1/dA)
 * Payout (either outcome) ≈ B / (1/dH + 1/dA). Profit% = (1/(sumInv) - 1).
 */
async function findArbitrage({ league, sport, date, bankroll = 100 }) {
  const merged = await getMergedOdds({ league, sport, date });
  const items = [];

  const matchups = merged.byMatchup || {};
  for (const key of Object.keys(matchups)) {
    const m = matchups[key];
    const home = m?.home;
    const away = m?.away;
    if (!home || !away) continue;
    const dH = americanToDecimal(home.price);
    const dA = americanToDecimal(away.price);
    if (!dH || !dA) continue;

    const invSum = 1 / dH + 1 / dA;
    if (invSum < 1) {
      const payout = bankroll / invSum;
      const profit = payout - bankroll;
      const edgePct = (payout / bankroll - 1) * 100;

      const stakeHome = (bankroll * (1 / dH)) / invSum;
      const stakeAway = (bankroll * (1 / dA)) / invSum;

      items.push({
        matchup: key, // e.g., AWAY@HOME (abbr)
        home: { book: home.book, price: home.price, dec: Number(dH.toFixed(4)) },
        away: { book: away.book, price: away.price, dec: Number(dA.toFixed(4)) },
        sumInverse: Number(invSum.toFixed(6)),
        edgePercent: Number(edgePct.toFixed(2)),
        bankroll,
        stakes: {
          home: Number(stakeHome.toFixed(2)),
          away: Number(stakeAway.toFixed(2)),
        },
        equalizedPayout: Number(payout.toFixed(2)),
        profit: Number(profit.toFixed(2)),
      });
    }
  }

  // Sort best -> worst by edge%
  items.sort((a, b) => b.edgePercent - a.edgePercent);

  return {
    ok: true,
    params: { league, sport, date, bankroll },
    count: items.length,
    items,
    lastUpdated: merged.lastUpdated,
  };
}

module.exports = { findArbitrage };
