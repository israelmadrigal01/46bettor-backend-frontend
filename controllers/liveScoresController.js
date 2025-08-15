// controllers/liveScoresController.js
const {
  fetchLiveScores,
  summarize,
  getSavedFromDB,
  clearSavedFromDB,
  fetchMlbLinescore,
  findGameByIdFromAny,
  findGamesByTeam,
} = require('../services/liveScoresService');

// YYYYMMDD validator
function cleanDate(d) {
  if (!d) return undefined;
  const ok = /^\d{8}$/.test(d);
  return ok ? d : undefined;
}

exports.getLiveScores = async (req, res) => {
  try {
    const { sport, league, save, date, demo } = req.query;
    const saveBool = typeof save === 'string' ? save.toLowerCase() === 'true' : undefined;
    const demoBool = typeof demo === 'string' ? demo.toLowerCase() === 'true' : undefined;

    const data = await fetchLiveScores({
      sport: sport || undefined,
      league: league || undefined,
      date: cleanDate(date),
      save: saveBool,
      demo: demoBool === true,
    });

    res.json({ ok: true, count: data.length, data });
  } catch (err) {
    console.error('[getLiveScores] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

exports.getLiveSummary = async (req, res) => {
  try {
    const { sport, league, date, demo } = req.query;
    const demoBool = typeof demo === 'string' ? demo.toLowerCase() === 'true' : undefined;

    const data = await fetchLiveScores({
      sport: sport || undefined,
      league: league || undefined,
      date: cleanDate(date),
      save: false,
      demo: demoBool === true,
    });

    const summary = summarize(data);
    res.json({ ok: true, summary, sampleCounts: data.length });
  } catch (err) {
    console.error('[getLiveSummary] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

exports.getSavedLiveScores = async (req, res) => {
  try {
    const { sport, league, status, limit, sort } = req.query;
    const docs = await getSavedFromDB({
      sport: sport || undefined,
      league: league || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : 200,
      sort: sort || '-updatedAt',
    });
    res.json({ ok: true, count: docs.length, data: docs });
  } catch (err) {
    console.error('[getSavedLiveScores] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

exports.clearSavedLiveScores = async (req, res) => {
  try {
    const { sport, league, status } = req.query;
    const { deletedCount } = await clearSavedFromDB({
      sport: sport || undefined,
      league: league || undefined,
      status: status || undefined,
    });
    res.json({ ok: true, deletedCount });
  } catch (err) {
    console.error('[clearSavedLiveScores] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

exports.getGameById = async (req, res) => {
  try {
    const { id } = req.params;
    const { league, date, demo } = req.query;
    const game = await findGameByIdFromAny({
      gameId: id,
      league: league || undefined,
      date: cleanDate(date),
      demo: String(demo).toLowerCase() === 'true',
    });
    if (!game) return res.status(404).json({ ok: false, error: 'Game not found' });
    res.json({ ok: true, game });
  } catch (err) {
    console.error('[getGameById] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

exports.getMlbLinescore = async (req, res) => {
  try {
    const gamePk = req.query.gamePk;
    if (!gamePk) return res.status(400).json({ ok: false, error: 'Missing gamePk' });
    const data = await fetchMlbLinescore(String(gamePk));
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[getMlbLinescore] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};

exports.findByTeam = async (req, res) => {
  try {
    const { league, name, date } = req.query;
    if (!name) return res.status(400).json({ ok: false, error: 'Missing team name ?name=' });
    const matches = await findGamesByTeam({
      league: league || 'mlb',
      name,
      date: cleanDate(date),
    });
    res.json({ ok: true, count: matches.length, matches });
  } catch (err) {
    console.error('[findByTeam] error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
};
