// middleware/authKey.js
// Protects /api/* routes with an admin key header.
// Dev-friendly: if ADMIN_KEY is NOT set, requests are allowed (no lockout).

module.exports = function requireAdminKey(req, res, next) {
  try {
    const configured = process.env.ADMIN_KEY && String(process.env.ADMIN_KEY).trim();
    if (!configured) {
      // No key configured => allow (useful for local dev)
      return next();
    }

    const headerKey = req.get('x-admin-key');
    if (headerKey && headerKey === configured) {
      return next();
    }

    return res.status(401).json({ ok: false, error: 'unauthorized' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'auth error' });
  }
};
