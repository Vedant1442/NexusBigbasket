"""
scraper.py  — Async BigBasket hyperlocal scraper for NEXUS-V2

Usage (via Node.js child_process.spawn):
    python scraper.py <keyword> <pincode>

Outputs all progress to stderr so Node's stdout pipe only contains the
final JSON line, prefixed with __RESULT__ for reliable parsing.
"""

import sqlite3
import os
import sys
import json
import asyncio
import concurrent.futures
from urllib.parse import urljoin
import urllib.parse
import requests
import cloudinary
import cloudinary.uploader
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_env_path)

DB_PATH = os.getenv("DB_PATH", "bigbasket.db")
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

def _upload_to_cloudinary(raw_url: str, item_name: str) -> str:
    if not raw_url or raw_url == "No Image Found":
        return raw_url
    if "cloudinary.com" in raw_url:
        return raw_url

    try:
        resp = requests.get(raw_url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        result = cloudinary.uploader.upload(
            resp.content,
            folder="bigbasket_store",
            format="webp",
            overwrite=False,
        )
        secure_url = result["secure_url"]
        _log(f"   ☁️  CDN Uploaded  : {item_name} → {secure_url}")
        return secure_url
    except Exception as e:
        _log(f"   ⚠️  CDN Upload Failed for '{item_name}': {e}. Using raw URL.")
        return raw_url

def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)

async def live_search_and_save(keyword: str, pincode: str = "400001") -> list[dict]:
    _log("🚀 Running on Local Network (O(1) Search Strategy)...")
    _log(f"🕵️  Searching BigBasket for '{keyword}' in Pincode {pincode}...")

    results = []
    intercepted_data = None

    async with async_playwright() as p:
        launch_args = ["--no-sandbox", "--disable-dev-shm-usage"]
        browser = await p.chromium.launch(headless=True, args=launch_args)

        ctx_options = {"user_agent": HEADERS["User-Agent"]}
        context = await browser.new_context(**ctx_options)
        
        # Set exact pincode location to trigger hyperlocal inventory
        await context.add_cookies([{
            "name": "_bb_pin_code", 
            "value": str(pincode), 
            "domain": ".bigbasket.com", 
            "path": "/"
        }])

        page = await context.new_page()
        stealth = Stealth()
        await stealth.apply_stealth_async(page)
        
        # Block images/css to make it lightning fast
        await page.route("**/*", lambda route: route.abort() 
            if route.request.resource_type in ["image", "stylesheet", "font", "media"] 
            else route.continue_()
        )

        async def handle_response(response):
            nonlocal intercepted_data
            if 'listing-svc/v2/products' in response.url and response.request.resource_type in ['fetch', 'xhr']:
                _log(f"   🎯 Intercepted API URL: {response.url}")
                try:
                    data = await response.json()
                    if data and 'tabs' in data:
                        intercepted_data = data
                except Exception:
                    pass

        page.on('response', handle_response)
        
        try:
            encoded_keyword = urllib.parse.quote(keyword)
            search_url = f"https://www.bigbasket.com/ps/?q={encoded_keyword}"
            _log(f"Navigating to {search_url}...")
            # Wait for either networkidle or our data to be set
            await page.goto(search_url, wait_until="networkidle", timeout=25000)
            
            # Additional small wait in case API takes a bit longer after page load
            for _ in range(20):
                if intercepted_data:
                    break
                await page.wait_for_timeout(250)

            if intercepted_data and intercepted_data.get('tabs'):
                tab_info = intercepted_data['tabs'][0].get('tab_info', {})
                slug = tab_info.get('slug', '')
                
                products_list = intercepted_data['tabs'][0].get('product_info', {}).get('products', [])
                
                if 'no results' in slug or 'not found' in slug:
                    _log(f"⚠️ No exact matches found for '{keyword}' — showing recommendations from BigBasket.")
                
                _log(f"✅ Intercepted API data! Found {len(products_list)} items.")
                
                # Take top 40
                for p in products_list[:40]:
                    name = p.get('desc') or p.get('brand', {}).get('name', 'Unknown')
                    pricing = p.get('pricing', {}).get('discount', {})
                    prim_price = pricing.get('prim_price', {})
                    price = float(prim_price.get('sp', 0))
                    qty = p.get('w', '')
                    images = p.get('images', [])
                    image = images[0].get('s') if images else ''
                    url_suffix = p.get('absolute_url', '')
                    productUrl = urljoin('https://www.bigbasket.com', url_suffix) if url_suffix else ''
                    
                    import hashlib
                    def gen_id(s): return hashlib.md5(s.encode()).hexdigest()[:12]
                    
                    if name and price and image:
                        pid = gen_id(productUrl) if productUrl else gen_id(name + qty)
                        results.append({
                            "id": pid,
                            "name": name,
                            "price": price,
                            "quantity": qty,
                            "image": image,
                            "productUrl": productUrl
                        })
                        _log(f"  + Extracted: {name} @ ₹{price}")
            else:
                _log("⚠️ Could not intercept listing-svc JSON response.")
        
        except Exception as e:
            _log(f"❌ Scraping engine hit an error: {e}")
        finally:
            await browser.close()

    # ── Step D: Upload Images concurrently & Commit to SQLite ───────────────
    if results:
        _log("⚡ Uploading images concurrently to CDN...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_item = {executor.submit(_upload_to_cloudinary, item["image"], item["name"]): item for item in results}
            for future in concurrent.futures.as_completed(future_to_item):
                item = future_to_item[future]
                try:
                    item["image"] = future.result()
                except Exception as e:
                    _log(f"  - CDN Future failed: {e}")

        conn   = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

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
        
        try: cursor.execute("ALTER TABLE products ADD COLUMN pincode TEXT")
        except sqlite3.OperationalError: pass
            
        try: cursor.execute("ALTER TABLE products ADD COLUMN image TEXT")
        except sqlite3.OperationalError: pass

        try: cursor.execute("ALTER TABLE products ADD COLUMN quantity TEXT")
        except sqlite3.OperationalError: pass

        try: cursor.execute("ALTER TABLE products ADD COLUMN productUrl TEXT")
        except sqlite3.OperationalError: pass

        saved_count = 0
        for item in results:
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
                        keyword,
                        item["quantity"],
                        "BigBasket",
                        item["productUrl"],
                        pincode,
                    ),
                )
                saved_count += 1
            except sqlite3.IntegrityError:
                pass 

        conn.commit()
        conn.close()
        _log(f"\n✅ Saved {saved_count} fresh items into {DB_PATH}!")
    else:
        _log("⚠️  No items extracted. Check connectivity.")

    return results

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        kw = sys.argv[1]
        pc = sys.argv[2]
        products = asyncio.run(live_search_and_save(kw, pc))
        print("__RESULT__" + json.dumps(products), flush=True)
    else:
        asyncio.run(live_search_and_save("coffee", "431001"))
