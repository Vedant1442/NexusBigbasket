const axios = require('axios');

class BlinkitAPI {
    constructor() {
        this.baseUrl = 'https://blinkit.com/v1';
        this.page = null; // Will be set by server.js
    }

    setPage(page) {
        this.page = page;
    }

    async search(query, lat = 19.076, lon = 72.877) {
        if (!this.page) {
            console.error('[API] No browser page available for stealth fetch');
            return [];
        }

        try {
            console.log(`[STEALTH API] Searching: "${query}"`);
            const url = `${this.baseUrl}/search/search_product/?q=${encodeURIComponent(query)}&size=20&lat=${lat}&lon=${lon}`;
            
            const responseData = await this.page.evaluate(async (url) => {
                const res = await fetch(url, {
                    headers: { 'app_client': '1', 'app_instance_id': '8665f97b-4d44-4860-9567-c6b753a99252' }
                });
                const text = await res.text();
                try {
                    return { ok: true, data: JSON.parse(text) };
                } catch (e) {
                    return { ok: false, text: text.substring(0, 500) };
                }
            }, url);

            if (!responseData.ok) {
                console.error('[STEALTH API] Raw Response Error:', responseData.text);
                return [];
            }
            const data = responseData.data;

            return this.transformProducts(data);
        } catch (error) {
            console.error('[STEALTH API] Search Error:', error.message);
            return [];
        }
    }

    async getLayout(lat = 19.076, lon = 72.877) {
        if (!this.page) return [];

        try {
            console.log(`[STEALTH API] Fetching Layout: ${lat}, ${lon}`);
            const url = `${this.baseUrl}/layout/home/?lat=${lat}&lon=${lon}`;
            
            const responseData = await this.page.evaluate(async (url) => {
                const res = await fetch(url, {
                    headers: { 'app_client': '1', 'app_instance_id': '8665f97b-4d44-4860-9567-c6b753a99252' }
                });
                const text = await res.text();
                try {
                    return { ok: true, data: JSON.parse(text) };
                } catch (e) {
                    return { ok: false, text: text.substring(0, 500) };
                }
            }, url);

            if (!responseData.ok) {
                console.error('[STEALTH API] Layout Raw Response Error:', responseData.text);
                return [];
            }
            const data = responseData.data;

            return this.extractCategories(data);
        } catch (error) {
            console.error('[STEALTH API] Layout Error:', error.message);
            return [];
        }
    }

    extractCategories(data) {
        const categories = [];
        const widgets = data?.response?.widgets || [];
        
        widgets.forEach(widget => {
            if (widget.type === 'category_grid' || widget.data?.items) {
                const items = widget.data.items || [];
                items.forEach(item => {
                    if (item.name && item.image_url) {
                        categories.push({
                            id: item.id || item.action?.data?.category_id,
                            name: item.name,
                            image: item.image_url,
                            action: item.action
                        });
                    }
                });
            }
        });

        return Array.from(new Map(categories.map(item => [item.name, item])).values());
    }

    transformProducts(data) {
        const products = [];
        const snippets = data?.response?.snippets || [];
        
        snippets.forEach(s => {
            if (s.data?.name?.text) {
                const p = s.data;
                const price = p.price || (p.normal_price?.text ? parseInt(p.normal_price.text.replace(/[^0-9]/g, '')) : 0);
                const mrp = p.mrp?.text ? parseInt(p.mrp.text.replace(/[^0-9]/g, '')) : price;
                
                products.push({
                    id: p.identity?.id || `b-${Math.random()}`,
                    name: p.name.text,
                    price: price,
                    mrp: mrp > price ? mrp : price,
                    discount: p.discount_percentage || (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0),
                    quantity: p.variant?.text || p.unit || "",
                    image: p.image?.url || "",
                    deliveryTime: p.eta_tag?.title?.text || "8m",
                    productUrl: `https://blinkit.com/prn/${p.name.text.toLowerCase().replace(/ /g, '-')}/prid/${p.identity?.id}`,
                    source: 'blinkit'
                });
            }
        });

        return products;
    }
}

module.exports = new BlinkitAPI();
