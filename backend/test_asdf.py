import asyncio
import json
import urllib.parse
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        stealth = Stealth()
        await stealth.apply_stealth_async(page)
        
        async def handle_response(response):
            if 'listing-svc/v2/products' in response.url and response.request.resource_type in ['fetch', 'xhr']:
                try:
                    text = await response.text()
                    with open('asdf_resp.json', 'w', encoding='utf-8') as f:
                        f.write(text)
                    print('Captured listing-svc for asdfghjkl')
                except Exception as e:
                    pass

        page.on('response', handle_response)
        await page.goto('https://www.bigbasket.com/ps/?q=asdfghjkl', wait_until='networkidle')
        await browser.close()

asyncio.run(main())
