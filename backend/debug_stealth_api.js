const puppeteer = require('puppeteer');

async function testStealthAPI() {
    console.log('🚀 Launching Stealth Browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    console.log('Warming up Blinkit...');
    await page.goto('https://blinkit.com', { waitUntil: 'networkidle2' });

    console.log('\nExecuting API call inside Browser Context...');
    const apiResult = await page.evaluate(async () => {
        const url = 'https://blinkit.com/v1/search/search_product/?q=milk&size=10&lat=19.076&lon=72.877';
        try {
            const res = await fetch(url, {
                headers: {
                    'app_client': '1',
                    'app_instance_id': '8665f97b-4d44-4860-9567-c6b753a99252'
                }
            });
            const data = await res.json();
            return { keys: Object.keys(data), snippetsLength: data.response?.snippets?.length, raw: data };
        } catch (e) {
            return { error: e.message };
        }
    });

    if (apiResult.error) {
        console.error('❌ Stealth API Failed:', apiResult.error);
    } else {
        console.log('✅ Success!');
        console.log('Response Keys:', apiResult.keys);
        console.log('Snippets Count:', apiResult.snippetsLength);
        if (apiResult.snippetsLength > 0) {
            console.log('Sample Product:', apiResult.raw.response.snippets[0].data?.name?.text);
        } else {
             console.log('Full Response (truncated):', JSON.stringify(apiResult.raw).substring(0, 500));
        }
    }

    await browser.close();
}

testStealthAPI();
