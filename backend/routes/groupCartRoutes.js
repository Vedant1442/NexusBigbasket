const express = require('express');
const router = express.Router();
const db = require('../config/sqlite');

// Get basket by share code
router.get('/:code', (req, res) => {
  const { code } = req.params;
  if (!db) return res.status(500).json({ error: "DB not available" });
  
  try {
    const row = db.prepare('SELECT * FROM group_carts WHERE share_code = ?').get(code);
    if (!row) {
      return res.status(404).json({ error: "Basket not found" });
    }
    const basket = JSON.parse(row.basket_data);
    res.json(basket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update or create basket
router.post('/:code', (req, res) => {
  const { code } = req.params;
  const basket = req.body;
  if (!db) return res.status(500).json({ error: "DB not available" });

  try {
    const existing = db.prepare('SELECT * FROM group_carts WHERE share_code = ?').get(code);
    if (existing) {
      db.prepare('UPDATE group_carts SET basket_data = ? WHERE share_code = ?')
        .run(JSON.stringify(basket), code);
    } else {
      db.prepare('INSERT INTO group_carts (share_code, host_name, basket_data) VALUES (?, ?, ?)')
        .run(code, basket.hostName || "Guest", JSON.stringify(basket));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
