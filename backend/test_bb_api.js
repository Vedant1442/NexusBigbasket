const axios = require('axios');

async function testHtml() {
    const pincode = '400001';
    const query = 'milk';
    const url = `https://www.bigbasket.com/ps/?q=${query}`;
    
    console.log(`Testing HTML: ${url}`);
    
    try {
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Cookie': `_bb_pin_code=${pincode}; _bb_cid=1; _bb_lat=19.0760; _bb_lon=72.8777;`,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
        });
        const html = resp.data;
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
        if (nextDataMatch) {
            const data = JSON.parse(nextDataMatch[1]);
            console.log('Success! Found __NEXT_DATA__');
            const ssrData = data.props?.pageProps?.SSRData;
            if (ssrData) {
                console.log('SSRData found! Products count:', ssrData.tabs?.[0]?.product_info?.products?.length);
            } else {
                console.log('SSRData is null. BigBasket is using client-side rendering.');
            }
        } else {
            console.log('__NEXT_DATA__ not found.');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testHtml();
