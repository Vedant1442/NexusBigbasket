/**
 * Short-TTL search cache keyed by geo grid + query to dedupe bursts and
 * serve instant stale-while-fresh snapshots when acceptable.
 */

const DEFAULT_TTL_MS = parseInt(process.env.SEARCH_CACHE_TTL_MS || "75000", 10);
const GRID_DECIMALS = Math.min(
  5,
  Math.max(2, parseInt(process.env.SEARCH_GRID_DECIMALS || "3", 10))
);

/** @type {Map<string, { storedAt: number, payload: { products: object, fetchedAt: string, dataSource: string } }>} */
const store = new Map();
const MAX_ENTRIES = parseInt(process.env.SEARCH_CACHE_MAX || "400", 10);

function snapCoord(n) {
  return Number(Number(n).toFixed(GRID_DECIMALS));
}

function normalizeQuery(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function makeKey(searchTerm, lat, lon) {
  const la = snapCoord(lat);
  const lo = snapCoord(lon);
  return `${la}|${lo}|${normalizeQuery(searchTerm)}`;
}

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  const keys = [...store.keys()];
  const drop = Math.max(1, keys.length - Math.floor(MAX_ENTRIES * 0.85));
  for (let i = 0; i < drop; i++) store.delete(keys[i]);
}

/**
 * @returns {{ products: Record<string, any[]>, fetchedAt: string, dataSource: string } | null}
 */
function get(key, ttlMs = DEFAULT_TTL_MS) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.storedAt > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.payload;
}

/**
 * @param {string} key
 * @param {Record<string, any[]>} products
 * @param {{ fetchedAt?: string, dataSource?: string }} meta
 */
function set(key, products, meta = {}) {
  evictIfNeeded();
  store.set(key, {
    storedAt: Date.now(),
    payload: {
      products,
      fetchedAt: meta.fetchedAt || new Date().toISOString(),
      dataSource: meta.dataSource || "unknown",
    },
  });
}

function ttlMs() {
  return DEFAULT_TTL_MS;
}

module.exports = {
  makeKey,
  get,
  set,
  ttlMs,
};
