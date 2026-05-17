const axios = require('axios');
const blinkit = require('../backend/extractors/blinkit');

async function testBlinkit() {
    console.log("Testing Blinkit Extractor...");
    const query = "milk";
    const url = blinkit.url(query);
    console.log("URL:", url);

    try {
        const response = await axios.get(url, {
            headers: {
                'app_client': 'consumer_web',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });
        const products = blinkit.extract(response.data);
        console.log(`Found ${products.length} products.`);
        if (products.length > 0) {
            console.log("Sample Product:", products[0]);
        } else {
            console.log("RAW RESPONSE:", JSON.stringify(response.data).slice(0, 500));
        }
    } catch (e) {
        console.error("Test Failed:", e.message);
    }
}

testBlinkit();
