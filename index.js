// index.js — 46bettor backend (CommonJS)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

/* -------------------------- Config -------------------------- */

app.set('trust proxy', true);
const PORT = Number(process.env.PORT || 5050);

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL ||
    ''
  );
}
const MONGO_URI = getMongoUri();

if (!process.env.ADMIN_KEY) {
  console.warn('[WARN] ADMIN_KEY not set — protected routes will reject.');
}

function safeRequire(paths) {
  for (const p of paths) {
    try {
      const m = require(p);
      return m && (m.default || m);
    } catch (_) {}
  }
  return null;
}

/* -------------------------- CORS ---------------------------- */

const DEFAULT_ORIGINS = [
  'https://app.46bettor.com',
  'https://46bettor.com',
  'https://www.46bettor.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5050',
  'http://127.0.0.1:5050',
];
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-key'],
    credentials: false,
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------------------------- Public: always-on ---------------- */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: '46bettor-backend/health',
    ts: new Date().toISOString(),
    port: String(PORT),
  });
});

/* -------------------------- Public routers ------------------ */

const publicRouter = safeRequire(['./routes/public/index.js', './routes/public.js', './routes/public']);
if (publicRouter) {
  app.use('/api/public', publicRouter);
  console.log('[mount] routes/public → /api/public');
} else {
  console.warn('[INFO] routes/public not found — skipping /api/public');
}

try {
  const publicSchedule = require('./routes/public-schedule.js');
  app.use('/api/public', publicSchedule);
  console.log('[public] mounted public-schedule.js');
} catch (e) {
  console.warn('[public] public-schedule.js not found or failed to load:', e?.message || e);
}

try {
  const publicExtras = require('./routes/public-extras.js');
  app.use('/api/public', publicExtras);
  console.log('[public] mounted public-extras.js');
} catch (e) {
  console.warn('[public] public-extras.js not found or failed to load:', e?.message || e);
}

try {
  const publicOdds = require('./routes/public-odds.js');
  app.use('/api/public', publicOdds);
  console.log('[public] mounted public-odds.js');
} catch (e) {
  console.warn('[public] public-odds.js not found or failed to load:', e?.message || e);
}

// Public pick-by-id (works even if routes/public is missing)
const PremiumPick =
  safeRequire(['./models/PremiumPick.js', './models/PremiumPick', './models/Pick.js', './models/picks.js']) || null;

app.get('/api/public/picks/:id', async (req, res) => {
  try {
    if (!PremiumPick) {
      return res.status(500).json({ ok: false, error: 'model_not_loaded' });
    }
    const id = req.params.id;
    let doc = null;
    if (id && id.length >= 12) {
      try { doc = await PremiumPick.findById(id).lean(); } catch (_) {}
    }
    if (!doc) doc = await PremiumPick.findOne({ id }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, pick: doc });
  } catch (err) {
    console.error('[ERROR] /api/public/picks/:id', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ---------------------- Admin key guard --------------------- */

app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/health' || req.path.startsWith('/public')) return next();

  const key = req.get('x-admin-key');
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
});

/* ---------------------- Protected routes -------------------- */

const metricsRouter = safeRequire(['./routes/metrics/index.js', './routes/metrics.js']);
if (metricsRouter) {
  app.use('/api/metrics', metricsRouter);
  console.log('[mount] routes/metrics → /api/metrics');
} else {
  console.warn('[INFO] routes/metrics not found — skipping /api/metrics');
}

const premiumRouter = safeRequire(['./routes/premium/index.js', './routes/premium.js', './routes/premiumRoutes.js']);
if (premiumRouter) {
  app.use('/api/premium', premiumRouter);
  console.log('[mount] routes/premium → /api/premium');
} else {
  console.warn('[INFO] premium routes not found — skipping /api/premium');
}

const appRouter = safeRequire(['./routes/app/index.js', './routes/app.js', './routes/appRoutes.js']);
if (appRouter) {
  app.use('/api/app', appRouter);
  console.log('[mount] routes/app → /api/app');
} else {
  console.warn('[INFO] app routes not found — skipping /api/app');
}

const devpanelRouter = safeRequire(['./routes/devpanel/index.js', './routes/devpanel.js', './routes/devpanelRoutes.js']);
if (devpanelRouter) {
  app.use('/api/devpanel', devpanelRouter);
  console.log('[mount] routes/devpanel → /api/devpanel');
} else {
  console.warn('[INFO] devpanel routes not found — skipping /api/devpanel');
}

/* -------------------------- 404 for /api -------------------- */

app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

/* -------------------------- DB + Server --------------------- */

async function start() {
  try {
    if (!MONGO_URI) {
      console.warn('[WARN] No Mongo URI set. Set MONGODB_URI (or MONGO_URI/MONGO_URL/DATABASE_URL) in .env');
    } else {
      mongoose.set('strictQuery', true);
      await mongoose.connect(MONGO_URI);
      console.log('[OK] Mongo connected');
    }

    app.listen(PORT, () => {
      console.log(`[OK] 46bettor-backend listening on :${PORT}`);
      console.log('[CORS] Allowed origins:', ALLOWED_ORIGINS.join(', '));
    });
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

start();
