const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cloudinary = require('cloudinary').v2;
const db = require('../config/sqlite');
const crypto = require('crypto');

// Use stealth plugin with playwright-extra
chromium.use(StealthPlugin());

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let browser = null;

/**
 * Ensures a single browser instance is running.
 */
async function getBrowser() {
  if (!browser) {
    // Auto-detect production environment or respect explicit HEADLESS env var
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    const isHeadless = process.env.HEADLESS === 'true' || isProduction;
    
    console.log(`[Scraper] 🚀 Launching persistent Chromium (headless: ${isHeadless})...`);
    browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu', 
        '--disable-blink-features=AutomationControlled'
      ]
    });
  }
  return browser;
}

/**
 * Optimized scraper using a persistent browser and background tasks.
 */
async function scrapeBigBasket(keyword, pincode, onResults) {
  const startTime = Date.now();
  console.log(`[Scraper] 🕵️  Searching for "${keyword}" @ ${pincode}`);

  const browser = await getBrowser();
  
  // Create a fresh context
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  
  await context.addCookies([{
    name: '_bb_pin_code',
    value: String(pincode),
    domain: '.bigbasket.com',
    path: '/'
  }, {
    name: '_bb_cid',
    value: '1',
    domain: '.bigbasket.com',
    path: '/'
  }]);

  // Block heavy assets to speed up scraping
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  let results = [];
  let interceptedData = null;

  // Intercept the API response
  page.on('response', async (response) => {
    const url = response.url();
    // Catch generic search AND brand-specific product listings
    if ((url.includes('listing-svc/v2/products') || url.includes('listing-svc/v2/brand')) && 
        ['fetch', 'xhr'].includes(response.request().resourceType())) {
      try {
        const data = await response.json();
        if (data && data.tabs) {
          interceptedData = data;
        } else if (data && data.products) {
          interceptedData = { tabs: [{ product_info: { products: data.products } }] };
        }
      } catch (e) {}
    }
  });

  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const searchUrl = `https://www.bigbasket.com/ps/?q=${encodedKeyword}`;
    
    // Navigate and wait for network idle to ensure JS has triggered API calls
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 25000 });

    // Poll for intercepted data
    for (let i = 0; i < 40; i++) {
      if (interceptedData) break;
      await new Promise(r => setTimeout(r, 250));
    }

    if (interceptedData && interceptedData.tabs?.[0]) {
      const productsList = interceptedData.tabs[0].product_info?.products || [];
      console.log(`[Scraper] ✅ Intercepted ${productsList.length} items in ${Date.now() - startTime}ms`);

      results = productsList.slice(0, 40).map(p => {
        const name = p.desc || p.brand?.name || 'Unknown';
        const price = parseFloat(p.pricing?.discount?.prim_price?.sp) || 0;
        const qty = p.w || '';
        const image = p.images?.[0]?.s || '';
        const urlSuffix = p.absolute_url || '';
        const productUrl = urlSuffix ? new URL(urlSuffix, 'https://www.bigbasket.com').href : '';
        
        const id = crypto.createHash('md5').update(productUrl || (name + qty)).digest('hex').substring(0, 12);

        return {
          id,
          name,
          price,
          quantity: qty,
          image,
          productUrl,
          source: 'bigbasket'
        };
      }).filter(p => p.name && p.price && p.image);

      onResults(results);

      backgroundTasks(results, keyword, pincode).catch(err => {
        console.error('[Scraper] Background task error:', err.message);
      });

    } else {
      console.log(`[Scraper] ⚠️  No items found for "${keyword}"`);
      onResults([]);
    }

  } catch (err) {
    console.error(`[Scraper] ❌ Error: ${err.message}`);
    onResults([]);
  } finally {
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
}

module.exports = { scrapeBigBasket };
