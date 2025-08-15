// utils/cache.js
class TTLCache {
  constructor() { this.store = new Map(); }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.exp <= Date.now()) { this.store.delete(key); return null; }
    return hit.val;
  }
  set(key, val, seconds = 10) {
    this.store.set(key, { val, exp: Date.now() + seconds * 1000 });
  }
  clear() { this.store.clear(); }
}
module.exports = new TTLCache();
