// index.js — 46bettor backend (CommonJS, quiet logs)

// 1) Env
require('dotenv').config();

// 2) Core
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

/* -------------------------- Config -------------------------- */

app.set('trust proxy', true);

// Port
const PORT = Number(process.env.PORT || 5050);

// Prefer MONGODB_URI but accept other names
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

// Helper: safe require of optional files (CommonJS only)
function safeRequire(paths) {
  for (const p of paths) {
    try {
      const m = require(p);
      return m && (m.default || m);
    } catch (_) {}
  }
  return null;
}

// Helper: mount a router if it exists; log only on success
function mountIfExists(paths, mountPath, label) {
  const m = safeRequire(paths);
  if (m) {
    app.use(mountPath, m);
    console.log(`[mount] ${label} → ${mountPath}`);
    return true;
  }
  return false;
}

/* -------------------------- CORS ---------------------------- */

const DEFAULT_ORIGINS = [
  // production frontends
  'https://app.46bettor.com',
  'https://46bettor.com',
  'https://www.46bettor.com',
  // local dev
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
      if (!origin) return cb(null, true); // curl/Postman
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-key'],
    credentials: false,
    maxAge: 86400,
  })
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* -------------------------- Public: always-on ---------------- */

// Simple public health (always available)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: '46bettor-backend/health',
    ts: new Date().toISOString(),
    port: String(PORT),
  });
});

/* -------------------------- Public routers ------------------ */

// Try to mount your routes/public loader (quiet version recommended)
let publicWasMounted = mountIfExists(
  ['./routes/public/index.js', './routes/public.js', './routes/public'],
  '/api/public',
  'routes/public'
);

// If not present, provide a tiny fallback with /api/public/health
if (!publicWasMounted) {
  const r = express.Router();
  r.get('/health', (_req, res) => {
    res.json({ ok: true, service: '46bettor-backend/public', ts: new Date().toISOString() });
  });
  app.use('/api/public', r);
  console.log('[mount] fallback public → /api/public');
}

// Mount public schedule routes explicitly (guaranteed if file exists)
try {
  const publicSchedule = require('./routes/public-schedule.js');
  app.use('/api/public', publicSchedule);
  console.log('[public] mounted public-schedule.js');
} catch (e) {
  console.warn('[public] public-schedule.js not found or failed to load:', e?.message || e);
}

// Direct public pick-by-id route (works even if routes/public is missing)
const PremiumPick =
  safeRequire(['./models/PremiumPick.js', './models/PremiumPick', './models/Pick.js', './models/picks.js']) || null;

app.get('/api/public/picks/:id', async (req, res) => {
  try {
    if (!PremiumPick) {
      return res.status(500).json({ ok: false, error: 'model_not_loaded' });
    }
    const id = req.params.id;
    let doc = null;

    // Try ObjectId lookup
    if (id && id.length >= 12) {
      try {
        doc = await PremiumPick.findById(id).lean();
      } catch (_) {}
    }
    // Fallback external id / custom field
    if (!doc) {
      doc = await PremiumPick.findOne({ id }).lean();
    }
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    return res.json({ ok: true, pick: doc });
  } catch (err) {
    console.error('[ERROR] /api/public/picks/:id', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ---------------------- Admin key guard --------------------- */
// Applies to /api/* except /api/health and /api/public/*
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

mountIfExists(['./routes/metrics/index.js', './routes/metrics.js'], '/api/metrics', 'routes/metrics');
mountIfExists(['./routes/premium/index.js', './routes/premium.js', './routes/premiumRoutes.js'], '/api/premium', 'routes/premium');
mountIfExists(['./routes/app/index.js', './routes/app.js', './routes/appRoutes.js'], '/api/app', 'routes/app');
mountIfExists(['./routes/devpanel/index.js', './routes/devpanel.js', './routes/devpanelRoutes.js'], '/api/devpanel', 'routes/devpanel');

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
