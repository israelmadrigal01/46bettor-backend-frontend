// controllers/historyController.js
'use strict';
const dayjs = require('dayjs');
const { backfillRange, listByDate, teamRecord } = require('../services/historyService');

exports.backfill = async (req, res) => {
  try {
    const sport = (req.query.sport || req.params.sport || 'MLB').toUpperCase();
    const start = req.query.start || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const end = req.query.end || start;
    const result = await backfillRange({ sport, start, end });
    res.json({ ok: true, start, end, results: result });
  } catch (e) {
    console.error('[history:backfill]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { sport = 'MLB', date, limit = 200, skip = 0 } = req.query;
    if (!date) return res.status(400).json({ ok: false, error: 'Missing ?date=YYYY-MM-DD' });
    const result = await listByDate({ sport: sport.toUpperCase(), date, limit, skip });
    res.json(result);
  } catch (e) {
    console.error('[history:list]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

exports.teamRecord = async (req, res) => {
  try {
    const { sport = 'MLB', team, start, end } = req.query;
    if (!team) return res.status(400).json({ ok: false, error: 'Missing ?team=Team Name' });
    const result = await teamRecord({ sport: sport.toUpperCase(), team, start, end });
    res.json(result);
  } catch (e) {
    console.error('[history:teamRecord]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
