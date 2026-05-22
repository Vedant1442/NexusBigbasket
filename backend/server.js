const express = require("express");
const http = require("http");
const ws = require("ws");
const path = require("path");
const Database = require("better-sqlite3");
const bigbasketApi = require("./services/bigbasket");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

// 1. DATABASE CONNECTIONS
// SQLite (for legacy Auth, Cart, Checkout - strictly preserved)
const db = new Database(path.join(__dirname, "bigbasket.db"));

/**
 * normalizeProduct: Maps BigBasket fields to a consistent format.
 * Ensures 'image' and 'quantity' exist for the frontend, and normalizes price.
 */
const normalizeProduct = (doc) => ({
  ...doc,
  id: doc.id || doc._id,
  price: typeof doc.price === 'number' ? doc.price : parseFloat(String(doc.price ?? '0').replace(/[^0-9.]/g, '')) || 0,
  image: doc.image || doc.image_url,
  quantity: doc.quantity || doc.weight_quantity
});

const app = express();
app.use(cors());
app.use(express.json());

// 2. ROUTES
const productRoutes = require("./routes/productRoutes");
app.use("/api/products", productRoutes);

const groupCartRoutes = require("./routes/groupCartRoutes");
app.use("/api/group-cart", groupCartRoutes);

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const srv = http.createServer(app);
const wss = new ws.Server({ server: srv });

// ─── Pincode resolver ──────────────────────────────────────────────────────────
/**
 * Maps lat/lon to a 6-digit Indian pincode via OpenStreetMap Nominatim.
 * Falls back to the DEFAULT_PINCODE env var (or "110001") on any failure.
 * Results are cached in-process to avoid hammering the free API.
 */
