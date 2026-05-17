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
    // Distinct categories
    const catRows = db.prepare(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL'
    ).all();

    const categoryList = catRows.map((row, index) => ({
      id: String(index + 1),
      name: row.category,
    }));

    // Featured: 10 random products
    const featuredProducts = db.prepare(
      'SELECT * FROM products ORDER BY RANDOM() LIMIT 10'
    ).all().map(normalizeProduct);

    res.json({ categories: categoryList, featuredProducts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search products by name or category
// @route   GET /api/products/search?q=query&limit=20
// @access  Public
const searchProducts = (req, res) => {
  if (!db) return noDb(res);
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json([]);

    if (q.toLowerCase() === 'popular') {
      const products = db.prepare(
        'SELECT * FROM products ORDER BY RANDOM() LIMIT ?'
      ).all(Number(limit)).map(normalizeProduct);
      return res.json(products);
    }

    const keywords = q.trim().split(/\s+/).filter(k => k.length > 0);
    
    // We want all keywords to match the product (either in name or category) -> AND logic
    const conditions = keywords.map(() => '(name LIKE ? OR category LIKE ?)').join(' AND ');
    
    const params = [];
    keywords.forEach(kw => {
      const term = `%${kw}%`;
      params.push(term, term);
    });
    
    params.push(Number(limit));

    const products = db.prepare(
      `SELECT * FROM products WHERE ${conditions} LIMIT ?`
    ).all(...params).map(normalizeProduct);

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getHomepageProducts,
  searchProducts,
};
