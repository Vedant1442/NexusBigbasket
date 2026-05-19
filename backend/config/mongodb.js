const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.warn('⚠️ MONGO_URI not found in environment variables. MongoDB features will be disabled.');
}

let client;
let db;

async function connectToMongo() {
  if (db) return db;
  
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('nexus');
    console.log('✅ Connected to MongoDB (Nexus Database)');
    return db;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    return null;
  }
}

module.exports = { connectToMongo };
