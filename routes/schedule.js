// routes/schedule.js
const express = require('express');
const router = express.Router();

/**
 * In-memory daily scheduler (dev-friendly)
 * - POST /api/schedule/auto-run?time=HH:MM&commit=1|0[&query overrides...]
 * - GET  /api/schedule           -> list tasks
 * - DELETE /api/schedule/:id     -> cancel task
 * - POST /api/schedule/run-now   -> run one (id=...) or all tasks immediately
 */

const SERVICE = '46bettor-backend/schedule';
const tasks = new Map(); // id -> { id, time, endpoint, method, nextRun, timer, lastRun, enabled, meta }
let seq = 1;

const port = process.env.PORT || 5050;
const BASE = `http://127.0.0.1:${port}`;

// Utilities
function parseHHMM(s) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(s || ''));
  if (!m) throw new Error('time must be HH:MM 24h');
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new Error('time out of range');
  return { hh, mm };
}

function nextRunDateLocal(hh, mm) {
  const now = new Date();
  const d = new Date(now);
  d.setHours(hh, mm, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1); // tomorrow
  return d;
}

async function callJSON(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
  const text = await res.text();
  try {
    const json = text ? JSON.parse(text) : null;
    return { status: res.status, json };
  } catch {
    return { status: res.status, text };
  }
}

function scheduleTask(task) {
  clearTimeout(task.timer);
  const ms = task.nextRun.getTime() - Date.now();
  task.timer = setTimeout(async () => {
    // Run now
    const started = new Date();
    let result;
    try {
      result = await callJSON(task.endpoint, { method: task.method });
    } catch (err) {
      result = { status: 599, error: err.message };
    }
    task.lastRun = { ts: started.toISOString(), result };
    // schedule next day
    const { hh, mm } = parseHHMM(task.time);
    task.nextRun = nextRunDateLocal(hh, mm);
    scheduleTask(task);
  }, Math.max(0, ms));
}

function makeEndpointForAutoRun(params) {
  // Always hit your existing controller that pulls prefs + bankroll:
  //   GET /api/auto-run/run?commit=1|0&...optional overrides
  const usp = new URLSearchParams();
  if (params.commit) usp.set('commit', '1'); else usp.set('dryRun', '1');

  // Optional passthrough overrides for the upstream auto-run (e.g., sports, tickets, risk)
  const pass = ['sports', 'tickets', 'risk', 'maxStakePct', 'kellyMultiplier', 'bankroll'];
  for (const k of pass) {
    if (params[k] !== undefined && params[k] !== null && String(params[k]).length) {
      usp.set(k, String(params[k]));
    }
  }
  return `${BASE}/api/auto-run/run?${usp.toString()}`;
}

// Health
router.get('/health', (req, res) => {
  res.json({ ok: true, service: SERVICE, ts: new Date().toISOString(), tasks: tasks.size });
});

// List
router.get('/', (req, res) => {
  const list = Array.from(tasks.values()).map(t => ({
    id: t.id,
    time: t.time,
    endpoint: t.endpoint,
    method: t.method,
    enabled: t.enabled,
    nextRun: t.nextRun?.toISOString(),
    lastRun: t.lastRun || null,
    meta: t.meta || {},
  }));
  res.json({ ok: true, count: list.length, tasks: list });
});

// Create: schedule auto-run daily
// Example:
//   POST /api/schedule/auto-run?time=09:00&commit=1
//   POST /api/schedule/auto-run?time=08:55&commit=0&sports=NBA,NFL&tickets=2&risk=conservative
router.post('/auto-run', (req, res) => {
  try {
    const q = { ...req.query, ...(req.body || {}) };
    const { hh, mm } = parseHHMM(q.time);
    const commit = q.commit === '1' || q.commit === 1 || q.commit === true || q.commit === 'true';

    const endpoint = makeEndpointForAutoRun({
      commit,
      sports: q.sports,
      tickets: q.tickets,
      risk: q.risk,
      maxStakePct: q.maxStakePct,
      kellyMultiplier: q.kellyMultiplier,
      bankroll: q.bankroll,
    });

    const id = String(seq++);
    const nextRun = nextRunDateLocal(hh, mm);
    const task = {
      id,
      time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      endpoint,
      method: 'GET',
      enabled: true,
      nextRun,
      lastRun: null,
      meta: { type: 'auto-run', commit },
      timer: null,
    };
    tasks.set(id, task);
    scheduleTask(task);

    res.json({
      ok: true,
      id,
      time: task.time,
      endpoint: task.endpoint.replace(BASE, ''), // shorter
      nextRun: task.nextRun.toISOString(),
      meta: task.meta,
      tips: {
        runNow: `/api/schedule/run-now?id=${id}`,
        delete: `/api/schedule/${id}`,
        list: `/api/schedule`,
      },
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Delete (cancel)
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const t = tasks.get(id);
  if (!t) return res.status(404).json({ ok: false, error: 'Not found' });
  clearTimeout(t.timer);
  tasks.delete(id);
  res.json({ ok: true, id, cancelled: true });
});

// Run-now (one or all)
router.post('/run-now', async (req, res) => {
  const q = { ...req.query, ...(req.body || {}) };
  const id = q.id ? String(q.id) : null;

  const runOne = async (t) => {
    const started = new Date();
    try {
      const result = await callJSON(t.endpoint, { method: t.method });
      t.lastRun = { ts: started.toISOString(), result };
      return { id: t.id, ok: true, status: result.status, snippet: (result.json || result.text) };
    } catch (err) {
      t.lastRun = { ts: started.toISOString(), result: { status: 599, error: err.message } };
      return { id: t.id, ok: false, error: err.message };
    }
  };

  if (id) {
    const t = tasks.get(id);
    if (!t) return res.status(404).json({ ok: false, error: 'Not found' });
    const r = await runOne(t);
    return res.json({ ok: true, ran: 1, results: [r] });
  } else {
    const all = Array.from(tasks.values());
    const results = [];
    for (const t of all) results.push(await runOne(t));
    return res.json({ ok: true, ran: all.length, results });
  }
});

module.exports = router;
