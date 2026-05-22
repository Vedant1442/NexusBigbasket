const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * manual_browser_install.js
 * Forces Playwright to install Chromium into a local, predictable directory.
 */
const BROWSERS_PATH = path.join(__dirname, 'ms-playwright');

console.log(`[Install] 🛠️  Installing Playwright browsers into: ${BROWSERS_PATH}`);

try {
  // Ensure directory exists
  if (!fs.existsSync(BROWSERS_PATH)) {
    fs.mkdirSync(BROWSERS_PATH, { recursive: true });
  }

  // Set environment variable for the install command
  process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS_PATH;

  // Run install command
  console.log(`[Install] 📥 Downloading Chromium...`);
  execSync('npx playwright install chromium', { stdio: 'inherit' });
  
  // Also try to install Python dependencies if pip is available
  try {
    console.log(`[Install] 🐍 Installing Python dependencies...`);
    const pipCmd = process.platform === 'win32' ? 'pip' : 'pip3';
    execSync(`${pipCmd} install -r requirements.txt`, { stdio: 'inherit' });
    console.log(`[Install] ✅ Python dependencies installed.`);
  } catch (pipErr) {
    console.warn(`[Install] ⚠️ Could not install Python dependencies via pip: ${pipErr.message}`);
    console.warn(`[Install] ℹ️ Ensure Python and pip are installed in your environment.`);
  }

  console.log(`[Install] ✅ Installation process complete.`);
} catch (err) {
  console.error(`[Install] ❌ Failed to install browsers: ${err.message}`);
  process.exit(1);
}
