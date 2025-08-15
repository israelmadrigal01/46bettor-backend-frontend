// controllers/gradingController.js
const Pick = require('../models/Pick');

// POST /api/grade
// Body: { pickId, homeScore, awayScore }  OR { homeTeam, awayTeam, startTime?, homeScore, awayScore }
exports.grade = async (req, res, next) => {
  try {
    const {
      pickId,
      homeTeam,
      awayTeam,
      startTime, // optional ISO
      homeScore,
      awayScore,
    } = req.body || {};

    const h = toInt(homeScore), a = toInt(awayScore);
    if (!isFinite(h) || !isFinite(a)) {
      return res.status(400).json({ ok: false, error: 'homeScore and awayScore must be numbers' });
    }

    let picks = [];
    if (pickId) {
      const p = await Pick.findById(pickId);
      if (!p) return res.status(404).json({ ok: false, error: 'Pick not found' });
      picks = [p];
    } else if (homeTeam && awayTeam) {
      const q = {
        status: 'pending',
        homeTeam: new RegExp(`^${escapeRe(homeTeam)}$`, 'i'),
        awayTeam: new RegExp(`^${escapeRe(awayTeam)}$`, 'i'),
      };
      if (startTime) {
        const center = new Date(startTime);
        const from = new Date(center.getTime() - 12 * 3600_000);
        const to = new Date(center.getTime() + 12 * 3600_000);
        q.startTime = { $gte: from, $lte: to };
      }
      picks = await Pick.find(q);
      if (!picks.length) return res.status(404).json({ ok: false, error: 'No pending picks match that matchup/time' });
    } else {
      return res.status(400).json({ ok: false, error: 'Provide pickId OR homeTeam + awayTeam (+ optional startTime)' });
    }

    const results = [];
    for (const p of picks) {
      const g = gradeOne(p, h, a);
      const updated = await Pick.findByIdAndUpdate(
        p._id,
        { $set: { status: g.status, outcomeDetail: g.detail } },
        { new: true }
      ).lean();
      results.push(updated);
    }

    res.json({ ok: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
};

// POST /api/grade/bulk
// Body: { items: [{ pickId, homeScore, awayScore }, ...] }
exports.gradeBulk = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items || !items.length) {
      return res.status(400).json({ ok: false, error: 'items[] required' });
    }

    const results = [];
    for (const it of items) {
      const id = String(it.pickId || '');
      const h = toInt(it.homeScore), a = toInt(it.awayScore);
      if (!id || !isFinite(h) || !isFinite(a)) {
        results.push({ pickId: id, ok: false, error: 'invalid item' });
        continue;
      }
      const p = await Pick.findById(id);
      if (!p) {
        results.push({ pickId: id, ok: false, error: 'not found' });
        continue;
      }
      const g = gradeOne(p, h, a);
      const updated = await Pick.findByIdAndUpdate(
        id,
        { $set: { status: g.status, outcomeDetail: g.detail } },
        { new: true }
      ).lean();
      results.push({ pickId: id, ok: true, data: updated });
    }

    const okCount = results.filter(r => r.ok).length;
    res.json({ ok: true, graded: okCount, total: results.length, results });
  } catch (err) {
    next(err);
  }
};

function gradeOne(pick, homeScore, awayScore) {
  const market = (pick.market || '').toLowerCase(); // moneyline|spread|total
  const sel = (pick.selection || '').trim();
  const home = (pick.homeTeam || '').trim();
  const away = (pick.awayTeam || '').trim();
  const line = typeof pick.line === 'number' ? pick.line : toFloat(pick.line);

  let status = 'void';
  let detail = `${away} ${awayScore} @ ${home} ${homeScore}`;

  if (market === 'moneyline') {
    const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : 'push';
    if (winner === 'push') status = 'push';
    else if (eqTeam(sel, winner, home, away)) status = 'won';
    else status = 'lost';
  } else if (market === 'spread') {
    if (!isFinite(line)) return { status: 'void', detail: detail + ' (no line)' };
    const isSelHome = eqTeam(sel, home, home, away);
    const isSelAway = eqTeam(sel, away, home, away);
    if (!isSelHome && !isSelAway) return { status: 'void', detail: detail + ' (selection not matched to a team)' };

    const selScore = isSelHome ? homeScore : awayScore;
    const oppScore = isSelHome ? awayScore : homeScore;
    const adjSel = selScore + line; // line applies to selected team
    if (adjSel > oppScore) status = 'won';
    else if (adjSel < oppScore) status = 'lost';
    else status = 'push';
  } else if (market === 'total') {
    if (!isFinite(line)) return { status: 'void', detail: detail + ' (no total line)' };
    const sum = homeScore + awayScore;
    const s = sel.toLowerCase();
    if (s === 'over') {
      if (sum > line) status = 'won';
      else if (sum < line) status = 'lost';
      else status = 'push';
    } else if (s === 'under') {
      if (sum < line) status = 'won';
      else if (sum > line) status = 'lost';
      else status = 'push';
    } else {
      return { status: 'void', detail: detail + ' (selection must be Over/Under for totals)' };
    }
  } else {
    status = 'void';
    detail = detail + ' (unknown market)';
  }

  return { status, detail };
}

/* utils */
function eqTeam(sel, target, home, away) {
  if (!sel || !target) return false;
  const s = norm(sel), t = norm(target), h = norm(home), a = norm(away);
  return s === t || (s === 'home' && t === h) || (s === 'away' && t === a);
}
function norm(s) { return String(s || '').trim().toLowerCase(); }
function toInt(x) { const n = Number(x); return Number.isFinite(n) ? Math.trunc(n) : NaN; }
function toFloat(x) { const n = Number(x); return Number.isFinite(n) ? n : NaN; }
function escapeRe(s='') { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
