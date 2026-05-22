/**
 * lib/searchCache.js
 * 
 * A simple in-memory cache for search results to avoid redundant DB/Scraper hits.
 * Items expire after a set TTL (Time-To-Live).
 */

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

class SearchCache {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Generate a unique key for the search
     */
    generateKey(query, pincode, isCategory) {
        return `${query.toLowerCase().trim()}::${pincode}::${isCategory}`;
    }

    /**
     * Set results in cache
     */
    set(query, pincode, isCategory, results) {
        const key = this.generateKey(query, pincode, isCategory);
        this.cache.set(key, {
            results,
            timestamp: Date.now()
        });
        
        // Clean up old entries periodically
        this.cleanup();
    }

    /**
     * Get results from cache
     */
    get(query, pincode, isCategory) {
        const key = this.generateKey(query, pincode, isCategory);
        const entry = this.cache.get(key);
        
        if (entry && (Date.now() - entry.timestamp < CACHE_TTL)) {
            return entry.results;
        }
        
        if (entry) this.cache.delete(key); // Expired
        return null;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > CACHE_TTL) {
                this.cache.delete(key);
            }
        }
    }
}

module.exports = new SearchCache();
