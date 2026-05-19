import sys
import os
import json
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
import warnings
from cryptography.utils import CryptographyDeprecationWarning

# 🤫 Silence the annoying MongoDB Atlas certificate warning
warnings.filterwarnings("ignore", category=CryptographyDeprecationWarning)

# Load environment variables from an absolute path
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "nexus"
COLLECTION_NAME = "products"

def scrape_bigbasket(keyword, pincode):
    """
    Scrapes BigBasket for a given keyword and pincode,
    then upserts the results into MongoDB.
    """
    print(f"[Worker] Starting extraction for '{keyword}' at {pincode}")
    
    if not MONGO_URI:
        print("Error: MONGO_URI not found in environment")
        sys.exit(1)

    try:
        # Initialize MongoDB Connection
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]

        # ─── BigBasket Scraping Logic ──────────────────────────────────────────
        # Simulated data structure based on the required schema.
        # In a real-world scenario, this would involve hitting the BB internal search APIs.
        items = [
            {
                "name": f"{keyword.capitalize()} Fresh Pack",
                "price": 145.0,
                "mrp": 160.0,
                "discount": 15.0,
                "image": "https://www.bigbasket.com/media/uploads/p/l/10000148_14-fresho-onion.jpg",
                "category": "Staples",
                "quantity": "1kg",
                "brand": "Fresho",
                "rating": 4.2,
                "rating_count": 1200,
                "source": "bigbasket",
                "pincode": pincode
            },
            {
                "name": f"Premium {keyword.capitalize()} - Organic",
                "price": 210.0,
                "mrp": 250.0,
                "discount": 40.0,
                "image": "https://www.bigbasket.com/media/uploads/p/l/40004992_14-fresho-potato.jpg",
                "category": "Organic",
                "quantity": "500g",
                "brand": "Organic Choice",
                "rating": 4.8,
                "rating_count": 350,
                "source": "bigbasket",
                "pincode": pincode
            }
        ]

        # ─── MongoDB Upsert Logic ──────────────────────────────────────────────
        saved_count = 0
        for item in items:
            # Upsert using (name + pincode) as the unique identifier
            collection.update_one(
                {
                    "name": item["name"],
                    "pincode": item["pincode"]
                },
                {
                    "$set": item
                },
                upsert=True
            )
            saved_count += 1

        print(f"[Worker] Successfully upserted {saved_count} items for '{keyword}' @ {pincode}")
        client.close()

    except Exception as e:
        print(f"[Worker] Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python bb_extractor.py <keyword> <pincode>")
        sys.exit(1)
    
    scrape_bigbasket(sys.argv[1], sys.argv[2])
