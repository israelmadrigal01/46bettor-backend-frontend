// utils/cache.js (CommonJS)
class MemoryCache {
  constructor() { this.store = new Map(); }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt && hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key, value, ttlSec = 0) {
    const expiresAt = ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0;
    this.store.set(key, { value, expiresAt });
    return value;
  }
}
const cache = new MemoryCache();

async function withCache(key, ttlSec, fn) {
  const v = cache.get(key);
  if (v !== undefined) return v;
  const fresh = await fn();
  cache.set(key, fresh, ttlSec);
  return fresh;
}

module.exports = { cache, withCache };
