const puppeteer = require('puppeteer');

async function discoverRealURL() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    
    page.on('request', req => {
        console.log('🔗 REQ:', req.url());
    });

    await page.goto('https://blinkit.com/s/?q=milk', { waitUntil: 'networkidle2' });
    await browser.close();
}

discoverRealURL();
