"""
Data Migration Script: Convert Old Categories to New Structure
==============================================================
This script migrates existing data to use the new category + work_type structure.

Mapping Rules:
- "Modular Material" → category: "Material", work_type: "modular"
- "Non-Modular Furniture" → category: "Furniture & Decor", work_type: "non_modular"
- "Modular" → category: "Material", work_type: "modular"
- "Non-Modular" → category: "Furniture & Decor", work_type: "non_modular"
- "Transportation / Logistics" → category: "Transport / Logistics", work_type: "general"
- "Transport" → category: "Transport / Logistics", work_type: "general"
- Old categories without work_type → work_type: "general"

Usage:
------
1. DRY RUN (preview changes):
   python migrate_categories.py --dry-run

2. APPLY MIGRATION:
   python migrate_categories.py

3. VERIFY:
   python migrate_categories.py --verify
"""

import os
from pymongo import MongoClient
from datetime import datetime, timezone
import argparse

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "arkiflo")

# Category mapping rules: old_value -> (new_category, work_type)
CATEGORY_MAPPING = {
    # Old combined categories
    "Modular Material": ("Material", "modular"),
    "Non-Modular Furniture": ("Furniture & Decor", "non_modular"),
    "Modular": ("Material", "modular"),
    "Non-Modular": ("Furniture & Decor", "non_modular"),
    
    # Transportation variants
    "Transportation / Logistics": ("Transport / Logistics", "general"),
    "Transport": ("Transport / Logistics", "general"),
    "Transportation": ("Transport / Logistics", "general"),
    
    # Other mappings
    "Hardware & Accessories": ("Hardware & Accessories", "general"),
    "Hardware": ("Hardware & Accessories", "general"),
    "Factory / Job Work": ("Factory / Production", "general"),
    "Factory / Production": ("Factory / Production", "general"),
    "Site Expense": ("Site Expense", "general"),
    "Site Expenses": ("Site Expense", "general"),
    "Installation": ("Installation", "general"),
    "Labour": ("Labour", "general"),
    "Material": ("Material", "general"),
    "Furniture & Decor": ("Furniture & Decor", "general"),
    "Other": ("Other", "general"),
}

def get_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def map_category(old_category):
    """Map old category to new (category, work_type) tuple."""
    if old_category in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[old_category]
    # Default: keep category as-is with work_type = general
    return (old_category or "Other", "general")

def migrate_vendor_mappings(db, dry_run=False):
    """Migrate finance_vendor_mappings collection."""
    print("\n" + "="*50)
    print("MIGRATING VENDOR MAPPINGS")
    print("="*50 + "\n")
    
    mappings = list(db.finance_vendor_mappings.find({}))
    migrated = 0
    
    for mapping in mappings:
        old_category = mapping.get("category", "Other")
        has_work_type = "work_type" in mapping
        
        if has_work_type and mapping.get("work_type"):
            # Already migrated
            continue
        
        new_category, work_type = map_category(old_category)
        
        print(f"  Mapping ID: {mapping.get('mapping_id')}")
        print(f"    Old: {old_category}")
        print(f"    New: category={new_category}, work_type={work_type}")
        
        if not dry_run:
            db.finance_vendor_mappings.update_one(
                {"_id": mapping["_id"]},
                {"$set": {
                    "category": new_category,
                    "work_type": work_type,
                    "migrated_at": datetime.now(timezone.utc).isoformat(),
                    "old_category": old_category  # Keep for audit
                }}
            )
        
        migrated += 1
    
    print(f"\n  Total migrated: {migrated}")
    return migrated

