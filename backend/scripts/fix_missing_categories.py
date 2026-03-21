#!/usr/bin/env python3
"""
Fix Missing Categories - Ensure all required categories exist

Run with: python3 fix_missing_categories.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# UPDATE THIS TO YOUR ACTUAL DATABASE NAME
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "arkiflo_db"  # <-- CHANGE THIS TO YOUR DB NAME

# Required system categories that should always exist
REQUIRED_CATEGORIES = [
    {"category_id": "customer_payment", "name": "Customer Payment", "type": "inflow", "description": "Customer receipt/advance payment"},
    {"category_id": "liability_settlement", "name": "Liability Settlement", "type": "outflow", "description": "Settlement of vendor liabilities"},
    {"category_id": "invoice_payment", "name": "Invoice Payment", "type": "outflow", "description": "Payment against purchase invoices"},
    {"category_id": "salary_payment", "name": "Salary Payment", "type": "outflow", "description": "Employee salary disbursement"},
    {"category_id": "internal_transfer", "name": "Internal Transfer", "type": "transfer", "description": "Transfer between accounts"},
    {"category_id": "project_expense", "name": "Project Expense", "type": "outflow", "description": "Project-related expenses"},
    {"category_id": "liability_creation", "name": "Liability Creation", "type": "outflow", "description": "Creation of vendor liability"},
    {"category_id": "journal_entry", "name": "Journal Entry", "type": "both", "description": "Manual journal entry adjustment"},
]

async def fix_categories():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"{'='*60}")
    print(f"FIX MISSING CATEGORIES")
    print(f"Database: {DB_NAME}")
    print(f"{'='*60}\n")
    
    # Get existing categories
    existing = await db.accounting_categories.find({}, {"_id": 0, "category_id": 1, "name": 1}).to_list(200)
    existing_ids = {c["category_id"] for c in existing}
    
    print(f"Existing categories: {len(existing)}")
    
    now = datetime.now(timezone.utc).isoformat()
    added = 0
    updated = 0
    
    for cat in REQUIRED_CATEGORIES:
        cat_id = cat["category_id"]
        
        if cat_id not in existing_ids:
            # Add new category
            doc = {
                **cat,
                "is_system": True,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            }
            await db.accounting_categories.insert_one(doc)
            print(f"  ADDED: {cat_id} -> {cat['name']}")
            added += 1
        else:
            # Check if name is set correctly
            existing_cat = await db.accounting_categories.find_one({"category_id": cat_id})
            if not existing_cat.get("name"):
                await db.accounting_categories.update_one(
                    {"category_id": cat_id},
                    {"$set": {"name": cat["name"], "updated_at": now}}
                )
                print(f"  UPDATED: {cat_id} -> {cat['name']} (was missing name)")
                updated += 1
            else:
                print(f"  EXISTS: {cat_id} -> {existing_cat.get('name')}")
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Categories added: {added}")
    print(f"Categories updated: {updated}")
    
    # Verify customer_payment
    cp = await db.accounting_categories.find_one({"category_id": "customer_payment"})
    if cp:
        print(f"\nVerification - customer_payment category:")
        print(f"  category_id: {cp.get('category_id')}")
        print(f"  name: {cp.get('name')}")
    else:
        print("\n⚠️  WARNING: customer_payment still not found!")


if __name__ == "__main__":
    asyncio.run(fix_categories())