const _pincodeCache = new Map();
async function getPincode(lat, lon) {
  const DEFAULT = process.env.DEFAULT_PINCODE || "110001";
  if (!lat || !lon) return DEFAULT;

  const cacheKey = `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  if (_pincodeCache.has(cacheKey)) return _pincodeCache.get(cacheKey);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const resp = await fetch(url, {
      headers: { 
        'User-Agent': 'NexusBigbasketApp/1.0 (https://github.com/Vedant/NexusBigbasket)',
        'Accept-Language': 'en-US,en;q=0.9'
      },
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.warn(`[pincode] Nominatim API error (${resp.status}): ${text.substring(0, 50)}...`);
      return DEFAULT;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      console.warn(`[pincode] Nominatim returned non-JSON (${resp.status}): ${text.substring(0, 50)}...`);
      return DEFAULT;
    }

    const pc   = json?.address?.postcode?.replace(/\s+/g, '') || DEFAULT;
    const result = pc.length === 6 && /^\d{6}$/.test(pc) ? pc : DEFAULT;
    _pincodeCache.set(cacheKey, result);
    console.log(`[pincode] lat=${lat} lon=${lon} → ${result}`);
    return result;
  } catch (e) {
    console.warn(`[pincode] Nominatim lookup failed: ${e.message}. Using default ${DEFAULT}`);
    return DEFAULT;
  }
}

/**
 * calculateRelevance: Assigns a score to a product based on search query.
 */
const calculateRelevance = (product, query) => {
  const name = (product.name || "").toLowerCase();
  const category = (product.category || "").toLowerCase();
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
  
  let score = 0;

  keywords.forEach(kw => {
    // Whole word match in name
    const wordRegex = new RegExp(`\\b${kw}\\b`, 'i');
    if (wordRegex.test(name)) {
      score += 100;
      if (name.startsWith(kw)) score += 50;
    } else if (name.includes(kw)) {
      score += 20;
    }
    
    // Category match
    if (category.includes(kw)) score += 40;
  });

  // Common Food vs Non-Food Heuristic
  const foodKeywords = ["milk", "egg", "bread", "onion", "potato", "salt", "sugar", "oil", "rice", "dal", "atta", "paneer", "curd", "ghee"];
  const nonFoodCategories = ["beauty", "hygiene", "personal care", "shampoo", "soap", "detergent", "home care", "cleaning"];
  
  const isFoodSearch = foodKeywords.some(fk => keywords.includes(fk));
  const isNonFoodCategory = nonFoodCategories.some(nfc => category.includes(nfc));
  
  if (isFoodSearch && isNonFoodCategory) {
    score -= 200; 
  }

  return score;
};

wss.on("connection", (socket) => {
  const cid = Math.random().toString(36).substring(7);
  console.log(`[${cid}] Warp Connected`);

  socket.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.action === "getHomeContent") {
        const { lat, lon } = data;
        console.log(`[${cid}] Fetching Real-time Home Content for ${lat}, ${lon}...`);
        
        try {
          const { categories, featuredProducts } = await bigbasketApi.getHomeContent(lat, lon);
          const searchPincode = await getPincode(lat, lon);

          trySend(socket, { 
            action: "homeContent", 
            categories, 
            products: featuredProducts.map(normalizeProduct) 
          });

          // Proactive Pre-loading: Check and fill DB for each category
          if (categories && categories.length > 0) {
            checkAndPreloadCategories(categories, searchPincode, socket);
          }

        } catch (err) {
          console.error("Home content fetch error:", err);
          trySend(socket, { action: "homeContent", categories: [], products: [] });
        }
      }

      if (data.action === "search") {
        const { searchTerm, lat, lon, offset = 0, limit = 40, isCategory = false } = data;
        console.log(`[${cid}] Real-time Search: "${searchTerm}" @ ${lat}, ${lon} (offset: ${offset})`);
        
        try {
          const searchPincode = await getPincode(lat, lon);
          const cleanQuery = searchTerm.trim();
          const keywords = cleanQuery.split(/\s+/).filter(k => k.length > 0);
          
          let results = [];

          // ── Step 0: In-Memory Cache Check ──────────────────────────────────
          const searchCache = require('./lib/searchCache');
          const cached = searchCache.get(cleanQuery, searchPincode, isCategory);
          if (cached && offset < cached.length) {
            console.log(`[Cache HIT] Serving ${limit} items from memory for "${cleanQuery}"`);
            results = cached.slice(offset, offset + limit);
            trySend(socket, { 
              action: "streamUpdate", 
              source: "bigbasket", 
              products: results.map(normalizeProduct),
              append: offset > 0
            });
            trySend(socket, { action: "searchResults", total: cached.length, offset });
            return;
          }

          // ── Step 1: Cloud Cache Check (MongoDB) ─────────────────────────────
          const { connectToMongo } = require('./config/mongodb');
          const mongo = await connectToMongo();
          if (mongo && keywords.length > 0) {
            const mongoQuery = {
              $and: keywords.map(kw => ({
                $or: [
                  { name: { $regex: kw, $options: 'i' } },
                  { category: { $regex: kw, $options: 'i' } }
                ]
              })),
              pincode: searchPincode
            };
            // Fetch more than limit to allow for better ranking in memory
            const rawResults = await mongo.collection('products')
              .find(mongoQuery)
              .limit(200) 
              .toArray();
            
            if (rawResults.length > 0) {
              console.log(`[Mongo HIT] Found ${rawResults.length} potential items for "${cleanQuery}"`);
              results = rawResults
                .map(p => ({ ...p, _score: calculateRelevance(p, cleanQuery) }))
                .sort((a, b) => b._score - a._score)
                .slice(offset, offset + limit);
            }
          }

          // ── Step 2: Local Cache Check (SQLite fallback) ──
          if (results.length === 0 && keywords.length > 0) {
            const whereClause = keywords.map(() => "(name LIKE ? OR category LIKE ?)").join(" AND ");
            const params = [];
            keywords.forEach(kw => {
              params.push(`%${kw}%`, `%${kw}%`);
            });
            params.push(searchPincode);
            
            const stmt = db.prepare(`SELECT * FROM products WHERE ${whereClause} AND pincode = ? LIMIT 200`);
            const rawResults = stmt.all(...params);
            if (rawResults.length > 0) {
              console.log(`[SQLite HIT] Found ${rawResults.length} potential items for "${cleanQuery}"`);
              results = rawResults
                .map(p => ({ ...p, _score: calculateRelevance(p, cleanQuery) }))
                .sort((a, b) => b._score - a._score)
                .slice(offset, offset + limit);
            }
          }
          
          if (results.length > 0) {
            trySend(socket, { 
              action: "streamUpdate", 
              source: "bigbasket", 
              products: results.map(normalizeProduct),
              append: offset > 0
            });
            trySend(socket, { action: "searchResults", total: results.length, offset });
          } else if (offset === 0) {
            console.log(`[SQLite/Mongo MISS] Spawning live scraper for "${cleanQuery}" @ ${searchPincode}`);
            
            trySend(socket, { 
              action: "streamUpdate", 
              source: "bigbasket", 
              scanning: true,
              scanMessage: '🔍 Scraping BigBasket live...'
            });
            
            const { spawnScraper } = require('./services/scraperBridge');
            spawnScraper(cleanQuery, searchPincode, (scrapedProducts) => {
              // Rank scraped products before caching and sending
              const ranked = scrapedProducts
                .map(p => ({ ...p, _score: calculateRelevance(p, cleanQuery) }))
                .sort((a, b) => b._score - a._score);

              // Populate in-memory cache
              const searchCache = require('./lib/searchCache');
              searchCache.set(cleanQuery, searchPincode, isCategory, ranked);

              trySend(socket, { 
                action: "streamUpdate", 
                source: "bigbasket", 
                products: ranked.slice(0, limit).map(normalizeProduct) 
              });
              trySend(socket, { action: "searchResults", total: ranked.length });
            }, (error) => {
              console.error("Scraper Error:", error);
              trySend(socket, { action: "error", message: "Live search failed" });
            });
          }
        } catch (err) {
          console.error("Search error:", err);
          trySend(socket, { action: "error", message: "Search failed" });
        }
      }

      if (data.action === "syncGroupCart") {
        // Broadcast the updated basket to all OTHER connected clients
        wss.clients.forEach(client => {
          if (client !== socket && client.readyState === ws.OPEN) {
            client.send(JSON.stringify({
              action: "groupCartUpdated",
              basket: data.basket
            }));
          }
        });
      }

    } catch (e) {
      console.error(`[${cid}] Message Error:`, e.message);
    }
  });
});

function trySend(socket, obj) {
  if (socket.readyState === ws.OPEN) socket.send(JSON.stringify(obj));
}

/**
 * checkAndPreloadCategories:
 * Proactively checks if each home category has products in the DB for the current pincode.
 * If missing, it spawns the scraper in the background to fill the cache.
 */
async function checkAndPreloadCategories(categories, pincode, socket) {
  const { spawnScraper } = require('./services/scraperBridge');
  
  for (const cat of categories) {
    const catName = cat.name;
    // Simple check: do we have ANY products for this category + pincode?
    const stmt = db.prepare('SELECT id FROM products WHERE category = ? AND pincode = ? LIMIT 1');
    const existing = stmt.get(catName, pincode);

    if (!existing) {
      console.log(`[Preload] ⚡ Cache MISS for category "${catName}" @ ${pincode}. Proactively scraping...`);
      spawnScraper(catName, pincode, (results) => {
        console.log(`[Preload] ✅ Cache FILLED for category "${catName}" @ ${pincode} (${results.length} items)`);
      }, (err) => {
        console.error(`[Preload] ❌ Cache FILL failed for "${catName}":`, err.message);
      });
      
      // Stagger the pre-loading to avoid slamming the CPU/RAM
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log(`[Preload] 🛡️ Cache HIT for category "${catName}" @ ${pincode}. Already loaded.`);
    }
  }
}

const PORT = process.env.PORT || 5000;
srv.listen(PORT, "0.0.0.0", () => {
  console.log(`\x1b[32m🚀 NEXUS HYPERLOCAL ENGINE ACTIVE ON ${PORT}\x1b[0m`);
});
