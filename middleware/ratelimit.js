// middleware/ratelimit.js
module.exports = function rateLimit(opts = {}) {
  const windowMs = Number(opts.windowMs ?? 60_000);
  const limit    = Number(opts.limit ?? 60);
  const hits = new Map(); // key -> { count, reset }

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    let entry = hits.get(key);
    if (!entry || now > entry.reset) entry = { count: 0, reset: now + windowMs };
    entry.count += 1;
    hits.set(key, entry);

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(entry.reset));

    if (hits.size > 1000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);

    if (entry.count > limit) return res.status(429).json({ ok: false, error: 'Too many requests' });
    next();
  };
};
