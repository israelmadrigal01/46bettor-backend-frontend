// controllers/picksController.js
const Pick = require('../models/Pick');

/* ----------------- helpers ----------------- */
function normalizeAmericanOdds(odds) {
  if (typeof odds !== 'number' || Number.isNaN(odds)) return null;
  return Math.trunc(odds);
}
function americanImpliedProbability(odds) {
  if (odds == null) return 0;
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}
function payoutToWin(stake, americanOdds) {
  if (!stake || !americanOdds) return 0;
  return americanOdds > 0 ? (stake * americanOdds) / 100 : (stake * 100) / Math.abs(americanOdds);
}
function autoRiskTag(americanOdds) {
  if (americanOdds == null) return 'Value Pick';
  if (americanOdds <= -150) return 'Safe Bet';
  if (americanOdds >= 170) return 'High Risk, High Reward';
  return 'Value Pick';
}

/* ----------------- routes ----------------- */

// GET /api/picks
exports.getPicks = async (req, res, next) => {
  try {
    const { sport, status, riskLevel, minOdds, sortByOdds, limit = 200 } = req.query;
    const q = {};
    if (sport) q.sport = sport;
    if (status) q.status = status;
    if (riskLevel) q.riskLevel = riskLevel;
    if (minOdds) q.odds = { $gte: Number(minOdds) };

    let sort = { createdAt: -1 };
    if (sortByOdds) sort = sortByOdds === 'asc' ? { odds: 1 } : { odds: -1 };

    const data = await Pick.find(q).sort(sort).limit(Math.min(Number(limit) || 200, 1000)).lean();
    res.json({ ok: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/picks/add
exports.addPick = async (req, res, next) => {
  try {
    const {
      sport, league, eventId, startTime,
      homeTeam, awayTeam,
      market, selection, line, odds, book,
      stake, confidence, userNotes, source
    } = req.body || {};

    const missing = [];
    if (!sport) missing.push('sport');
    if (!homeTeam) missing.push('homeTeam');
    if (!awayTeam) missing.push('awayTeam');
    if (!market) missing.push('market');
    if (!selection) missing.push('selection');
    if (odds === undefined || odds === null || odds === '') missing.push('odds');
    if (missing.length) return res.status(400).json({ ok: false, error: `Missing: ${missing.join(', ')}` });

    const americanOdds = normalizeAmericanOdds(Number(odds));
    if (americanOdds === null) return res.status(400).json({ ok: false, error: 'Invalid odds' });

    const impliedProb = americanImpliedProbability(americanOdds);
    const toWin = payoutToWin(Number(stake) || 0, americanOdds);
    const riskLevel = autoRiskTag(americanOdds);

    const doc = await Pick.create({
      sport, league, eventId,
      startTime: startTime ? new Date(startTime) : undefined,
      homeTeam, awayTeam,
      market, selection,
      line: line !== undefined ? Number(line) : undefined,
      odds: americanOdds, book,
      stake: Number(stake) || 0, toWin, impliedProb,
      riskLevel, confidence: Number(confidence) || 0,
      source: source || 'User', userNotes,
      status: 'pending'
    });

    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/picks/:id
exports.updatePick = async (req, res, next) => {
  try {
    const { id } = req.params;

    const fields = {};
    const updatable = [
      'sport','league','eventId','startTime',
      'homeTeam','awayTeam','market','selection','line',
      'odds','book','stake','confidence','userNotes','source'
    ];
    for (const k of updatable) {
      if (req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== '') {
        fields[k] = req.body[k];
      }
    }
    if (fields.line !== undefined) fields.line = Number(fields.line);
    if (fields.odds !== undefined) fields.odds = Number(fields.odds);
    if (fields.stake !== undefined) fields.stake = Number(fields.stake);
    if (fields.startTime) fields.startTime = new Date(fields.startTime);

    if (fields.odds !== undefined || fields.stake !== undefined) {
      const americanOdds = fields.odds !== undefined ? normalizeAmericanOdds(Number(fields.odds)) : undefined;
      let existing = null;
      if (americanOdds == null && fields.stake !== undefined) {
        existing = await Pick.findById(id).lean();
      }
      const effectiveOdds = americanOdds != null ? americanOdds : (existing ? existing.odds : undefined);

      if (effectiveOdds != null) {
        fields.impliedProb = americanImpliedProbability(effectiveOdds);
        fields.toWin = payoutToWin(
          fields.stake !== undefined ? Number(fields.stake) : (existing ? existing.stake : 0),
          effectiveOdds
        );
        fields.riskLevel = autoRiskTag(effectiveOdds);
        fields.odds = effectiveOdds;
      }
    }

    const doc = await Pick.findByIdAndUpdate(id, { $set: fields }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, error: 'Pick not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/picks/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, outcomeDetail } = req.body || {};
    const allowed = ['pending', 'won', 'lost', 'push', 'void'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }
    const doc = await Pick.findByIdAndUpdate(id, { $set: { status, outcomeDetail } }, { new: true });
    if (!doc) return res.status(404).json({ ok: false, error: 'Pick not found' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/picks/:id
exports.deletePick = async (req, res, next) => {
  try {
    const { id } = req.params;
    const found = await Pick.findByIdAndDelete(id);
    if (!found) return res.status(404).json({ ok: false, error: 'Pick not found' });
    res.json({ ok: true, data: { id, deleted: true } });
  } catch (err) {
    next(err);
  }
};

// POST /api/picks/bulk
// Body: { items: [ { sport, homeTeam, awayTeam, market, selection, odds, ... }, ... ] }
exports.addPicksBulk = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items || !items.length) {
      return res.status(400).json({ ok: false, error: 'items[] required' });
    }

    const docs = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const raw = items[i] || {};
      const idx = i;

      const missing = [];
      if (!raw.sport) missing.push('sport');
      if (!raw.homeTeam) missing.push('homeTeam');
      if (!raw.awayTeam) missing.push('awayTeam');
      if (!raw.market) missing.push('market');
      if (!raw.selection) missing.push('selection');
      if (raw.odds === undefined || raw.odds === null || raw.odds === '') missing.push('odds');

      if (missing.length) {
        errors.push({ index: idx, error: `Missing: ${missing.join(', ')}` });
        continue;
      }

      const americanOdds = normalizeAmericanOdds(Number(raw.odds));
      if (americanOdds === null) {
        errors.push({ index: idx, error: 'Invalid odds' });
        continue;
      }

      const stakeNum = Number(raw.stake) || 0;
      const impliedProb = americanImpliedProbability(americanOdds);
      const toWin = payoutToWin(stakeNum, americanOdds);
      const riskLevel = autoRiskTag(americanOdds);

      docs.push({
        sport: raw.sport,
        league: raw.league || raw.sport,
        eventId: raw.eventId,
        startTime: raw.startTime ? new Date(raw.startTime) : undefined,
        homeTeam: raw.homeTeam,
        awayTeam: raw.awayTeam,
        market: raw.market,
        selection: raw.selection,
        line: raw.line !== undefined && raw.line !== '' ? Number(raw.line) : undefined,
        odds: americanOdds,
        book: raw.book,
        stake: stakeNum,
        toWin,
        impliedProb,
        riskLevel,
        confidence: Number(raw.confidence) || 0,
        source: raw.source || 'Import',
        userNotes: raw.userNotes,
        status: raw.status || 'pending'
      });
    }

    let inserted = [];
    if (docs.length) {
      inserted = await Pick.insertMany(docs, { ordered: false });
    }

    res.status(201).json({
      ok: true,
      added: inserted.length,
      failed: errors.length,
      errors,
    });
  } catch (err) {
    next(err);
  }
};
