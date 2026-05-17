const puppeteer = require("puppeteer");
const resolveChromiumExecutable = require("./resolveChromiumExecutable");

const SHARED_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

/**
 * Puppeteer.launch with sensible fallbacks for Windows/macOS/Linux when
 * the packaged Chromium download is unavailable.
 */
async function launchBrowser() {
  const base = { headless: "new", args: SHARED_ARGS };

  const exe = resolveChromiumExecutable();
  if (exe) {
    try {
      return await puppeteer.launch({
        ...base,
        executablePath: exe,
      });
    } catch (e) {
      console.warn(
        `[nexus] Puppeteer launch with executablePath failed (${exe}):`,
        e.message,
      );
    }
  }

  for (const channel of ["chrome", "msedge"]) {
    try {
      return await puppeteer.launch({
        ...base,
        channel,
      });
    } catch (e) {
      console.warn(`[nexus] Puppeteer channel=${channel} failed:`, e.message);
    }
  }

  try {
    return await puppeteer.launch(base);
  } catch (e) {
    console.error("[nexus] Puppeteer launch (bundled Chromium) failed:", e.message);
    throw e;
  }
}

module.exports = { launchBrowser };
