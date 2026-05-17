const express = require('express');
const router = express.Router();
const {
  getProducts,
  getHomepageProducts,
  searchProducts
} = require('../controllers/productController');

// Get homepage products (grouped by category or featured)
router.get('/home', getHomepageProducts);

// Search products
router.get('/search', searchProducts);

// Get products by category or all
router.get('/', getProducts);

module.exports = router;
