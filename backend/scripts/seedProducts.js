const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const blinkitApi = require('../services/blinkit');
const { chromium } = require("playwright");

dotenv.config();

const queriesToSeed = [
  "Milk", "Bread", "Eggs", "Tomato", "Onion", "Potato", 
  "Apple", "Banana", "Chicken", "Rice", "Dal", "Chips",
  "Chocolate", "Coke", "Soap", "Shampoo", "Toothpaste"
];

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-v2';
    await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected for Seeding`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedData = async () => {
  await connectDB();
  
  // Setup stealth browser using Playwright
  console.log("Setting up browser for scraping...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  
  await page.goto("https://blinkit.com", { waitUntil: "networkidle", timeout: 30000 });
  
  blinkitApi.setPage(page);

  for (const query of queriesToSeed) {
    console.log(`Scraping products for: ${query}`);
    const results = await blinkitApi.search(query);
    
    if (results && results.length > 0) {
      for (const item of results) {
        try {
          await Product.findOneAndUpdate(
            { name: item.name },
            {
              name: item.name,
              price: item.price || 0,
              quantity: item.quantity,
              image: item.image,
              category: query, // simplified
              source: item.source,
              productUrl: item.productUrl
            },
            { upsert: true, new: true }
          );
        } catch (err) {
          console.error(`Error saving ${item.name}:`, err.message);
        }
      }
      console.log(`Saved ${results.length} products for ${query}`);
    } else {
      console.log(`No results found for ${query}`);
    }
    
    // Wait a bit to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  await browser.close();
  console.log("Seeding complete!");
  process.exit(0);
};

seedData();
