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

          trySend(socket, { 
            action: "homeContent", 
            categories, 
            products: featuredProducts.map(normalizeProduct) 
          });
        } catch (err) {
          console.error("Home content fetch error:", err);
          trySend(socket, { action: "homeContent", categories: [], products: [] });
        }
      }

      if (data.action === "search") {
        const { searchTerm, lat, lon, offset = 0, limit = 40 } = data;
        console.log(`[${cid}] Real-time Search: "${searchTerm}" @ ${lat}, ${lon} (offset: ${offset})`);
        
        try {
          const searchPincode = await getPincode(lat, lon);
          const cleanQuery = searchTerm.trim();
          const keywords = cleanQuery.split(/\s+/).filter(k => k.length > 0);
          
          let results = [];
          if (keywords.length > 0) {
            // Build dynamic SQLite query for multiple keywords
            const whereClause = keywords.map(() => "(name LIKE ? OR category LIKE ?)").join(" AND ");
            const params = [];
            keywords.forEach(kw => {
              params.push(`%${kw}%`, `%${kw}%`);
            });
            params.push(searchPincode);
            
            const stmt = db.prepare(`SELECT * FROM products WHERE ${whereClause} AND pincode = ? LIMIT ? OFFSET ?`);
            results = stmt.all(...params, limit, offset);
          }
          
          if (results.length > 0) {
            console.log(`[SQLite HIT] Found ${results.length} items for "${cleanQuery}" @ ${searchPincode}`);
            trySend(socket, { 
              action: "streamUpdate", 
              source: "bigbasket", 
              products: results.map(normalizeProduct),
              append: offset > 0
            });
            trySend(socket, { action: "searchResults", total: results.length, offset });
          } else if (offset === 0) {
            console.log(`[SQLite MISS] Spawning live scraper for "${cleanQuery}" @ ${searchPincode}`);
            
            trySend(socket, { 
              action: "streamUpdate", 
              source: "bigbasket", 
              scanning: true,
              scanMessage: '🔍 Scraping BigBasket live...'
            });
            
            const { spawnScraper } = require('./services/scraperBridge');
            spawnScraper(cleanQuery, searchPincode, (scrapedProducts) => {
              trySend(socket, { 
                action: "streamUpdate", 
                source: "bigbasket", 
                products: scrapedProducts.map(normalizeProduct) 
              });
              trySend(socket, { action: "searchResults", total: scrapedProducts.length });
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

const PORT = process.env.PORT || 5000;
srv.listen(PORT, "0.0.0.0", () => {
  console.log(`\x1b[32m🚀 NEXUS HYPERLOCAL ENGINE ACTIVE ON ${PORT}\x1b[0m`);
});
