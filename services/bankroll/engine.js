/* eslint-disable */ // @ts-nocheck
'use strict';

function americanToDecimal(odds) {
  if (odds === 0 || odds == null) return { dec: null, implied: null, b: null };
  if (odds > 0) {
    const dec = 1 + (odds / 100);
    return { dec, implied: 100 / (odds + 100), b: dec - 1 };
  } else {
    const dec = 1 + (100 / Math.abs(odds));
    return { dec, implied: Math.abs(odds) / (Math.abs(odds) + 100), b: dec - 1 };
  }
}

function kellyFraction({ fairProb, b }) {
  if (fairProb == null || b == null) return 0;
  const p = Math.max(0, Math.min(1, fairProb));
  const q = 1 - p;
  const fStar = (b * p - q) / b;
  return Math.max(0, fStar);
}

function roundToUnit(x, unit) {
  if (!unit || unit <= 0) return x;
  return Math.round(x / unit) * unit;
}

function recommendStake(args) {
  const {
    bankroll,
    oddsAmerican,
    fairProb,
    strategy = 'fractional',
    kellyFraction: kf = 0.5,
    maxStakePct = 0.02,
    minStake = 0,
    flatUnit = 10,
    roundTo = 1
  } = args;

  const { b, implied } = americanToDecimal(oddsAmerican);
  if (bankroll == null || bankroll <= 0) return { stake: 0, reason: 'no_bankroll' };
  if (fairProb == null || b == null) return { stake: 0, reason: 'missing_inputs' };

  let raw = 0;
  if (strategy === 'flat') {
    raw = flatUnit;
  } else if (strategy === 'kelly') {
    raw = bankroll * kellyFraction({ fairProb, b });
  } else {
    const fStar = kellyFraction({ fairProb, b });
    raw = bankroll * fStar * kf;
  }

  const cap = bankroll * Math.max(0, Math.min(1, maxStakePct));
  let stake = Math.min(raw, cap);
  if (stake > 0 && stake < minStake) stake = 0;
  stake = roundToUnit(stake, roundTo);

  const edgePct = fairProb - (implied ?? 0);

  return {
    stake,
    edgePct,
    impliedProb: implied,
    b,
    strategy,
    kellyFraction: strategy === 'fractional' ? kf : (strategy === 'kelly' ? 1 : 0),
    maxStakePct,
    minStake,
    roundTo
  };
}

module.exports = {
  recommendStake,
  americanToDecimal
};
