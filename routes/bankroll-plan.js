// routes/bankroll-plan.js
const express = require('express');
const Setting = require('../models/Setting');

const router = express.Router();

// risk → scalar on the cap
function riskFactor(r) {
  const v = String(r || 'normal').toLowerCase();
  if (v === 'conservative') return 0.5;
  if (v === 'aggressive') return 1.5;
  return 1.0; // normal
}

function roundToUnits(x, step) {
  const s = Math.max(1, Number(step || 1));
  return Math.max(0, Math.round(Number(x) / s) * s);
}

/**
 * GET /api/bankroll-plan?bankroll=250&tickets=3&risk=normal&maxPct=0.02&roundTo=1
 * -> recommends stakeUnits per ticket and totals
 */
router.get('/', async (req, res, next) => {
  try {
    // defaults from settings if present
    const [riskDefault, maxPctDefault] = await Promise.all([
      Setting.findOne({ key: 'risk.default' }).lean(),
      Setting.findOne({ key: 'maxPct.default' }).lean(),
    ]);

    const bankroll = Math.max(0, Number(req.query.bankroll || 0));
    const tickets = Math.max(1, parseInt(String(req.query.tickets || '3'), 10));
    const risk = req.query.risk || (riskDefault?.value || 'normal');
    const maxPct = req.query.maxPct !== undefined
      ? Math.max(0.005, Math.min(0.1, Number(req.query.maxPct)))
      : (Number.isFinite(maxPctDefault?.value) ? maxPctDefault.value : 0.02);
    const roundTo = Math.max(1, Number(req.query.roundTo || 1));

    const perTicketBase = bankroll * maxPct;           // cap per ticket at maxPct of bankroll
    const rf = riskFactor(risk);                       // scale by risk
    const suggestedPerTicket = roundToUnits(perTicketBase * rf, roundTo);

    // Optional overall cap so we don’t overexpose on many tickets (2x of perTicket cap by default)
    const overallCapPct = 2 * maxPct;
    const overallCapUnits = bankroll * overallCapPct;
    let totalUnits = suggestedPerTicket * tickets;
    if (totalUnits > overallCapUnits) {
      totalUnits = roundToUnits(overallCapUnits, roundTo);
    }

    // If clamped, back-compute per-ticket
    const perTicket = tickets ? roundToUnits(totalUnits / tickets, roundTo) : suggestedPerTicket;

    // simple scenario deltas (no odds assumed)
    const loseAll = -totalUnits;
    const loseHalf = -roundToUnits(perTicket * Math.floor(tickets / 2), roundTo);
    const riskNote = `risk=${risk}, maxPct=${maxPct*100}% per ticket, overallCap≈${overallCapPct*100}%`;

    res.json({
      ok: true,
      bankrollUnits: bankroll,
      tickets,
      perTicketUnits: perTicket,
      totalUnits,
      strategy: riskNote,
      scenarios: {
        ifLoseAll: loseAll,
        ifLoseHalf: loseHalf
      },
      tips: {
        // Pair with /api/premium/suggest for actual picks (which will size via Kelly using bankroll)
        suggest: `/api/premium/suggest?limit=${tickets}&bankroll=${bankroll}&risk=${encodeURIComponent(risk)}&maxPct=${maxPct}`
      }
    });
  } catch (e) { next(e); }
});

module.exports = router;
