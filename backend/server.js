const express = require("express");
const http = require("http");
const ws = require("ws");
const { chromium } = require("playwright");
const path = require("path");
const blinkitApi = require("./services/blinkit");
const { spawnScraper } = require("./services/scraperBridge");
const cors = require("cors");
const dotenv = require("dotenv");
// const connectDB = require("./config/db"); // Disabled — migrated to SQLite
const db = require("./config/sqlite");

dotenv.config();

// MongoDB disabled — using SQLite (blinkit_v2.db) instead
// connectDB();


const app = express();
app.use(cors());
app.use(express.json());

// Routes
const productRoutes = require("./routes/productRoutes");
app.use("/api/products", productRoutes);

const groupCartRoutes = require("./routes/groupCartRoutes");
app.use("/api/group-cart", groupCartRoutes);

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const srv = http.createServer(app);
const wss = new ws.Server({ server: srv });

// Store browser instances (Now used as fallback/session refreshers)
let globalBrowser = null;
let globalPages = {};
let globalCoords = { lat: 19.076, lon: 72.877 };

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
      headers: { 'User-Agent': 'NEXUS-V2/1.0 (nexus-dev-contact@example.com)' },
    });
    const json = await resp.json();
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

async function initPool() {
  console.log("🚀 Warming up NEXUS V2 (Blinkit Mode) Warp Pool...");
  // We keep Puppeteer only as a background "session warmer" to ensure cookies are fresh
  try {
    globalBrowser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
    });
    const context = await globalBrowser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();
    await page.goto("https://blinkit.com", { waitUntil: "networkidle", timeout: 30000 });
    console.log("✅ Warp Pool session warmed up");
    globalPages["blinkit"] = page;
    blinkitApi.setPage(page);
  } catch (e) {
    console.error("❌ Pool Warmup Error (Proceeding with API-only mode):", e.message);
  }
}

initPool();

