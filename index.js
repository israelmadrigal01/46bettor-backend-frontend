cat > index.js <<'EOF'
// index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

/* -------------------------- Config & Helpers -------------------------- */
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
  console.warn('[WARN] ADMIN_KEY is not set in env — protected routes will reject all requests.');
}

function safeRequire(candidates) {
  for (const rel of candidates) {
    try {
      const mod = require(rel);
      if (mod) return mod.default || mod;
    } catch (_) {}
  }
  return null;
}

/* ------------------------------ CORS --------------------------------- */
const DEFAULT_ORIGINS = [
  'https://app.46bettor.com',
  'https://46bettor.com',
  'https://www.46bettor.com',
  'https://shimmering-semolina-2e6f34.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5050',
  'http://127.0.0.1:5050',
];

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',')
  .map(s => s.trim())
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

/* ------------------------------ Public Routes ------------------------ */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: '46bettor-backend/health',
    ts: new Date().toISOString(),
    port: String(PORT),
  });
});

const publicRouter = safeRequire(['./routes/public']);
if (publicRouter) {
  app.use('/api/public', publicRouter);
} else {
  console.warn('[INFO] routes/public not found — skipping /api/public');
}

/* ---- Public pick-by-id (direct, guaranteed) ------------------------- */
const PremiumPick = safeRequire(['./models/PremiumPick']);
const { isValidObjectId, Types } = mongoose;

app.get('/api/public/picks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!PremiumPick || !isValidObjectId(id)) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    const _id = new Types.ObjectId(id);
    const doc = await PremiumPick.findById(_id).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    const pick = {
      id: String(doc._id),
      date: doc.date,
      sport: doc.sport,
      league: doc.league,
      eventId: doc.eventId ?? null,
      homeTeam: doc.homeTeam ?? null,
      awayTeam: doc.awayTeam ?? null,
      market: doc.market,
      selection: doc.selection,
      line: doc.line ?? null,
      odds: doc.odds,
      status: doc.status,
      finalScore: doc.finalScore ?? null,
      settledAt: doc.settledAt ?? null,
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    res.json({ ok: true, pick });
  } catch (e) {
    console.error('[public/picks/:id] error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ------------------------------ Admin Key Guard ---------------------- */
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/health' || req.path.startsWith('/public')) return next();
  const key = req.get('x-admin-key');
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
});

/* ------------------------------ Protected Routes --------------------- */
const metricsRouter = safeRequire(['./routes/metrics']);
if (metricsRouter) app.use('/api/metrics', metricsRouter);

const premiumRouter = safeRequire(['./routes/premium', './routes/premiumRoutes']);
if (premiumRouter) app.use('/api/premium', premiumRouter);

const appRouter = safeRequire(['./routes/app', './routes/appRoutes']);
if (appRouter) app.use('/api/app', appRouter);

const devpanelRouter = safeRequire(['./routes/devpanel', './routes/devpanelRoutes']);
if (devpanelRouter) app.use('/api/devpanel', devpanelRouter);

/* ------------------------------ 404 for /api ------------------------- */
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

/* ------------------------------ Server & DB -------------------------- */
async function start() {
  try {
    const uri = MONGO_URI;
    if (!uri) {
      console.warn('[WARN] No Mongo URI set. Set MONGODB_URI (or MONGO_URI/MONGO_URL/DATABASE_URL) in env');
    } else {
      mongoose.set('strictQuery', true);
      await mongoose.connect(uri);
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
EOF
