// utils/routesList.js
function listRoutes(app) {
  const out = [];
  app._router?.stack?.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(',').toUpperCase();
      out.push({ path: m.route.path, methods });
    } else if (m.name === 'router' && m.handle.stack) {
      m.handle.stack.forEach((h) => {
        if (h.route) {
          const methods = Object.keys(h.route.methods).join(',').toUpperCase();
          out.push({ base: m.regexp?.toString(), path: h.route.path, methods });
        }
      });
    }
  });
  return out;
}
module.exports = { listRoutes };
