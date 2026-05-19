import json
import re
import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

try:
    resp = requests.get('https://www.bigbasket.com/', headers=headers)
    html = resp.text
    
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if match:
        data = json.loads(match.group(1))
        widgets = data.get('props', {}).get('pageProps', {}).get('SSRData', {}).get('widgets', [])
        print(f"Found {len(widgets)} widgets")
        for w in widgets:
            print(f"- Type: {w.get('type')}, Title: {w.get('title')}")
            if w.get('type') == 'StoreEntry':
                items = w.get('sectionData', {}).get('storeEntry', [])
                for item in items:
                    print(f"  * Category: {item.get('alt')}")
    else:
        print("Could not find __NEXT_DATA__")
except Exception as e:
    print(f"Error: {e}")
