const NodeCache = require('node-cache');
const { CACHE } = require('../config');

const cache = new NodeCache({
  stdTTL: CACHE.ttlSeconds,
  checkperiod: 120,
  useClones: false,
});

/**
 * Önbellekten oku ya da üret
 * @param {string} key
 * @param {Function} factory - async () => value
 */
async function getOrSet(key, factory) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    console.log(`[CACHE HIT] ${key}`);
    return cached;
  }
  console.log(`[CACHE MISS] ${key} — üretiliyor...`);
  const value = await factory();
  
  // Sadece mantıklı/dolu sonuçları cache'le
  if (value && (!value.results || value.results.length > 0)) {
    cache.set(key, value);
  }
  
  return value;
}

function invalidate(key) {
  cache.del(key);
}

function stats() {
  return cache.getStats();
}

module.exports = { getOrSet, invalidate, stats };
