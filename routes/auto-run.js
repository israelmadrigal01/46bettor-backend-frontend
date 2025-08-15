// routes/auto-run.js
const express = require('express');
const router = express.Router();

/** Helper: truthy query */
const qTrue = v => v === true || v === 'true' || v === '1' || v === 1;

/** Build base URL to call ourselves */
const PORT = process.env.PORT || 5050;
const BASE = `http://127.0.0.1:${PORT}`;

/** Simple fetch JSON with status */
async function fetchJson(url, init) {
  const res = await fetch(url, init);
  let json = null;
  try { json = await res.json(); } catch (_) { /* keep null */ }
  return { status: res.status, ok: res.ok, json };
}

/** Build a query string from plain object (ignore undefined) */
function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) search.set(k, v.join(','));
    else search.set(k, String(v));
  });
  return `?${search.toString()}`;
}

/** Load user prefs (or defaults) */
async function loadPrefs() {
  const { json, ok } = await fetchJson(`${BASE}/api/prefs`);
  if (!ok || !json) {
    // sensible defaults if prefs route is missing
    return {
      sports: ['NBA', 'NFL', 'NHL', 'MLB'],
      kellyMultiplier: 0.5,
      maxStakePct: 0.02,
      tickets: 3,
      risk: 'normal',
    };
  }
  return (json.prefs || json.defaults || {
    sports: ['NBA', 'NFL', 'NHL', 'MLB'],
    kellyMultiplier: 0.5,
    maxStakePct: 0.02,
    tickets: 3,
    risk: 'normal',
  });
}

/** Load bankroll balanceUnits */
async function loadBankroll() {
  const { ok, json } = await fetchJson(`${BASE}/api/bankroll/balance`);
  if (ok && json && typeof json.balanceUnits === 'number') return json.balanceUnits;
  // fallback if bankroll route missing
  return 100;
}

/** Compute a compact plan summary (no external deps) */
function planSummary(bankrollUnits, tickets, risk, maxPct) {
  const perTicketUnits = Math.max(1, Math.round(bankrollUnits * (maxPct || 0.02)));
  const totalUnits = perTicketUnits * (tickets || 1);
  const overallCapPct = (maxPct || 0.02) * (risk === 'conservative' ? 1.5 : risk === 'aggressive' ? 3 : 2);
  return { bankrollUnits, tickets, perTicketUnits, totalUnits, risk, maxPct, overallCapPct };
}

/**
 * GET /api/auto-run/run
 * Query:
 *   dryRun=1 | commit=1
 *   bankroll, tickets, sports (CSV), risk, maxStakePct, kellyMultiplier
 *   debug=1 to include internals
 *
 * Strategy:
 *   1) Use prefs + balance if params not provided.
 *   2) Try upstream /api/app/recommend/(preview|commit).
 *   3) If upstream 404/500, fallback to /api/premium/suggest(/commit).
 */
router.get('/run', async (req, res) => {
  try {
    const debug = qTrue(req.query.debug);
    const wantDry = qTrue(req.query.dryRun);
    const wantCommit = qTrue(req.query.commit) && !wantDry;

    // 1) prefs + bankroll (allow overrides from query)
    const prefs = await loadPrefs();
    const bankrollUnits = req.query.bankroll ? Number(req.query.bankroll) : await loadBankroll();

    const sports = req.query.sports
      ? String(req.query.sports).split(',').filter(Boolean)
      : (prefs.sports || ['NBA', 'NFL', 'NHL', 'MLB']);

    const tickets = req.query.tickets ? Number(req.query.tickets) : (prefs.tickets || 2);
    const risk = req.query.risk || prefs.risk || 'normal';
    const maxStakePct = req.query.maxStakePct ? Number(req.query.maxStakePct) : (prefs.maxStakePct || 0.02);
    const kellyMultiplier = req.query.kellyMultiplier ? Number(req.query.kellyMultiplier) : (prefs.kellyMultiplier || 0.5);

    const plan = planSummary(bankrollUnits, tickets, risk, maxStakePct);
    const filters = { sports, kellyMultiplier, maxStakePct };

    // 2) upstream try: /api/app/recommend/(preview|commit)
    const upstreamPath = wantCommit ? '/api/app/recommend' : '/api/app/recommend/preview';
    const upstreamUrl = `${BASE}${upstreamPath}` + qs({
      bankroll: bankrollUnits,
      tickets,
      sports,
      risk,
      maxStakePct,
      kellyMultiplier,
      commit: wantCommit ? true : undefined,
    });

    let upstream = await fetchJson(upstreamUrl);
    let usedUpstream = upstream.ok && upstream.json && upstream.json.ok !== false;

    // 3) fallback to /api/premium/suggest(/commit) when upstream missing/404
    let payload = null;
    if (!usedUpstream) {
      if (wantCommit) {
        const fallbackUrl = `${BASE}/api/premium/suggest/commit` + qs({
          limit: tickets,
          bankroll: bankrollUnits,
          sports,
          risk,
          maxStakePct,
          kellyMultiplier,
          source: 'auto-run',
        });
        const fb = await fetchJson(fallbackUrl);
        payload = {
          committed: fb.ok && fb.json && (fb.json.committed || fb.json.results),
          ids: fb.json?.results ? fb.json.results.map(r => r.id) : null,
          plan,
          filters,
          endpoint: fallbackUrl,
          fallback: true,
          upstreamStatus: upstream.status,
        };
      } else {
        const fallbackUrl = `${BASE}/api/premium/suggest` + qs({
          limit: tickets,
          bankroll: bankrollUnits,
          sports,
          risk,
          maxStakePct,
          kellyMultiplier,
          source: 'auto-run',
        });
        const fb = await fetchJson(fallbackUrl);
        payload = {
          ok: fb.ok,
          date: new Date().toISOString().slice(0, 10),
          sport: 'RUN',
          inserted: 0,
          results: fb.json?.suggestions || [],
          count: Array.isArray(fb.json?.suggestions) ? fb.json.suggestions.length : 0,
          plan,
          filters,
          endpoint: fallbackUrl,
          fallback: true,
          upstreamStatus: upstream.status,
        };
      }
    } else {
      // happy path: use upstream app responses
      if (wantCommit) {
        payload = {
          committed: upstream.json?.committed || !!upstream.json?.commitResults,
          ids: upstream.json?.commitResults?.results?.map(r => r.id) || null,
          plan: upstream.json?.plan || plan,
          filters,
          endpoint: upstreamUrl,
          fallback: false,
        };
      } else {
        const recs = upstream.json?.recommendations || upstream.json?.recs || [];
        payload = {
          ok: true,
          date: new Date().toISOString().slice(0, 10),
          sport: 'RUN',
          inserted: 0,
          results: recs,
          count: Array.isArray(recs) ? recs.length : 0,
          plan: upstream.json?.plan || plan,
          filters,
          endpoint: upstreamUrl,
          fallback: false,
        };
      }
    }

    if (debug) {
      payload.debug = {
        prefsStatus: 'loaded',
        balanceStatus: 'loaded',
        upstreamTried: upstreamUrl,
        upstreamOk: usedUpstream,
        upstreamStatus: upstream.status,
        upstreamKeys: upstream.json ? Object.keys(upstream.json) : null,
      };
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get('/ping', (_req, res) => {
  res.json({ ok: true, route: '/api/auto-run/run', ts: new Date().toISOString() });
});

module.exports = router;
