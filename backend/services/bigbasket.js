const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * BigBasketAPI (Zero-Cost / Ultra-Fast Version)
 * ─────────────────────────────────────────────
 * This service uses the local products.json (60k+ items) as a high-speed search engine.
 * It also fetches real-time homepage data directly from BigBasket's Next.js metadata.
 */
class BigBasketAPI {
    constructor() {
        this.localDbPath = path.join(__dirname, '../../products.json');
        this.products = [];
        this.loadLocalData();
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        };
    }

    loadLocalData() {
        try {
            if (fs.existsSync(this.localDbPath)) {
                const rawData = fs.readFileSync(this.localDbPath, 'utf8');
                this.products = JSON.parse(rawData);
                console.log(`[BB-API] Loaded ${this.products.length} products from local database.`);
            }
        } catch (error) {
            console.error('[BB-API] Error loading local products.json:', error.message);
            this.products = [];
        }
    }

    async search(query, lat = 19.076, lon = 72.877) {
        if (!query) return [];
        const keywords = query.toLowerCase().split(' ').filter(k => k.length > 1);
        const results = this.products.filter(p => {
            const name = (p.name || "").toLowerCase();
            const brand = (p.brand || "").toLowerCase();
            const category = (p.category || "").toLowerCase();
            return keywords.every(k => name.includes(k) || brand.includes(k) || category.includes(k));
        }).slice(0, 40);

        return results.map(p => ({
            id: p.id || `bb-${Math.random().toString(36).substr(2, 9)}`,
            name: p.name,
            brand: p.brand,
            price: p.price || 0,
            mrp: p.mrp || p.price || 0,
            discount: p.discount || 0,
            quantity: p.weight_quantity || p.quantity || "",
            image: p.image || p.image_url || "",
            source: 'bigbasket',
            deliveryTime: 'Same Day',
            productUrl: `https://www.bigbasket.com/ps/?q=${encodeURIComponent(p.name)}`
        }));
    }

    async getHomeContent(lat = 19.076, lon = 72.877) {
        try {
            console.log(`[BB-API] Fetching real-time Home Content...`);
            const response = await axios.get('https://www.bigbasket.com/', { headers: this.headers, timeout: 8000 });
            const html = response.data;
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
            
            let data = { categories: [], featuredProducts: [] };
            if (nextDataMatch && nextDataMatch[1]) {
                const nextData = JSON.parse(nextDataMatch[1]);
                data = this.extractFromNextData(nextData);
            }

            if (data.categories.length === 0) {
                data.categories = this.buildCategoriesFromLocal();
            }

            if (data.featuredProducts.length === 0) {
                data.featuredProducts = this.products.slice(0, 15).map(p => ({
                    id: p.id || Math.random(),
                    name: p.name,
                    price: p.price || 0,
                    image: p.image || p.image_url,
                    source: 'bigbasket',
                    quantity: p.weight_quantity || p.quantity || ''
                }));
            }
            return data;
        } catch (error) {
            return { categories: this.buildCategoriesFromLocal(), featuredProducts: [] };
        }
    }

    extractFromNextData(nextData) {
        const categories = [];
        const featuredProducts = [];
        const widgets = nextData.props?.pageProps?.SSRData?.widgets || [];
        
        widgets.forEach(widget => {
            if (widget.type === 'StoreEntry' || widget.title?.includes('Category')) {
                const items = widget.sectionData?.storeEntry || widget.sectionData?.items || [];
                items.forEach(item => {
                    if (item.src && !categories.find(c => c.image === item.src)) {
                        categories.push({ id: item.id || Math.random().toString(36).substr(2, 5), name: item.alt || 'Category', image: item.src });
                    }
                });
            }
            if (widget.type === 'ProductCarousel' || widget.type === 'Bestsellers') {
                const items = widget.sectionData?.products || [];
                items.forEach(p => {
                    featuredProducts.push({
                        id: p.id,
                        name: p.desc || p.name,
                        price: parseFloat(p.pricing?.discount?.prim_price?.sp) || p.price || 0,
                        mrp: parseFloat(p.pricing?.discount?.mrp) || p.mrp || 0,
                        image: p.images?.[0]?.s || p.image_url,
                        source: 'bigbasket',
                        quantity: p.w || ''
                    });
                });
            }
        });
        return { categories, featuredProducts };
    }

    buildCategoriesFromLocal() {
        const catMap = new Map();
        const priority = ['Fruits & Vegetables', 'Staples', 'Snacks', 'Beverages', 'Dairy', 'Personal Care', 'Sexual Wellness', 'Pharma & Wellness', 'Household'];
        
        this.products.forEach(p => {
            let catName = p.category;
            const name = (p.name || "").toLowerCase();
            const brand = (p.brand || "").toLowerCase();
            if (name.includes('condom') || name.includes('lubricant') || brand.includes('durex') || brand.includes('skore')) {
                catName = 'Sexual Wellness';
            }

            if (catName && (p.image || p.image_url) && !catMap.has(catName)) {
                catMap.set(catName, { id: Math.random().toString(36).substr(2, 5), name: catName, image: p.image || p.image_url });
            }
        });

        const allCats = Array.from(catMap.values());
        return allCats.sort((a, b) => {
            const indexA = priority.findIndex(p => a.name.includes(p));
            const indexB = priority.findIndex(p => b.name.includes(p));
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
        }).slice(0, 12);
    }
}

module.exports = new BigBasketAPI();
