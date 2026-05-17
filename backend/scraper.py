"""
scraper.py  — Async Blinkit hyperlocal scraper for NEXUS-V2

Usage (via Node.js child_process.spawn):
    python scraper.py <keyword> <pincode>

Outputs all progress to stderr so Node's stdout pipe only contains the
final JSON line, prefixed with __RESULT__ for reliable parsing.
"""

import sqlite3
import random
import os
import io
import sys
import json
import requests
import cloudinary
import cloudinary.uploader
from playwright.async_api import async_playwright
from playwright_stealth import stealth
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load environment — works whether cwd is backend/ or any parent directory
# ---------------------------------------------------------------------------
_env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_env_path)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG  (pulled from .env — never hardcode secrets in source)
# ─────────────────────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "blinkit_v2.db")

# Resolve DB_PATH relative to this script's directory if not absolute
if not os.path.isabs(DB_PATH):
    DB_PATH = os.path.join(os.path.dirname(__file__), DB_PATH)

cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key    = os.getenv("CLOUDINARY_API_KEY"),
    api_secret = os.getenv("CLOUDINARY_API_SECRET"),
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: Cloudinary image uploader (returns permanent secure URL or raw URL)
# ─────────────────────────────────────────────────────────────────────────────
def _upload_to_cloudinary(raw_url: str, item_name: str) -> str:
    """
    Downloads a raw image URL and uploads it to Cloudinary as a WebP file.
    Returns the permanent secure Cloudinary URL, or falls back to the raw URL
    if anything goes wrong (network error, missing credentials, etc.).
    """
    if not raw_url or raw_url == "No Image Found":
        return raw_url

    # Skip images already on Cloudinary
    if "cloudinary.com" in raw_url:
        return raw_url

    try:
        resp = requests.get(raw_url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        result = cloudinary.uploader.upload(
            io.BytesIO(resp.content),
            folder="blinkit_store",
            format="webp",
            overwrite=False,          # don't re-upload if already cached on CDN
        )
        secure_url = result["secure_url"]
        _log(f"   ☁️  CDN Uploaded  : {item_name} → {secure_url}")
        return secure_url
    except Exception as e:
        _log(f"   ⚠️  CDN Upload Failed for '{item_name}': {e}. Using raw URL.")
        return raw_url


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: log to stderr so Node's stdout pipe stays clean for JSON
# ─────────────────────────────────────────────────────────────────────────────
def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN: Async scraper – non-blocking, safe for Node child_process.spawn
# ─────────────────────────────────────────────────────────────────────────────
async def live_search_and_save(keyword: str, pincode: str = "431001") -> list[dict]:
    """
    Async version of the Blinkit hyperlocal scraper.

    Flow:
      1. Launch a visible Chromium browser via async_playwright (headless=False) to bypass bot locks for free.
      2. Inject anti-bot fingerprint shields via playwright-stealth.
      3. Set delivery location using the given pincode.
      4. Search the keyword and scroll to trigger lazy-loading.
      5. Extract product cards via vanilla JS (with resilient multi-field parsing).
      6. Upload each product image to Cloudinary CDN before saving to SQLite.
      7. Commit products to blinkit_v2.db, skipping duplicates gracefully.
      8. Return the final enriched product list.
    """
    _log("🚀 Running on Local Network (Zero Cost / Proxies Disabled)...")
    _log(f"🕵️  Searching Blinkit for '{keyword}' in Pincode {pincode}...")

    results = []

    async with async_playwright() as p:
        launch_args = ["--no-sandbox", "--disable-dev-shm-usage"]

        # 🔥 HEADLESS=FALSE: Runs visually on your desktop so Cloudflare drops its defensive block walls!
        browser = await p.chromium.launch(headless=False, args=launch_args)

        ctx_options = {"user_agent": HEADERS["User-Agent"]}
        context = await browser.new_context(**ctx_options)
        page    = await context.new_page()
        try:
            # 🛡️ Activate your anti-bot fingerprint shields completely for free
            await stealth(page)

            # ── Step A: Navigate & Set Hyperlocal Delivery Location ──────────
            await page.goto("https://blinkit.com/", wait_until="commit", timeout=25000)
            await page.locator('input[placeholder="search delivery location"]').fill(pincode)
            await page.wait_for_timeout(1500)

            # force=True punches through the translucent overlay that obscures the list
            await page.locator('div[class*="LocationSearchList__LocationDetailContainer"]').first.click(force=True)
            await page.wait_for_timeout(2000)

            # ── Step B: Open Search Bar & Submit Keyword ──────────────────────
            await page.locator('div[class*="SearchBar__AnimationWrapper"]').click(force=True)
            search_input = page.locator('input[class*="SearchBarContainer__Input"]')
            await search_input.fill(keyword)
            await search_input.press("Enter")
            await page.wait_for_timeout(2500)

            # Trigger Blinkit's lazy image loader with a small scroll
            await page.evaluate("window.scrollTo(0, 400);")
            await page.wait_for_timeout(1500)

            # ── Step C: Resilient Vanilla JS Data Extraction ─────────────────
            js_script = """
            () => {
                let items = [];
                let xpath  = '//div[contains(@class,"categories-table")]/div/div';
                let cards  = document.evaluate(xpath, document, null,
                                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                let limit  = Math.min(cards.snapshotLength, 8);

                for (let i = 0; i < limit; i++) {
                    let card = cards.snapshotItem(i);
                    let text = card.innerText || '';

                    if (!text.includes('ADD')) continue;

                    let link  = card.querySelector('a');
                    let img   = card.querySelector('img');
                    let lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

                    let name     = 'Unknown';
                    let price    = '₹0';
                    let quantity = '';
                    let badge    = '';

                    // Detect discount badge on first line (e.g. "18% OFF", "Super Saver")
                    let hasBadge = lines[0] && (lines[0].includes('%') || lines[0].toLowerCase().includes('saver'));
                    if (hasBadge) {
                        badge    = lines[0];
                        name     = lines[1] || 'Unknown';
                        quantity = lines[2] || '';
                    } else {
                        name     = lines[0] || 'Unknown';
                        quantity = lines[1] || '';
                    }

                    // Price is always the second-to-last line (before "ADD" button text)
                    if (lines.length >= 2) {
                        price = lines[lines.length - 2] || '₹0';
                    }

                    items.push({
                        name:       name,
                        price:      price,
                        quantity:   quantity,
                        badge:      badge,
                        image:      img  ? img.src   : 'No Image Found',
                        productUrl: link ? link.href : 'No Link',
                    });
                }
                return items;
            }
            """
            results = await page.evaluate(js_script)
            _log(f"   🔍 Extracted {len(results)} raw product card(s) from page DOM.")

        except Exception as e:
            _log(f"❌ Scraping engine hit a wall: {e}")
        finally:
            await browser.close()

    # ── Step D: Upload Images to Cloudinary & Commit to SQLite ───────────────
    if results:
        conn   = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Ensure products table + pincode column exist (idempotent migration)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT,
                price      TEXT,
                image      TEXT,
                category   TEXT,
                quantity   TEXT,
                source     TEXT DEFAULT 'Blinkit',
                productUrl TEXT,
                pincode    TEXT,
                UNIQUE(name, pincode)
            )
        """)
        # Add pincode column to legacy DBs that don't have it yet
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN pincode TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists — perfectly fine

        saved_count = 0
        for item in results:
            # Swap raw hotlink with permanent Cloudinary CDN URL before saving
            item["image"] = _upload_to_cloudinary(item["image"], item["name"])

            try:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO products (name, price, image, category, quantity, source, productUrl, pincode)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item["name"],
                        item["price"],
                        item["image"],
                        keyword,              # category = the search keyword used
                        item["quantity"],
                        "Blinkit",
                        item["productUrl"],
                        pincode,
                    ),
                )
                saved_count += 1
            except sqlite3.IntegrityError:
                pass  # Duplicate (name, pincode) — skip silently

        conn.commit()
        conn.close()
        _log(f"\n✅ Saved {saved_count} fresh items into {DB_PATH}!")
    else:
        _log("⚠️  No items extracted. Check connectivity or if Blinkit's layout shifted.")

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Entry-point — supports both direct test runs and Node.js spawn integration
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import asyncio

    # CLI mode: python scraper.py <keyword> <pincode>
    # Node.js reads the single line starting with __RESULT__ from stdout
    if len(sys.argv) >= 3:
        kw = sys.argv[1]
        pc = sys.argv[2]
        products = asyncio.run(live_search_and_save(kw, pc))
        # Emit clean JSON as the ONLY stdout line — Node parses this
        print("__RESULT__" + json.dumps(products), flush=True)
    else:
        # Local test mode — pretty-print results to stderr
        asyncio.run(live_search_and_save("coffee", "431001"))