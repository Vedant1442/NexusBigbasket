/**
 * backend/services/bbBridge.js
 *
 * Asynchronous bridge for bb_extractor.py with deduplication.
 */

const { spawn } = require('child_process');
const path = require('path');

const _inProgress = new Map();

function spawnBBExtractor(keyword, pincode, onComplete, onError) {
  const key = `${keyword.toLowerCase()}::${pincode}`;

  if (_inProgress.has(key)) {
    console.log(`[BBBridge] Already scanning "${keyword}" @ ${pincode} — queueing callback`);
    _inProgress.get(key).push({ onComplete, onError });
    return;
  }

  _inProgress.set(key, [{ onComplete, onError }]);
  console.log(`[BBBridge] 🚀 Spawning bb_extractor.py: "${keyword}" @ ${pincode}`);

  const scriptPath = path.join(__dirname, '..', 'bb_extractor.py');
  const proc = spawn('python', [scriptPath, keyword, pincode], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';

  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    process.stdout.write(`[bb_extractor.py] ${chunk.toString()}`);
  });

  proc.on('close', (code) => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);

    if (code !== 0) {
      const err = new Error(`bb_extractor.py exited with code ${code}. Stderr: ${stderr}`);
      callbacks.forEach(({ onError: cb }) => cb(err));
      return;
    }

    console.log(`[BBBridge] ✅ Extraction complete for "${keyword}" @ ${pincode}`);
    callbacks.forEach(({ onComplete: cb }) => cb());
  });

  proc.on('error', (spawnErr) => {
    const callbacks = _inProgress.get(key) ?? [];
    _inProgress.delete(key);
    callbacks.forEach(({ onError: cb }) => cb(spawnErr));
  });
}

module.exports = { spawnBBExtractor };
