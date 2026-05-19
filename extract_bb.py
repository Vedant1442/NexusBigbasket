import json
import re

try:
    with open('bb_home.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if match:
        data = json.loads(match.group(1))
        with open('bb_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Successfully extracted to bb_data.json")
    else:
        print("Could not find __NEXT_DATA__")
except Exception as e:
    print(f"Error: {e}")
