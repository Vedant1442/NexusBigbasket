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
  
  console.log(`[Install] ✅ Browser installation successful.`);
} catch (err) {
  console.error(`[Install] ❌ Failed to install browsers: ${err.message}`);
  process.exit(1);
}
