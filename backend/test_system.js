const WebSocket = require('ws');

async function testLocation(lat, lon, label) {
    console.log(`\n--- Testing ${label} (${lat}, ${lon}) ---`);
    return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:5000');
        let startTime = Date.now();

        ws.on('open', () => {
            console.log(`[WS] Connected for ${label}`);
            ws.send(JSON.stringify({
                action: 'getHomeContent',
                lat,
                lon
            }));
        });

        ws.on('message', (msg) => {
            const data = JSON.parse(msg);
            
            if (data.action === 'homeContent') {
                console.log(`[Home] Got ${data.categories.length} categories, ${data.products.length} featured items.`);
                // Trigger a search for the first category
                if (data.categories.length > 0) {
                    const query = data.categories[0].name;
                    console.log(`[Search] Triggering search for category: "${query}"`);
                    ws.send(JSON.stringify({
                        action: 'search',
                        searchTerm: query,
                        lat,
                        lon,
                        isCategory: true
                    }));
                }
            }

            if (data.action === 'streamUpdate') {
                if (data.scanning) {
                    console.log(`[Stream] 🔍 Scanning live inventory for ${label}...`);
                } else {
                    console.log(`[Stream] ✅ Got ${data.products.length} products from ${data.source}`);
                    ws.close();
                    resolve();
                }
            }
        });

        ws.on('error', (err) => {
            console.error(`[Error] ${label}:`, err.message);
            resolve();
        });

        setTimeout(() => {
            console.log(`[Timeout] ${label} took too long.`);
            ws.close();
            resolve();
        }, 30000);
    });
}

async function runTests() {
    // Mumbai
    await testLocation(19.076, 72.877, "Mumbai");
    // Delhi
    await testLocation(28.6139, 77.2090, "Delhi");
    console.log("\n--- All Tests Done ---");
}

runTests();
