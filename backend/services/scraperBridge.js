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

const { spawn } = require('child_process');
const path       = require('path');

// ─── In-memory deduplication registry ────────────────────────────────────────
// key: `${keyword}::${pincode}` → Array of { onComplete, onError } callbacks
const _inProgress = new Map();

/**
 * Spawns (or joins an in-flight) scraper process.
 *
 * @param {string}   keyword     - Search term (e.g. "coffee")
 * @param {string}   pincode     - 6-digit Indian pincode (e.g. "431001")
 * @param {Function} onComplete  - Called with (products: object[]) when done
 * @param {Function} onError     - Called with (Error) if scraper fails
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
  console.log(`[ScraperBridge] 🚀 Spawning scraper: "${keyword}" @ ${pincode}`);

  const scriptPath = path.join(__dirname, '..', 'scraper.py');
  const proc = spawn('python', [scriptPath, keyword, pincode], {
    // Run from backend/ so relative .env and proxies.txt are found
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    // Separate stdout/stderr pipes so Python logs don't mix with JSON
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });

  // Pipe Python stderr → Node console (preserves emoji progress logs)
  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    process.stdout.write(`[scraper.py] ${chunk.toString()}`);
  });

  proc.on('close', (code) => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);

    if (code !== 0) {
      const err = new Error(`scraper.py exited with code ${code}. Last stderr: ${stderr.slice(-300)}`);
      console.error(`[ScraperBridge] ❌ ${err.message}`);
      callbacks.forEach(({ onError: cb }) => cb(err));
      return;
    }

    // Find the __RESULT__ line in stdout (robust against extra print lines)
    const resultLine = stdout.split('\n').find(l => l.startsWith('__RESULT__'));
    if (!resultLine) {
      const err = new Error(`scraper.py produced no __RESULT__ line. stdout: ${stdout.slice(-300)}`);
      console.error(`[ScraperBridge] ❌ ${err.message}`);
      callbacks.forEach(({ onError: cb }) => cb(err));
      return;
    }

    try {
      const products = JSON.parse(resultLine.slice('__RESULT__'.length));
      console.log(`[ScraperBridge] ✅ Got ${products.length} product(s) for "${keyword}" @ ${pincode}`);
      callbacks.forEach(({ onComplete: cb }) => cb(products));
    } catch (parseErr) {
      console.error(`[ScraperBridge] ❌ JSON parse error: ${parseErr.message}`);
      callbacks.forEach(({ onError: cb }) => cb(parseErr));
    }
  });

  proc.on('error', (spawnErr) => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);
    console.error(`[ScraperBridge] ❌ Spawn error: ${spawnErr.message}`);
    callbacks.forEach(({ onError: cb }) => cb(spawnErr));
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
