"""
scraper.py — Highly Optimized BigBasket Scraper using curl_cffi

Replaces heavy Playwright with lightweight TLS-impersonated API calls.
Bypasses bot detection and handles hyperlocal pricing.
"""

import sqlite3
import os
import sys
import json
import asyncio
import hashlib
import concurrent.futures
from urllib.parse import urljoin, quote
import requests as sync_requests
from curl_cffi.requests import AsyncSession
import cloudinary
import cloudinary.uploader
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
_env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_env_path)

DB_PATH = os.getenv("DB_PATH", "bigbasket.db")
if not os.path.isabs(DB_PATH):
    DB_PATH = os.path.join(os.path.dirname(__file__), DB_PATH)

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = "nexus"
MONGO_COLLECTION_NAME = "products"

# Cloudinary config
cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key    = os.getenv("CLOUDINARY_API_KEY"),
    api_secret = os.getenv("CLOUDINARY_API_SECRET"),
)

def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)

def _gen_id(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()[:12]

def _upload_to_cloudinary(raw_url: str, item_name: str) -> str:
    """Helper to upload to Cloudinary (using sync requests/cloudinary lib)"""
    if not raw_url or raw_url == "No Image Found" or "cloudinary.com" in raw_url:
        return raw_url

    try:
        # We use a simple User-Agent for image fetching
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = sync_requests.get(raw_url, headers=headers, timeout=10)
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
        _log(f"   ⚠️  CDN Upload Failed for '{item_name}': {e}")
        return raw_url

async def scrape_bigbasket(keyword: str, pincode: str = "400001") -> list[dict]:
    start_time = asyncio.get_event_loop().time()
    _log(f"🚀 Optimized Scraper: Searching '{keyword}' in Pincode {pincode}...")
    
    encoded_kw = quote(keyword)
    results = []

    async with AsyncSession(impersonate="chrome124") as s:
        s.cookies.set("_bb_pin_code", str(pincode), domain=".bigbasket.com")
        
        # 1. Initialize Session
        search_url = f"https://www.bigbasket.com/ps/?q={encoded_kw}"
        try:
            await s.get(search_url, timeout=15)
        except Exception as e:
            _log(f"⚠️ Session Init Warning: {e}")

        # 2. Scrape multiple pages for a better buffer (up to 3 pages)
        all_products = []
        for page in range(1, 4):
            api_url = f"https://www.bigbasket.com/listing-svc/v2/products?q={encoded_kw}&type=ps&slug={encoded_kw}&page={page}"
            _log(f"   📄 Fetching Page {page}...")
            try:
                api_resp = await s.get(api_url, timeout=10)
                if api_resp.status_code != 200: break
                
                data = api_resp.json()
                page_products = data.get('tabs', [{}])[0].get('product_info', {}).get('products', [])
                if not page_products: break
                all_products.extend(page_products)
                if len(page_products) < 20: break # Last page
            except Exception:
                break

        _log(f"✅ Found {len(all_products)} raw items across {page} pages.")

        for p in all_products:
            # ... (extraction logic) ...
            name = p.get('desc') or p.get('brand', {}).get('name', 'Unknown')
            pricing = p.get('pricing', {}).get('discount', {})
            prim_price = pricing.get('prim_price', {})
            price = float(prim_price.get('sp', 0))
            qty = p.get('w', '')
            images = p.get('images', [])
            image = images[0].get('s') if images else ''
            url_suffix = p.get('absolute_url', '')
            product_url = urljoin('https://www.bigbasket.com', url_suffix) if url_suffix else ''
            cat_info = p.get('category', {})
            actual_category = cat_info.get('mlc_name') or cat_info.get('tlc_name') or keyword
            
            if name and price and image:
                pid = _gen_id(product_url or (name + qty))
                results.append({
                    "id": pid,
                    "name": name,
                    "price": price,
                    "quantity": qty,
                    "image": image,
                    "productUrl": product_url,
                    "category": actual_category
                })

    # 4. Post-processing: Cloudinary Uploads
    if results:
        # Cap image uploads to 60 for performance and rate-limit safety
        process_results = results[:60]
        _log(f"⚡ Mirroring {len(process_results)} images to CDN...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_item = {executor.submit(_upload_to_cloudinary, item["image"], item["name"]): item for item in process_results}
            for future in concurrent.futures.as_completed(future_to_item):
                item = future_to_item[future]
                try: item["image"] = future.result()
                except Exception: pass
        results = process_results

        # 5. Save to SQLite (Local Cache)
        try:
            conn = sqlite3.connect(DB_PATH)
            # ... rest of sqlite logic ...
            # (Note: I'll include the full block to be safe)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id         TEXT PRIMARY KEY,
                    name       TEXT,
                    price      REAL,
                    image      TEXT,
                    category   TEXT,
                    quantity   TEXT,
                    source     TEXT DEFAULT 'BigBasket',
                    productUrl TEXT,
                    pincode    TEXT,
                    UNIQUE(name, pincode)
                )
            """)
            for col in ["pincode", "image", "quantity", "productUrl"]:
                try: cursor.execute(f"ALTER TABLE products ADD COLUMN {col} TEXT")
                except sqlite3.OperationalError: pass

            saved_count = 0
            for item in results:
                try:
                    cursor.execute(
                        """
                        INSERT OR REPLACE INTO products (name, price, image, category, quantity, source, productUrl, pincode)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (item["name"], item["price"], item["image"], item["category"], item["quantity"], "BigBasket", item["productUrl"], pincode),
                    )
                    saved_count += 1
                except Exception as e: _log(f"  - SQLite Save Failed: {e}")
            conn.commit()
            conn.close()
            _log(f"✅ Saved {saved_count} items to SQLite cache.")
        except Exception as e: _log(f"⚠️ SQLite Error: {e}")

        # 6. Save to MongoDB (Cloud Persistence)
        if MONGO_URI:
            try:
                client = MongoClient(MONGO_URI)
                mongo_db = client[MONGO_DB_NAME]
                collection = mongo_db[MONGO_COLLECTION_NAME]
                
                for item in results:
                    doc = {
                        **item,
                        "pincode": pincode,
                        "source": "BigBasket"
                    }
                    collection.update_one(
                        {"name": item["name"], "pincode": pincode},
                        {"$set": doc},
                        upsert=True
                    )
                _log(f"✅ Persisted {len(results)} items to MongoDB.")
                client.close()
            except Exception as e:
                _log(f"⚠️ MongoDB Error: {e}")
        else:
            _log("⚠️ MONGO_URI not found. Skipping cloud persistence.")

    return results

if __name__ == "__main__":
    keyword = sys.argv[1] if len(sys.argv) > 1 else "milk"
    pincode = sys.argv[2] if len(sys.argv) > 2 else "400001"
    
    final_results = asyncio.run(scrape_bigbasket(keyword, pincode))
    print("__RESULT__" + json.dumps(final_results), flush=True)
