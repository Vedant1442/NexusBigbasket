const fs = require("fs");
const path = require("path");

function exists(p) {
  try {
    return Boolean(p && fs.existsSync(p));
  } catch {
    return false;
  }
}

function pushUnique(out, p) {
  if (!p) return;
  const s = String(p).trim();
  if (s && !out.includes(s)) out.push(s);
}

/**
 * Finds a Chromium-based binary for Puppeteer when the Puppeteer-managed
 * Chrome revision is missing (common on CI or sandboxed installs).
 * @returns {string|null}
 */
function resolveChromiumExecutable() {
  /** @type {string[]} */
  const acc = [];

  const env =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.GOOGLE_CHROME_BIN;
  pushUnique(acc, env);

  try {
    const puppeteer = require("puppeteer");
    if (typeof puppeteer.executablePath === "function") {
      pushUnique(acc, puppeteer.executablePath());
    }
  } catch {
    /* optional */
  }

  const platform = process.platform;
  if (platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);
    const pairs = [
      ["Google", "Chrome", "Application", "chrome.exe"],
      ["Microsoft", "Edge", "Application", "msedge.exe"],
    ];
    for (const root of roots) {
      for (const rel of pairs) pushUnique(acc, path.join(root, ...rel));
    }
    pushUnique(acc, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
    pushUnique(acc, "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe");
  } else if (platform === "darwin") {
    pushUnique(
      acc,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );
    pushUnique(acc, "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge");
  } else {
    pushUnique(acc, "/usr/bin/google-chrome-stable");
    pushUnique(acc, "/usr/bin/google-chrome");
    pushUnique(acc, "/usr/bin/chromium");
    pushUnique(acc, "/usr/bin/chromium-browser");
  }

  for (const c of acc) if (exists(c)) return c;
  return null;
}

module.exports = resolveChromiumExecutable;