def migrate_purchase_invoices(db, dry_run=False):
    """Migrate execution_ledger (purchase invoices) items."""
    print("\n" + "="*50)
    print("MIGRATING PURCHASE INVOICES")
    print("="*50 + "\n")
    
    invoices = list(db.execution_ledger.find({}))
    migrated = 0
    
    for invoice in invoices:
        items = invoice.get("items", [])
        needs_update = False
        updated_items = []
        
        for item in items:
            old_category = item.get("category", "Other")
            has_work_type = "work_type" in item
            
            if has_work_type and item.get("work_type"):
                updated_items.append(item)
                continue
            
            new_category, work_type = map_category(old_category)
            
            item["category"] = new_category
            item["work_type"] = work_type
            item["old_category"] = old_category  # Keep for audit
            updated_items.append(item)
            needs_update = True
        
        if needs_update:
            print(f"  Invoice: {invoice.get('execution_id')} - {len(updated_items)} items")
            
            if not dry_run:
                db.execution_ledger.update_one(
                    {"_id": invoice["_id"]},
                    {"$set": {
                        "items": updated_items,
                        "migrated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            migrated += 1
    
    print(f"\n  Total invoices migrated: {migrated}")
    return migrated

def migrate_cashbook_entries(db, dry_run=False):
    """Migrate accounting_transactions (cashbook entries)."""
    print("\n" + "="*50)
    print("MIGRATING CASHBOOK ENTRIES")
    print("="*50 + "\n")
    
    entries = list(db.accounting_transactions.find({"project_id": {"$exists": True, "$ne": None}}))
    migrated = 0
    
    for entry in entries:
        old_category = entry.get("category_id") or entry.get("category", "Other")
        has_work_type = "work_type" in entry
        
        if has_work_type and entry.get("work_type"):
            continue
        
        new_category, work_type = map_category(old_category)
        
        if not dry_run:
            db.accounting_transactions.update_one(
                {"_id": entry["_id"]},
                {"$set": {
                    "category_id": new_category,
                    "work_type": work_type,
                    "migrated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        migrated += 1
    
    print(f"  Total entries migrated: {migrated}")
    return migrated

def seed_categories(db, dry_run=False):
    """Seed the new primary categories."""
    print("\n" + "="*50)
    print("SEEDING PRIMARY CATEGORIES")
    print("="*50 + "\n")
    
    categories = [
        {"category_id": "cat_material", "name": "Material", "description": "Raw materials and supplies"},
        {"category_id": "cat_furniture_and_decor", "name": "Furniture & Decor", "description": "Furniture, decor items, and furnishings"},
        {"category_id": "cat_labour", "name": "Labour", "description": "Labour and workforce costs"},
        {"category_id": "cat_hardware_and_accessories", "name": "Hardware & Accessories", "description": "Hardware items and accessories"},
        {"category_id": "cat_transport___logistics", "name": "Transport / Logistics", "description": "Transportation and logistics costs"},
        {"category_id": "cat_installation", "name": "Installation", "description": "Installation and fitting charges"},
        {"category_id": "cat_factory___production", "name": "Factory / Production", "description": "Factory and production related costs"},
        {"category_id": "cat_site_expense", "name": "Site Expense", "description": "On-site operational costs"},
        {"category_id": "cat_other", "name": "Other", "description": "Other uncategorized expenses"}
    ]
    
    now = datetime.now(timezone.utc).isoformat()
    
    for idx, cat in enumerate(categories):
        existing = db.accounting_categories.find_one({"name": cat["name"]})
        if existing:
            print(f"  [EXISTS] {cat['name']}")
            continue
        
        cat["is_active"] = True
        cat["is_system"] = True
        cat["sort_order"] = idx
        cat["created_at"] = now
        
        if not dry_run:
            db.accounting_categories.insert_one(cat)
        
        print(f"  [CREATED] {cat['name']}")
    
    print("\n  Categories seeded.")

def verify_migration(db):
    """Verify migration was successful."""
    print("\n" + "="*50)
    print("VERIFICATION REPORT")
    print("="*50 + "\n")
    
    # Check vendor mappings
    vm_total = db.finance_vendor_mappings.count_documents({})
    vm_with_work_type = db.finance_vendor_mappings.count_documents({"work_type": {"$exists": True}})
    print(f"Vendor Mappings: {vm_with_work_type}/{vm_total} have work_type")
    
    # Check purchase invoices
    inv_total = db.execution_ledger.count_documents({})
    print(f"Purchase Invoices: {inv_total} total")
    
    # Check accounting categories
    cat_count = db.accounting_categories.count_documents({})
    print(f"Categories: {cat_count} total")
    
    # List categories
    print("\nCategories in database:")
    for cat in db.accounting_categories.find({}, {"_id": 0, "name": 1, "is_system": 1}).sort("sort_order", 1):
        print(f"  • {cat.get('name')} {'(system)' if cat.get('is_system') else ''}")

def main():
    parser = argparse.ArgumentParser(description="Migrate categories to new structure")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--verify", action="store_true", help="Verify migration status")
    
    args = parser.parse_args()
    
    db = get_db()
    
    print(f"\nDatabase: {DB_NAME}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE' if not args.verify else 'VERIFY'}")
    
    if args.verify:
        verify_migration(db)
    else:
        seed_categories(db, args.dry_run)
        migrate_vendor_mappings(db, args.dry_run)
        migrate_purchase_invoices(db, args.dry_run)
        migrate_cashbook_entries(db, args.dry_run)
        
        if args.dry_run:
            print("\n⚠️  DRY RUN - No changes were made.")
            print("   Run without --dry-run to apply changes.")
        else:
            print("\n✅ Migration complete!")
            verify_migration(db)

if __name__ == "__main__":
    main()
