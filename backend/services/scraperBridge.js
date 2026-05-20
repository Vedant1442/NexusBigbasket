/**
 * services/scraperBridge.js
 *
 * Node.js bridge between the NEXUS-V2 Express/WS server and the async Python
 * Playwright scraper (scraper.py).
 *
 * Key features:
 *   • Spawns scraper.py as a detached child process via child_process.spawn
 *   • All Python print() logs go to stderr → visible in Node console but don't
 *     pollute the stdout pipe used for JSON result extraction
 *   • The final line of stdout is expected to start with "__RESULT__" followed
 *     by a JSON array — everything else is ignored
 *   • In-memory deduplication registry prevents "thundering herd" — if two
 *     clients search for the same keyword+pincode simultaneously, only one
 *     scraper process is spawned; both callbacks are invoked on completion
 */

const { scrapeBigBasket } = require('./scraper');

// ─── In-memory deduplication registry ────────────────────────────────────────
// key: `${keyword}::${pincode}` → Array of { onComplete, onError } callbacks
const _inProgress = new Map();

/**
 * Spawns (or joins an in-flight) scraper process.
 */
function spawnScraper(keyword, pincode, onComplete, onError) {
  const key = `${keyword.toLowerCase()}::${pincode}`;

  // ── Deduplication: queue up if already scanning ───────────────────────────
  if (_inProgress.has(key)) {
    console.log(`[ScraperBridge] Already scanning "${keyword}" @ ${pincode} — queueing callback`);
    _inProgress.get(key).push({ onComplete, onError });
    return;
  }

  // Register this request as in-flight with an initial callback
  _inProgress.set(key, [{ onComplete, onError }]);
  console.log(`[ScraperBridge] 🚀 Triggering Node-based scraper: "${keyword}" @ ${pincode}`);

  scrapeBigBasket(keyword, pincode, (results) => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);
    
    if (results && results.length > 0) {
      console.log(`[ScraperBridge] ✅ Got ${results.length} product(s) for "${keyword}" @ ${pincode}`);
      callbacks.forEach(({ onComplete: cb }) => cb(results));
    } else {
      console.warn(`[ScraperBridge] ⚠️  No results returned for "${keyword}"`);
      callbacks.forEach(({ onComplete: cb }) => cb([]));
    }
  }).catch(err => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);
    console.error(`[ScraperBridge] ❌ Scrape Error: ${err.message}`);
    callbacks.forEach(({ onError: cb }) => cb(err));
  });
}

/**
 * Returns true if a scraper is already running for the given keyword+pincode.
 * Useful for UI "scanning" state deduplication checks.
 */
function isScanning(keyword, pincode) {
  return _inProgress.has(`${keyword.toLowerCase()}::${pincode}`);
}

module.exports = { spawnScraper, isScanning };