wss.on("connection", (socket) => {
  const cid = Math.random().toString(36).substring(7);
  console.log(`[${cid}] Warp Connected`);

  socket.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);

      /**
       * normalizeProduct: strips the ₹ prefix from price and converts to a
       * plain Number so ProductCard's `product.price > 0` check works correctly.
       * Also pulls the category image from the DB row directly.
       */
      const normalizeProduct = (row) => ({
        ...row,
        price: parseFloat(String(row.price ?? '0').replace(/[^0-9.]/g, '')) || 0,
      });

      if (data.action === "getHomeContent") {
        console.log(`[${cid}] Fetching Home via SQLite...`);
        if (!db) {
          trySend(socket, { action: "homeContent", categories: [], products: [] });
          return;
        }

        const defaultCategories = ["Dairy & Eggs", "Fruits & Vegetables", "Snacks", "Bakery", "Cold Drinks", "Instant Food", "Sweet Tooth", "Atta, Rice & Dal", "Meat & Fish", "Personal Care"];

        // Get one real product image per category directly from the DB
        const catImageRows = db.prepare(
          `SELECT category, image FROM products
           WHERE category IS NOT NULL AND image IS NOT NULL
           GROUP BY category`
        ).all();

        const catImageMap = {};
        catImageRows.forEach(r => { catImageMap[r.category] = r.image; });

        // Distinct categories shuffled, max 10
        let catRows = Object.keys(catImageMap)
          .sort(() => 0.5 - Math.random())
          .slice(0, 10);

        // Pad to 10 with defaults if needed
        while (catRows.length < 10) {
          catRows.push(defaultCategories[catRows.length] || `Category ${catRows.length + 1}`);
        }

        const categories = catRows.map((cat, i) => ({
          id: String(i + 1),
          name: cat,
          image: catImageMap[cat] || null,  // real Cloudinary image from DB
        }));

        // 10 featured products, prices normalized
        const featuredProducts = db.prepare(
          "SELECT * FROM products ORDER BY RANDOM() LIMIT 10"
        ).all().map(normalizeProduct);

        trySend(socket, { action: "homeContent", categories, products: featuredProducts });
      }

      if (data.action === "search") {
        const { searchTerm, lat, lon } = data;
        console.log(`[${cid}] SQLite Search: "${searchTerm}"`);
        if (!db) {
          trySend(socket, { action: "streamUpdate", source: "blinkit", products: [] });
          trySend(socket, { action: "searchResults", total: 0 });
          return;
        }

        // ── Step 1: Hit the SQLite cache first (synchronous, fast) ─────────────
        let prods = [];
        if (searchTerm.toLowerCase() === 'popular') {
          prods = db.prepare("SELECT * FROM products ORDER BY RANDOM() LIMIT 20").all().map(normalizeProduct);
        } else {
          const keywords = searchTerm.trim().split(/\s+/).filter(k => k.length > 0);
          if (keywords.length > 0) {
            const conditions = keywords.map(() => '(name LIKE ? OR category LIKE ?)').join(' AND ');
            const params = [];
            keywords.forEach(kw => {
              const term = `%${kw}%`;
              params.push(term, term);
            });
            prods = db.prepare(`SELECT * FROM products WHERE ${conditions} LIMIT 20`).all(...params).map(normalizeProduct);
          }
        }

        if (prods.length > 0) {
          // Cache HIT — respond immediately
          trySend(socket, { action: "streamUpdate", source: "blinkit", products: prods });
          trySend(socket, { action: "searchResults", total: prods.length });
          return;
        }

        // ── Step 2: Cache MISS — notify UI and spawn the scraper ─────────────
        // Resolve pincode from client coordinates (async, non-blocking)
        const pincode = await getPincode(lat, lon);
        console.log(`[${cid}] Cache miss — spawning scraper for "${searchTerm}" @ ${pincode}`);

        // Tell the frontend we're actively scanning
        trySend(socket, {
          action: "streamUpdate",
          source: "blinkit",
          products: [],
          scanning: true,
          scanMessage: `🔍 Scanning Blinkit for "${searchTerm}"... hang tight!`,
        });

        // Capture the socket reference before async gap to handle early disconnects
        const capturedSocket = socket;

        spawnScraper(
          searchTerm,
          pincode,
          // ─ onComplete ───────────────────────────────────────────────────────────
          (freshProducts) => {
            // Re-query SQLite so we return fully persisted data (with IDs etc.)
            let result = [];
            try {
              const keywords = searchTerm.trim().split(/\s+/).filter(k => k.length > 0);
              if (keywords.length > 0) {
                const conditions = keywords.map(() => '(name LIKE ? OR category LIKE ?)').join(' AND ');
                const params = [];
                keywords.forEach(kw => { params.push(`%${kw}%`, `%${kw}%`); });
                result = db.prepare(`SELECT * FROM products WHERE ${conditions} LIMIT 20`)
                  .all(...params).map(normalizeProduct);
              }
            } catch (dbErr) {
              console.error(`[${cid}] Post-scrape DB query failed: ${dbErr.message}`);
              // Fall back to returning the raw scraper output
              result = freshProducts.map(p => ({
                ...p,
                price: parseFloat(String(p.price ?? '0').replace(/[^0-9.]/g, '')) || 0,
              }));
            }

            trySend(capturedSocket, { action: "streamUpdate", source: "blinkit", products: result });
            trySend(capturedSocket, { action: "searchResults", total: result.length });
          },
          // ─ onError ────────────────────────────────────────────────────────────
          (err) => {
            console.error(`[${cid}] Scraper error: ${err.message}`);
            trySend(capturedSocket, {
              action: "error",
              originalAction: "search",
              message: "Live scan failed. Please try again or check your connection.",
            });
            trySend(capturedSocket, { action: "searchResults", total: 0 });
          }
        );
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

const PORT = 5000;
srv.listen(PORT, "0.0.0.0", () => {
  console.log(`\x1b[32m🚀 NEXUS V2 BLINKIT CORE ACTIVE ON ${PORT}\x1b[0m`);
});
