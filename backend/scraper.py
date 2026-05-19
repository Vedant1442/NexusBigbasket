"""
scraper.py  — Async BigBasket hyperlocal scraper for NEXUS-V2

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
from playwright_stealth import Stealth
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load environment — works whether cwd is backend/ or any parent directory
# ---------------------------------------------------------------------------
_env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_env_path)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG  (pulled from .env — never hardcode secrets in source)
# ─────────────────────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "bigbasket.db")

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
            folder="bigbasket_store",
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
async def live_search_and_save(keyword: str, pincode: str = "400001") -> list[dict]:
    """
    Async version of the BigBasket hyperlocal scraper.
    """
    _log("🚀 Running on Local Network (Zero Cost / Proxies Disabled)...")
    _log(f"🕵️  Searching BigBasket for '{keyword}' in Pincode {pincode}...")

    results = []

    async with async_playwright() as p:
        launch_args = ["--no-sandbox", "--disable-dev-shm-usage"]

        # 🔥 HEADLESS=FALSE: Runs visually on your desktop so Cloudflare drops its defensive block walls!
        browser = await p.chromium.launch(headless=False, args=launch_args)

        ctx_options = {"user_agent": HEADERS["User-Agent"]}
        context = await browser.new_context(**ctx_options)
        page    = await context.new_page()
        try:
            stealth = Stealth()
            await stealth.apply_stealth_async(page)
            
            # ── Step A: Navigate to Search Page ──────────
            search_url = f"https://www.bigbasket.com/ps/?q={keyword}"
            _log(f"Navigating to {search_url}...")
            await page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
            
            # Extract product URLs by waiting for product links to render
            product_urls = []
            try:
                # Wait for at least one product link to appear (Client Side Render)
                await page.wait_for_selector("a[href*='/pd/']", timeout=15000)
                locator = page.locator("a[href*='/pd/']")
                count = await locator.count()
                for i in range(count):
                    href = await locator.nth(i).get_attribute("href")
                    if href:
                        # Some hrefs might be absolute, some relative
                        url = href if href.startswith("http") else f"https://www.bigbasket.com{href}"
                        if "/pd/" in url and url not in product_urls:
                            product_urls.append(url)
            except Exception as e:
                _log(f"Could not find product links on search page: {e}")
                
            product_urls = product_urls[:5] # Limit to top 5
            _log(f"Found {len(product_urls)} product URLs. Deep scraping...")

            # ── Step B: Deep Scrape Product Pages ──────────
            for url in product_urls:
                _log(f"Scraping: {url}")
                try:
                    await page.goto(url, wait_until="commit", timeout=20000)
                    next_data_script = await page.locator("script#__NEXT_DATA__").text_content(timeout=10000)
                    if not next_data_script:
                        continue
                        
                    next_data = json.loads(next_data_script)
                    page_props = next_data.get("props", {}).get("pageProps", {})
                    product_details = page_props.get("productDetails", {})
                    if not product_details:
                        product_details = page_props.get("SSRData", {}).get("productDetails", {})
                        
                    children = product_details.get("children", []) if isinstance(product_details, dict) else []
                    if children and isinstance(children, list):
                        product_details = children[0]
                        
                    if not product_details or not isinstance(product_details, dict):
                        continue
                        
                    p_name = product_details.get("desc") or product_details.get("name")
                    pricing = product_details.get("pricing", {})
                    discount = pricing.get("discount", {}) if isinstance(pricing, dict) else {}
                    prim_price = discount.get("prim_price", {}) if isinstance(discount, dict) else {}
                    
                    p_price = float(prim_price.get("sp", 0) if isinstance(prim_price, dict) else 0)
                    if not p_price:
                        p_price = float(product_details.get("price") or 0)
                    
                    p_qty = product_details.get("w") or product_details.get("weight") or ""
                    
                    images = product_details.get("images", [])
                    p_image = images[0].get("s") if (images and isinstance(images, list) and isinstance(images[0], dict)) else ""
                    if not p_image:
                        p_image = product_details.get("image_url", "")
                        
                    if p_name and p_price and p_image:
                        results.append({
                            "name": p_name,
                            "price": p_price,
                            "quantity": p_qty,
                            "image": p_image,
                            "productUrl": url
                        })
                        _log(f"  + Extracted: {p_name} @ ₹{p_price}")
                except Exception as e:
                    _log(f"  - Failed to scrape {url}: {e}")
            
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
                source     TEXT DEFAULT 'BigBasket',
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
            
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN image TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute("ALTER TABLE products ADD COLUMN quantity TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            cursor.execute("ALTER TABLE products ADD COLUMN productUrl TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

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
                        "BigBasket",
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
        _log("⚠️  No items extracted. Check connectivity.")

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