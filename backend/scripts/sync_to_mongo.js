const { connectToMongo } = require('../config/mongodb');
const Database = require('better-sqlite3');
const path = require('path');

/**
 * sync_to_mongo.js
 * Migrates all products from local SQLite (bigbasket.db) to MongoDB Atlas.
 */
async function sync() {
  const db = await connectToMongo();
  if (!db) {
    console.error("❌ Could not connect to MongoDB. Check your MONGO_URI.");
    return;
  }

  const sqlitePath = path.join(__dirname, '..', 'bigbasket.db');
  const localDb = new Database(sqlitePath);
  
  try {
    const products = localDb.prepare('SELECT * FROM products').all();
    console.log(`📦 Found ${products.length} products in SQLite.`);

    if (products.length === 0) {
      console.log("ℹ️ No products to sync.");
      return;
    }

    const collection = db.collection('products');
    let synced = 0;

    for (const p of products) {
      await collection.updateOne(
        { id: p.id, pincode: p.pincode },
        { $set: p },
        { upsert: true }
      );
      synced++;
      if (synced % 100 === 0) console.log(`🚀 Synced ${synced}/${products.length}...`);
    }

    console.log(`✅ Sync Complete! ${synced} items pushed to MongoDB.`);
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
  } finally {
    process.exit();
  }
}

sync();
