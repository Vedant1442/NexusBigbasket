const db = require('../config/sqlite');

// Strip currency symbols and parse price to Number
const normalizeProduct = (row) => ({
  ...row,
  price: parseFloat(String(row.price ?? '0').replace(/[^0-9.]/g, '')) || 0,
});

function noDb(res) {
  return res.status(503).json({ message: 'SQLite database not available. Place blinkit_v2.db in the backend/ folder.' });
}

// @desc    Get all products or filter by category
// @route   GET /api/products?category=X&limit=20&page=1
// @access  Public
const getProducts = (req, res) => {
  if (!db) return noDb(res);
  try {
    const { category, limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let products;
    if (category) {
      products = db.prepare(
        'SELECT * FROM products WHERE category = ? LIMIT ? OFFSET ?'
      ).all(category, Number(limit), Number(offset));
    } else {
      products = db.prepare(
        'SELECT * FROM products LIMIT ? OFFSET ?'
      ).all(Number(limit), Number(offset)).map(normalizeProduct);
    }

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get homepage products (categories + featured sample)
// @route   GET /api/products/home
// @access  Public
const getHomepageProducts = (req, res) => {
  if (!db) return noDb(res);
  try {
    const defaultCategories = ["Dairy & Eggs", "Fruits & Vegetables", "Snacks", "Bakery", "Cold Drinks", "Instant Food", "Sweet Tooth", "Atta, Rice & Dal", "Meat & Fish", "Personal Care"];

    // Get one real product image per category directly from the DB
    const catImageRows = db.prepare(
      `SELECT category, image FROM products
       WHERE category IS NOT NULL AND image IS NOT NULL AND image != 'No Image Found' AND image != ''
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

    res.json({ categories, featuredProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

// @desc    Search products by name or category
// @route   GET /api/products/search?q=query&limit=20
// @access  Public
const searchProducts = async (req, res) => {
  if (!db) return noDb(res);
  try {
    const { q, lat, lon, isCategory, limit = 20 } = req.query;
    if (!q) return res.json([]);

    const cleanQuery = q.trim();
    const isCat = String(isCategory) === 'true';

    // ── Step 1: Category Request ─────────────────────────────────────────────
    if (isCat) {
      console.log(`[REST Search] Category-only query: "${cleanQuery}"`);
      let prods = [];
      
      try {
        prods = db.prepare(
          "SELECT * FROM products WHERE category = ? LIMIT ?"
        ).all(cleanQuery, Number(limit)).map(normalizeProduct);
      } catch (e) {
        console.error(`Exact category query failed: ${e.message}`);
      }

      if (prods.length === 0) {
        try {
          prods = db.prepare(
            "SELECT * FROM products WHERE category LIKE ? LIMIT ?"
          ).all(`%${cleanQuery}%`, Number(limit)).map(normalizeProduct);
        } catch (e) {
          console.error(`LIKE category query failed: ${e.message}`);
        }
      }

      if (prods.length === 0) {
        try {
          const keywords = cleanQuery.split(/\s+/).filter(k => k.length > 0);
          if (keywords.length > 0) {
            const conditions = keywords.map(() => '(name LIKE ? OR category LIKE ?)').join(' AND ');
            const params = [];
            keywords.forEach(kw => {
              const term = `%${kw}%`;
              params.push(term, term);
            });
            params.push(Number(limit));
            prods = db.prepare(`SELECT * FROM products WHERE ${conditions} LIMIT ?`).all(...params).map(normalizeProduct);
          }
        } catch (e) {
          console.error(`Fallback search query failed: ${e.message}`);
        }
      }

      console.log(`[REST Search] Category complete. Found ${prods.length} products directly from database.`);
      return res.json(prods);
    }

    // ── Step 2: Regular Search (SQLite Check) ─────────────────────────────────
    let prods = [];
    if (cleanQuery.toLowerCase() === 'popular') {
      prods = db.prepare("SELECT * FROM products ORDER BY RANDOM() LIMIT ?").all(Number(limit)).map(normalizeProduct);
    } else {
      const keywords = cleanQuery.split(/\s+/).filter(k => k.length > 0);
      if (keywords.length > 0) {
        const conditions = keywords.map(() => '(name LIKE ? OR category LIKE ?)').join(' AND ');
        const params = [];
        keywords.forEach(kw => {
          const term = `%${kw}%`;
          params.push(term, term);
        });
        params.push(Number(limit));
        prods = db.prepare(`SELECT * FROM products WHERE ${conditions} LIMIT ?`).all(...params).map(normalizeProduct);
      }
    }

    if (prods.length > 0) {
      console.log(`[REST Search] Cache HIT for "${cleanQuery}" — returning ${prods.length} products.`);
      return res.json(prods);
    }

    // ── Step 3: Cache Miss — Trigger Playwright Scraper ───────────────────────
    const pincode = await getPincode(lat, lon);
    console.log(`[REST Search] Cache MISS for "${cleanQuery}" @ ${pincode} — spawning live scraper...`);

    const { spawnScraper } = require('../services/scraperBridge');

    spawnScraper(
      cleanQuery,
      pincode,
      // onComplete
      (freshProducts) => {
        let result = [];
        try {
          const keywords = cleanQuery.split(/\s+/).filter(k => k.length > 0);
          if (keywords.length > 0) {
            const conditions = keywords.map(() => '(name LIKE ? OR category LIKE ?)').join(' AND ');
            const params = [];
            keywords.forEach(kw => { params.push(`%${kw}%`, `%${kw}%`); });
            params.push(Number(limit));
            result = db.prepare(`SELECT * FROM products WHERE ${conditions} LIMIT ?`)
              .all(...params).map(normalizeProduct);
          }
        } catch (dbErr) {
          console.error(`[REST Search] Post-scrape DB query failed: ${dbErr.message}`);
          result = freshProducts.map(p => ({
            ...p,
            price: parseFloat(String(p.price ?? '0').replace(/[^0-9.]/g, '')) || 0,
          }));
        }
        console.log(`[REST Search] Scraper complete for "${cleanQuery}" — returning ${result.length} products.`);
        return res.json(result);
      },
      // onError
      (err) => {
        console.error(`[REST Search] Scraper error: ${err.message}`);
        return res.status(500).json({ error: "Live scan failed. Please try again." });
      }
    );

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getHomepageProducts,
  searchProducts,
};

