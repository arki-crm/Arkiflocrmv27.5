#!/usr/bin/env python3
"""
Vendor Migration Script
-----------------------
Migrates vendor records from accounting_vendors to finance_vendors.
This establishes finance_vendors as the single source of truth.

Usage:
    python migrate_vendors.py

Schema mapping:
    accounting_vendors.vendor_name -> finance_vendors.name
    All other fields are preserved
"""

import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


async def migrate_vendors():
    """Migrate vendors from accounting_vendors to finance_vendors"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("VENDOR MIGRATION: accounting_vendors -> finance_vendors")
    print("=" * 60)
    print()
    
    # Get counts before migration
    acc_count = await db.accounting_vendors.count_documents({})
    fin_count = await db.finance_vendors.count_documents({})
    
    print(f"Before migration:")
    print(f"  accounting_vendors: {acc_count} records")
    print(f"  finance_vendors: {fin_count} records")
    print()
    
    # Get existing vendor_ids in finance_vendors to avoid duplicates
    existing_ids = set()
    existing_names = set()
    async for v in db.finance_vendors.find({}, {"vendor_id": 1, "name": 1}):
        if v.get("vendor_id"):
            existing_ids.add(v["vendor_id"])
        if v.get("name"):
            existing_names.add(v["name"].lower())
    
    print(f"Existing vendor_ids in finance_vendors: {len(existing_ids)}")
    print()
    
    # Migrate records from accounting_vendors
    migrated = 0
    skipped = 0
    errors = 0
    
    async for acc_vendor in db.accounting_vendors.find({}):
        vendor_id = acc_vendor.get("vendor_id")
        vendor_name = acc_vendor.get("vendor_name")
        
        # Skip if vendor_id already exists
        if vendor_id in existing_ids:
            print(f"  SKIP (duplicate ID): {vendor_id} - {vendor_name}")
            skipped += 1
            continue
        
        # Skip if vendor name already exists (case-insensitive)
        if vendor_name and vendor_name.lower() in existing_names:
            print(f"  SKIP (duplicate name): {vendor_id} - {vendor_name}")
            skipped += 1
            continue
        
        try:
            # Create new record for finance_vendors
            new_vendor = {
                "vendor_id": vendor_id,
                "name": vendor_name,  # Map vendor_name -> name
                "vendor_type": acc_vendor.get("vendor_type"),
                "contact_person": acc_vendor.get("contact_person"),
                "phone": acc_vendor.get("phone"),
                "email": acc_vendor.get("email"),
                "address": acc_vendor.get("address"),
                "gstin": acc_vendor.get("gstin"),
                "pan": acc_vendor.get("pan"),
                "bank_account_name": acc_vendor.get("bank_account_name"),
                "bank_account_number": acc_vendor.get("bank_account_number"),
                "bank_ifsc": acc_vendor.get("bank_ifsc"),
                "notes": acc_vendor.get("notes"),
                "is_active": acc_vendor.get("is_active", True),
                "auto_created": acc_vendor.get("auto_created", False),
                "created_at": acc_vendor.get("created_at", datetime.now(timezone.utc).isoformat()),
                "created_by": acc_vendor.get("created_by"),
                "created_by_name": acc_vendor.get("created_by_name"),
                "migrated_from": "accounting_vendors",
                "migrated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.finance_vendors.insert_one(new_vendor)
            existing_ids.add(vendor_id)
            if vendor_name:
                existing_names.add(vendor_name.lower())
            print(f"  MIGRATED: {vendor_id} - {vendor_name}")
            migrated += 1
            
        except Exception as e:
            print(f"  ERROR: {vendor_id} - {vendor_name}: {e}")
            errors += 1
    
    # Get counts after migration
    fin_count_after = await db.finance_vendors.count_documents({})
    
    print()
    print("=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    print(f"  Migrated: {migrated}")
    print(f"  Skipped (duplicates): {skipped}")
    print(f"  Errors: {errors}")
    print()
    print(f"After migration:")
    print(f"  finance_vendors: {fin_count_after} records")
    print()
    
    if errors == 0 and migrated > 0:
        print("SUCCESS: All vendors migrated successfully.")
        print()
        print("Next steps:")
        print("  1. Verify data in finance_vendors")
        print("  2. Update vendor CRUD endpoints to use finance_vendors")
        print("  3. After verification, archive accounting_vendors:")
        print("     db.accounting_vendors.renameCollection('accounting_vendors_archived')")
    
    client.close()
    return migrated, skipped, errors


if __name__ == "__main__":
    asyncio.run(migrate_vendors())
