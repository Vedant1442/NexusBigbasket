const { connectToMongo } = require('../config/mongodb');
const bigbasketApi = require('../services/bigbasket');
const { spawnScraper } = require('../services/scraperBridge');

let db;
connectToMongo().then(database => {
  db = database;
});

// Normalized product format for the UI
const normalizeProduct = (doc) => ({
  ...doc,
  id: doc._id || doc.id,
  price: typeof doc.price === 'number' ? doc.price : parseFloat(String(doc.price ?? '0').replace(/[^0-9.]/g, '')) || 0,
  image: doc.image || doc.image_url,
  quantity: doc.quantity || doc.weight_quantity
});

function noDb(res) {
  return res.status(503).json({ message: 'MongoDB connection not available.' });
}

// @desc    Get all products or filter by category
// @route   GET /api/products?category=X&limit=20&page=1
// @access  Public
const getProducts = async (req, res) => {
  if (!db) return noDb(res);
  try {
    const { category, limit = 20, page = 1, pincode } = req.query;
    const offset = (page - 1) * limit;
    const filterPincode = pincode || process.env.DEFAULT_PINCODE || "110001";

    const query = { pincode: filterPincode };
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    const products = await db.collection('products')
      .find(query)
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();

    res.json(products.map(normalizeProduct));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get homepage products (categories + featured sample)
// @route   GET /api/products/home
// @access  Public
const getHomepageProducts = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    console.log(`[BB-API] Fetching real-time Home Content for ${lat}, ${lon}...`);
    
    const { categories, featuredProducts } = await bigbasketApi.getHomeContent(lat, lon);
    
    // Fallback: If live API returns empty, try to get some featured products from local DB
    let finalFeatured = featuredProducts;
    if (finalFeatured.length === 0 && db) {
      const dbSample = await db.collection('products').aggregate([{ $sample: { size: 10 } }]).toArray();
      finalFeatured = dbSample.map(normalizeProduct);
    }

    res.json({ 
      categories, 
      featuredProducts: finalFeatured.map(normalizeProduct) 
    });
  } catch (error) {
    console.error('[Homepage Error]:', error.message);
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
    return result;
  } catch (e) {
    return DEFAULT;
  }
}

// @desc    Search products by name or category with Cache-Hit/Miss logic
// @route   GET /api/products/search?q=query&limit=20
// @access  Public
const searchProducts = async (req, res) => {
  if (!db) return noDb(res);
  try {
    const { q, lat, lon, pincode, isCategory, limit = 20 } = req.query;
    if (!q) return res.json([]);

    const cleanQuery = q.trim();
    const searchPincode = pincode || await getPincode(lat, lon);
    const isCat = String(isCategory) === 'true';

    // ── Step 1: Cache Check (MongoDB) ────────────────────────────────────────
    const query = isCat 
      ? { category: { $regex: cleanQuery, $options: 'i' }, pincode: searchPincode }
      : { name: { $regex: cleanQuery, $options: 'i' }, pincode: searchPincode };

    let prods = await db.collection('products').find(query).limit(Number(limit)).toArray();

    // ── Step 2: Cache Hit ────────────────────────────────────────────────────
    if (prods.length > 0) {
      console.log(`[Mongo HIT] Found ${prods.length} items for "${cleanQuery}" @ ${searchPincode}`);
      return res.json(prods.map(normalizeProduct));
    }

    // ── Step 3: Cache Miss — Trigger Scraper ─────────────────────────────────
    if (isCat) {
       return res.json([]); // Categories don't trigger scraping
    }

    console.log(`[Scraper] Fetching live results for "${cleanQuery}" @ ${searchPincode}...`);
    
    try {
      const results = await new Promise((resolve, reject) => {
        spawnScraper(cleanQuery, searchPincode, resolve, reject);
      });
      
      // Optional: Background save to MongoDB if you still want caching
      if (db && results.length > 0) {
        results.forEach(item => {
          db.collection('products').updateOne(
            { name: item.name, pincode: searchPincode },
            { $set: { ...item, pincode: searchPincode } },
            { upsert: true }
          ).catch(e => console.error("BG Save Error:", e.message));
        });
      }

      return res.json(results.map(normalizeProduct));
    } catch (scrapeError) {
      console.error("Live search failed:", scrapeError.message);
      res.status(500).json({ error: "Live search failed" });
    }

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getHomepageProducts,
  searchProducts,
};
