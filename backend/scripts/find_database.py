"""
Diagnostic Script: Find the correct database with your data
============================================================
This script lists all databases and shows which ones have 
accounting_transactions and receipts collections.
"""

import os
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

def find_databases():
    client = MongoClient(MONGO_URL)
    
    print(f"\n{'='*60}")
    print(f"SCANNING ALL DATABASES")
    print(f"{'='*60}")
    print(f"MongoDB URL: {MONGO_URL}\n")
    
    # Get all database names
    db_names = client.list_database_names()
    print(f"Found {len(db_names)} databases:\n")
    
    found_data = []
    
    for db_name in db_names:
        # Skip system databases
        if db_name in ['admin', 'config', 'local']:
            print(f"  [{db_name}] - system database, skipping")
            continue
        
        db = client[db_name]
        collections = db.list_collection_names()
        
        # Check for relevant collections
        has_transactions = "accounting_transactions" in collections
        has_receipts = "receipts" in collections
        has_ledgers = "ledgers" in collections
        
        txn_count = db["accounting_transactions"].count_documents({}) if has_transactions else 0
        receipt_count = db["receipts"].count_documents({}) if has_receipts else 0
        ledger_count = db["ledgers"].count_documents({}) if has_ledgers else 0
        
        print(f"  [{db_name}]")
        print(f"      Collections: {len(collections)}")
        print(f"      accounting_transactions: {txn_count} documents")
        print(f"      receipts: {receipt_count} documents")
        print(f"      ledgers: {ledger_count} documents")
        
        if txn_count > 0 or receipt_count > 0:
            found_data.append({
                "db_name": db_name,
                "transactions": txn_count,
                "receipts": receipt_count
            })
        
        print()
    
    print(f"{'='*60}")
    print(f"RECOMMENDATION")
    print(f"{'='*60}")
    
    if found_data:
        # Sort by transaction count
        found_data.sort(key=lambda x: x["transactions"] + x["receipts"], reverse=True)
        best = found_data[0]
        
        print(f"\n✅ Your data is likely in: {best['db_name']}")
        print(f"   ({best['transactions']} transactions, {best['receipts']} receipts)")
        print(f"\nRun the migration with:")
        print(f"   export DB_NAME=\"{best['db_name']}\"")
        print(f"   python fix_accounting_timestamps.py --dry-run")
    else:
        print(f"\n❌ No databases found with accounting data.")
        print(f"   Please verify your MongoDB connection.")
    
    print(f"{'='*60}\n")

if __name__ == "__main__":
    find_databases()
