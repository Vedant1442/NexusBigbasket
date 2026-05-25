import os
import sys
import json
from patchright.sync_api import sync_playwright

def intercept_and_dump(search_query="milk", target_pincode="431001"):
    print(f"🚀 Launching VISUAL Stealth Browser for '{search_query}'...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False) 
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        context.add_cookies([{
            "name": "_bb_pin_code",
            "value": str(target_pincode),
            "domain": ".bigbasket.com",
            "path": "/"
        }])
        
        page = context.new_page()
        captured = {"status": False}
        
        def handle_response(response):
            # Ignore pre-flight OPTIONS requests
            if response.request.method == "OPTIONS":
                return
                
            if "listing-svc/v2/products" in response.url and response.status == 200:
                print(f"🎯 BOOM! API Intercepted: {response.url[:60]}...")
                try:
                    raw_json = response.json()
                    
                    # 🚨 THE BRIEFCASE DUMP 🚨
                    with open("bb_payload.json", "w", encoding="utf-8") as f:
                        json.dump(raw_json, f, indent=2)
                        
                    print("📦 RAW JSON SUCCESSFULLY SAVED TO 'bb_payload.json'!")
                    captured["status"] = True
                except Exception as e:
                    print(f"❌ Failed to read JSON body: {e}")
                    
        page.on("response", handle_response)
        url = f"https://www.bigbasket.com/ps/?q={search_query}"
        
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            if captured["status"]:
                print("\n✅ Operation Complete. Check your VS Code folder for 'bb_payload.json'!")
            else:
                print("\n⚠️ Failed to capture the payload.")
        except Exception as e:
            print(f"❌ Error during browser navigation: {str(e)}")
        finally:
            browser.close()

if __name__ == "__main__":
    intercept_and_dump()