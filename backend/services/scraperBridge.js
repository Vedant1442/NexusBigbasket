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
const path = require('path');

// ─── In-memory deduplication registry ────────────────────────────────────────
// key: `${keyword}::${pincode}` → Array of { onComplete, onError } callbacks
const _inProgress = new Map();

/**
 * Spawns (or joins an in-flight) scraper process.
 */
function spawnScraper(keyword, pincode, start_page = 1, onComplete, onError) {
  // If start_page is a function, it means it wasn't provided (legacy call)
  if (typeof start_page === 'function') {
    onError = onComplete;
    onComplete = start_page;
    start_page = 1;
  }

  const key = `${keyword.toLowerCase()}::${pincode}::${start_page}`;

  // ── Deduplication: queue up if already scanning ───────────────────────────
  if (_inProgress.has(key)) {
    console.log(`[ScraperBridge] Already scanning "${keyword}" @ ${pincode} (page ${start_page}) — queueing callback`);
    _inProgress.get(key).push({ onComplete, onError });
    return;
  }

  // Register this request as in-flight with an initial callback
  _inProgress.set(key, [{ onComplete, onError }]);
  console.log(`[ScraperBridge] 🚀 Spawning Optimized Python Scraper: "${keyword}" @ ${pincode} (page ${start_page})`);

  const scraperPath = path.join(__dirname, '..', 'scraper.py');
  
  // Use 'python' or 'python3' depending on the environment
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  const pythonProcess = spawn(pythonCmd, [scraperPath, keyword, pincode, String(start_page)]);

  let stdoutData = '';
  let stderrData = '';

  pythonProcess.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    // Pipe Python logs (stderr) to Node console for debugging
    process.stderr.write(data);
    stderrData += data.toString();
  });

  pythonProcess.on('close', (code) => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);

    if (code !== 0) {
      console.error(`[ScraperBridge] ❌ Python process exited with code ${code}`);
      callbacks.forEach(({ onError: cb }) => cb(new Error(`Python process exited with code ${code}`)));
      return;
    }

    // Extract the JSON result from stdout
    const resultMatch = stdoutData.match(/__RESULT__(.*)/);
    if (resultMatch) {
      try {
        const results = JSON.parse(resultMatch[1]);
        console.log(`[ScraperBridge] ✅ Got ${results.length} product(s) for "${keyword}" @ ${pincode}`);
        callbacks.forEach(({ onComplete: cb }) => cb(results));
      } catch (err) {
        console.error(`[ScraperBridge] ❌ Failed to parse JSON result: ${err.message}`);
        callbacks.forEach(({ onError: cb }) => cb(err));
      }
    } else {
      console.warn(`[ScraperBridge] ⚠️  No __RESULT__ marker found in Python output`);
      callbacks.forEach(({ onComplete: cb }) => cb([]));
    }
  });

  pythonProcess.on('error', (err) => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);
    console.error(`[ScraperBridge] ❌ Failed to spawn Python process: ${err.message}`);
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
