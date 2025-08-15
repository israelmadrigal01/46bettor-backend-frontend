// controllers/picksLiveController.js
const axios = require('axios');
const { enrichPicks, summarizeEnriched, listAliases } = require('../services/picksLiveService');

function cleanDate(d) {
  if (!d) return undefined;
  return /^\d{8}$/.test(d) ? d : undefined;
}
function cleanFlex(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(180, Math.trunc(n))); // 0..180 days
}
function asBool(v) {
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  return false;
}

exports.ping = (_req, res) => res.json({ ok: true, router: 'picks-live' });

// GET: demo (no body)
exports.demo = async (_req, res) => {
  try {
    const picks = [
      { team: 'Home Demo' },
      { team: 'Home Hoopers' },
      { matchup: 'Away Demo @ Home Demo' }
    ];
    const enriched = await enrichPicks(picks, { demo: true });
    res.json({ ok: true, count: enriched.length, picks: enriched });
  } catch (err) {
    console.error('[picks-live/demo] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

// GET: enrich via query (?league=...&date=YYYYMMDD&teams=A,B,C@D&flex=3&nearest=true)
exports.enrichGet = async (req, res) => {
  try {
    const league = req.query.league || undefined;
    const sport  = req.query.sport || undefined;
    const date   = cleanDate(req.query.date);
    const flex   = cleanFlex(req.query.flex);
    const nearest = asBool(req.query.nearest || req.query.nearestHeadToHead);
    const nearestFlex = cleanFlex(req.query.nearestFlexDays);
    const teamsParam = req.query.teams || 'Yankees,Red Sox,Dodgers@Giants';

    const picks = String(teamsParam)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(t => t.includes('@') ? ({ matchup: t }) : ({ team: t }));

    const enriched = await enrichPicks(picks, {
      league, sport, date, demo: false,
      flexDays: flex,
      nearestHeadToHead: nearest,
      nearestFlexDays: nearestFlex
    });
    res.json({ ok: true, count: enriched.length, picks: enriched });
  } catch (err) {
    console.error('[picks-live/enrich-get] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

// POST: enrich with JSON body { picks: [...], league?, sport?, date?, flexDays?, nearestHeadToHead?, nearestFlexDays? }
exports.enrich = async (req, res) => {
  try {
    const { picks, league, sport, date, demo, flexDays, nearestHeadToHead, nearestFlexDays } = req.body || {};
    if (!Array.isArray(picks)) {
      return res.status(400).json({ ok: false, error: 'Body must include array "picks"' });
    }
    const enriched = await enrichPicks(picks, {
      league: league || undefined,
      sport:  sport  || undefined,
      date:   cleanDate(date),
      demo:   Boolean(demo),
      flexDays: cleanFlex(flexDays),
      nearestHeadToHead: Boolean(nearestHeadToHead),
      nearestFlexDays: cleanFlex(nearestFlexDays),
    });
    res.json({ ok: true, count: enriched.length, picks: enriched });
  } catch (err) {
    console.error('[picks-live/enrich] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

// POST: summary
exports.summary = async (req, res) => {
  try {
    const { picks, league, sport, date, demo, flexDays, nearestHeadToHead, nearestFlexDays } = req.body || {};
    if (!Array.isArray(picks)) {
      return res.status(400).json({ ok: false, error: 'Body must include array "picks"' });
    }
    const enriched = await enrichPicks(picks, {
      league: league || undefined,
      sport:  sport  || undefined,
      date:   cleanDate(date),
      demo:   Boolean(demo),
      flexDays: cleanFlex(flexDays),
      nearestHeadToHead: Boolean(nearestHeadToHead),
      nearestFlexDays: cleanFlex(nearestFlexDays),
    });
    const summary = summarizeEnriched(enriched);
    res.json({ ok: true, summary, sampleCounts: enriched.length });
  } catch (err) {
    console.error('[picks-live/summary] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

// GET: aliases for a league (so you know what will match)
exports.aliases = async (req, res) => {
  try {
    const league = (req.query.league || 'mlb').toLowerCase();
    const aliases = listAliases(league);
    res.json({ ok: true, league, count: aliases.length, aliases });
  } catch (err) {
    console.error('[picks-live/aliases] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

// GET: from-existing — calls your /api/picks and enriches the result
exports.fromExisting = async (req, res) => {
  try {
    const baseURL = `http://127.0.0.1:${process.env.PORT || 5050}`;
    const passthrough = new URLSearchParams(
      Object.entries(req.query || {}).filter(([k]) => !['league','sport','date','flex','flexDays','nearest','nearestHeadToHead','nearestFlexDays'].includes(k))
    ).toString();
    const url = `${baseURL}/api/picks${passthrough ? `?${passthrough}` : ''}`;

    const { data } = await axios.get(url, { timeout: 20000 });

    let source = [];
    if (Array.isArray(data)) source = data;
    else if (Array.isArray(data?.data)) source = data.data;
    else if (Array.isArray(data?.picks)) source = data.picks;
    else if (Array.isArray(data?.result)) source = data.result;

    if (!Array.isArray(source)) {
      return res.status(502).json({ ok: false, error: 'Could not read picks from /api/picks' });
    }

    const league = req.query.league || undefined;
    const sport  = req.query.sport || undefined;
    const date   = cleanDate(req.query.date);
    const flex   = cleanFlex(req.query.flex || req.query.flexDays);
    const nearest = asBool(req.query.nearest || req.query.nearestHeadToHead);
    const nearestFlex = cleanFlex(req.query.nearestFlexDays);

    const enriched = await enrichPicks(source, {
      league, sport, date, demo: false,
      flexDays: flex,
      nearestHeadToHead: nearest,
      nearestFlexDays: nearestFlex
    });
    res.json({ ok: true, count: enriched.length, picks: enriched });
  } catch (err) {
    console.error('[picks-live/from-existing] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};
