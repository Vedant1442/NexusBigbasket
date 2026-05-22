const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cloudinary = require('cloudinary').v2;
const db = require('../config/sqlite');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Set Playwright browser path for Render native runtime
if (process.env.RENDER === 'true') {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '..', 'ms-playwright');
}

// Use stealth plugin with playwright-extra
chromium.use(StealthPlugin());

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let browser = null;
let browserPromise = null;
let pagePool = []; // Simple pool of warm pages

/**
 * Ensures a single browser instance is running.
 * Uses a Promise lock to prevent race conditions during simultaneous initialization.
 */
async function getBrowser() {
  if (browser) return browser;
  if (browserPromise) return browserPromise;

  browserPromise = (async () => {
    // Auto-detect production environment or respect explicit HEADLESS env var
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    const isHeadless = process.env.HEADLESS === 'true' || isProduction;
    
    const launchOptions = {
      headless: isHeadless,
      args: [
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu', 
        '--disable-blink-features=AutomationControlled'
      ]
    };

    // HARD-CODED ABSOLUTE PATH FOR RENDER NATIVE RUNTIME
    if (process.env.RENDER === 'true') {
      const renderExecutablePath = path.join('/opt/render/project/src/backend/ms-playwright', 'chromium_headless_shell-1223', 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      
      if (fs.existsSync(renderExecutablePath)) {
        console.log(`[Scraper] 🎯 Found Render-specific binary: ${renderExecutablePath}`);
        launchOptions.executablePath = renderExecutablePath;
      }
    }

    console.log(`[Scraper] 🚀 Launching persistent Chromium (headless: ${isHeadless})...`);
    browser = await chromium.launch(launchOptions);
    
    browser.on('disconnected', () => {
      console.log('[Scraper] ⚠️ Browser disconnected. Resetting instance...');
      browser = null;
      browserPromise = null;
      pagePool = [];
    });

    return browser;
  })();

  return browserPromise;
}

/**
 * Get a warm page from the pool or create a new one.
 */
async function getPage() {
  if (pagePool.length > 0) {
    console.log(`[Scraper] ♻️ Reusing warm page from pool...`);
    const entry = pagePool.pop();
    // Verify context is still usable
    if (entry.browser === browser) return entry;
  }

  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  
  // Apply route blocking only once per page
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'manifest', 'other'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return { page, context, browser: b };
}

/**
 * Optimized scraper using a persistent browser and page pooling.
 */
async function scrapeBigBasket(keyword, pincode, onResults) {
  const startTime = Date.now();
  console.log(`[Scraper] 🕵️ Searching for "${keyword}" @ ${pincode}`);

  const { page, context } = await getPage();
  
  try {
    // Set cookies for current pincode
    await context.addCookies([{
      name: '_bb_pin_code', value: String(pincode), domain: '.bigbasket.com', path: '/'
    }]);

    let interceptedData = null;
    const responseHandler = async (response) => {
      const url = response.url();
      if ((url.includes('listing-svc/v2/products') || url.includes('listing-svc/v2/brand')) && 
          ['fetch', 'xhr'].includes(response.request().resourceType())) {
        try {
          const data = await response.json();
          if (data && (data.tabs || data.products)) interceptedData = data;
        } catch (e) {}
      }
    };

    page.on('response', responseHandler);

    const encodedKeyword = encodeURIComponent(keyword);
    const searchUrl = `https://www.bigbasket.com/ps/?q=${encodedKeyword}`;
    
    // Using domcontentloaded is faster than networkidle
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Poll for intercepted data
    for (let i = 0; i < 40; i++) {
      if (interceptedData) break;
      await new Promise(r => setTimeout(r, 250));
    }

    page.off('response', responseHandler);

    let results = [];
    if (interceptedData) {
      const productsList = interceptedData.tabs?.[0]?.product_info?.products || interceptedData.products || [];
      console.log(`[Scraper] ✅ Intercepted ${productsList.length} items in ${Date.now() - startTime}ms`);

      results = productsList.slice(0, 40).map(p => {
        const name = p.desc || p.brand?.name || 'Unknown';
        const price = parseFloat(p.pricing?.discount?.prim_price?.sp) || 0;
        const qty = p.w || '';
        const image = p.images?.[0]?.s || '';
        const urlSuffix = p.absolute_url || '';
        const productUrl = urlSuffix ? new URL(urlSuffix, 'https://www.bigbasket.com').href : '';
        const id = crypto.createHash('md5').update(productUrl || (name + qty)).digest('hex').substring(0, 12);

        return { id, name, price, quantity: qty, image, productUrl, source: 'bigbasket' };
      }).filter(p => p.name && p.price && p.image);
    }

    onResults(results);
    
    // Push page back to pool for reuse
    if (pagePool.length < 3) {
      pagePool.push({ page, context, browser: browser });
    } else {
      await context.close().catch(() => {});
    }

    if (results.length > 0) {
      backgroundTasks(results, keyword, pincode).catch(() => {});
    }

  } catch (err) {
    console.error(`[Scraper] ❌ Error: ${err.message}`);
    onResults([]);
    await context.close().catch(() => {});
  }
}

async function backgroundTasks(products, keyword, pincode) {
  const updatedProducts = await Promise.all(products.map(async (item) => {
    try {
        if (item.image && !item.image.includes('cloudinary.com')) {
            const uploadRes = await cloudinary.uploader.upload(item.image, {
                folder: 'bigbasket_store',
                format: 'webp',
                overwrite: false
            });
            item.image = uploadRes.secure_url;
        }
    } catch (e) {}
    return item;
  }));

  // 1. Save to SQLite (Local Cache)
  if (db) {
    const insert = db.prepare(`
        INSERT OR REPLACE INTO products (id, name, price, image, category, quantity, source, productUrl, pincode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((prods) => {
        for (const p of prods) {
            insert.run(p.id, p.name, p.price, p.image, keyword, p.quantity, 'BigBasket', p.productUrl, pincode);
        }
    });

    transaction(updatedProducts);
    console.log(`[Scraper] 💾 Cached ${updatedProducts.length} items to SQLite.`);
  }

  // 2. Save to MongoDB (Cloud Persistence)
  const { connectToMongo } = require('../config/mongodb');
  const mongo = await connectToMongo();
  if (mongo) {
    const collection = mongo.collection('products');
    const ops = updatedProducts.map(p => ({
      updateOne: {
        filter: { id: p.id, pincode },
        update: { $set: { ...p, category: keyword, pincode, source: 'BigBasket' } },
        upsert: true
      }
    }));
    await collection.bulkWrite(ops).catch(e => console.error("[Scraper] MongoDB BulkWrite Error:", e.message));
    console.log(`[Scraper] ☁️ Persisted ${updatedProducts.length} items to MongoDB.`);
  }
}

module.exports = { scrapeBigBasket };
