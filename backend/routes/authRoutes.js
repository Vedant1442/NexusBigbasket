const express = require('express');
const router = express.Router();
const db = require('../config/sqlite');
const crypto = require('crypto');

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

router.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!db) return res.status(500).json({ error: "DB not available" });
  if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });

  try {
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const info = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
                   .run(name, email, hashPassword(password));
    res.json({ success: true, userId: info.lastInsertRowid, name, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!db) return res.status(500).json({ error: "DB not available" });

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ success: true, userId: user.id, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post-checkout: Save purchase history
router.post('/purchase', (req, res) => {
  const { userId, items, totalAmount } = req.body;
  if (!db) return res.status(500).json({ error: "DB not available" });

  try {
    db.prepare('INSERT INTO purchases (user_id, items, total_amount) VALUES (?, ?, ?)')
      .run(userId || null, JSON.stringify(items), totalAmount);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile + history
router.get('/profile/:userId', (req, res) => {
  const { userId } = req.params;
  if (!db) return res.status(500).json({ error: "DB not available" });

  try {
    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const purchases = db.prepare('SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const history = purchases.map(p => ({ ...p, items: JSON.parse(p.items) }));
    
    res.json({ user, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
