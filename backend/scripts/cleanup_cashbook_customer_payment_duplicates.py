#!/usr/bin/env python3
"""
Cleanup script for duplicate cashbook customer_payment entries.

Problem: Both cashbook and receipts modules were creating ledger entries for customer payments,
causing duplicate entries in the General Ledger.

Solution: 
1. Receipts module is the authoritative source for customer payments
2. Cashbook entries with category_id='customer_payment' are duplicates
3. This script identifies and removes these duplicate entries

Usage:
    python cleanup_cashbook_customer_payment_duplicates.py --dry-run    # Preview only
    python cleanup_cashbook_customer_payment_duplicates.py --execute    # Actually delete
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def main():
    dry_run = "--dry-run" in sys.argv or "--execute" not in sys.argv
    
    print("=" * 70)
    print("CASHBOOK CUSTOMER_PAYMENT DUPLICATE CLEANUP")
    print("=" * 70)
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'EXECUTE (will delete entries)'}")
    print()
    
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "test_database")]
    
    # Find all cashbook entries with customer_payment category
    # These are duplicates because receipts module should be the only source
    # Also include legacy entries with missing/unknown source_module
    duplicate_query = {
        "$or": [
            {"source_module": "cashbook", "category_id": "customer_payment"},
            {"source_module": {"$in": [None, "unknown"]}, "category_id": "customer_payment"},
            {"source_module": {"$exists": False}, "category_id": "customer_payment"}
        ]
    }
    
    # Exclude entries from receipts module (the authoritative source)
    duplicate_query["source_module"] = {"$nin": ["receipts", "receipt_cancellation"]}
    
    duplicates = await db.accounting_transactions.find(
        {"$and": [
            {"$or": [
                {"source_module": "cashbook", "category_id": "customer_payment"},
                {"source_module": {"$in": [None, "unknown"]}, "category_id": "customer_payment"},
                {"source_module": {"$exists": False}, "category_id": "customer_payment"}
            ]},
            {"source_module": {"$nin": ["receipts", "receipt_cancellation"]}}
        ]},
        {"_id": 0}
    ).to_list(10000)
    
    print(f"Found {len(duplicates)} duplicate customer_payment entries (from cashbook or unknown source)")
    print()
    
    if not duplicates:
        print("No duplicates found. Database is clean.")
        return
    
    # Also find their paired counter entries
    paired_ids = [d.get("paired_transaction_id") for d in duplicates if d.get("paired_transaction_id")]
    reference_ids = [d.get("reference_id") for d in duplicates if d.get("reference_id")]
    
    # Counter entries created by cashbook for customer_payment
    counter_query = {
        "$or": [
            {"paired_transaction_id": {"$in": [d.get("transaction_id") for d in duplicates]}},
            {"transaction_id": {"$in": paired_ids}}
        ]
    }
    
    counter_entries = await db.accounting_transactions.find(counter_query, {"_id": 0}).to_list(10000)
    
    print(f"Found {len(counter_entries)} related counter entries")
    print()
    
    # Combine all entries to delete
    all_txn_ids = set()
    total_amount = 0
    
    print("Duplicate entries to remove:")
    print("-" * 70)
    for d in duplicates:
        all_txn_ids.add(d.get("transaction_id"))
        total_amount += d.get("amount", 0)
        print(f"  {d.get('transaction_id')}: ₹{d.get('amount'):,.0f} on {d.get('transaction_date', d.get('created_at', '?'))[:10]}")
        print(f"    account={d.get('account_id')} type={d.get('transaction_type')} role={d.get('entry_role', 'primary')}")
    
    print()
    print("Counter entries to remove:")
    print("-" * 70)
    for c in counter_entries:
        if c.get("transaction_id") not in all_txn_ids:
            all_txn_ids.add(c.get("transaction_id"))
            total_amount += c.get("amount", 0)
            print(f"  {c.get('transaction_id')}: ₹{c.get('amount'):,.0f}")
            print(f"    account={c.get('account_id')} type={c.get('transaction_type')} role={c.get('entry_role', 'counter')}")
    
    print()
    print("=" * 70)
    print(f"SUMMARY: {len(all_txn_ids)} entries to delete, total value: ₹{total_amount:,.0f}")
    print("=" * 70)
    
    if dry_run:
        print()
        print("DRY RUN complete. No changes made.")
        print("Run with --execute to actually delete these entries.")
    else:
        print()
        confirm = input("Type 'DELETE' to confirm deletion: ")
        if confirm == "DELETE":
            # Delete the entries
            result = await db.accounting_transactions.delete_many({
                "transaction_id": {"$in": list(all_txn_ids)}
            })
            print(f"Deleted {result.deleted_count} entries.")
            
            # Log the cleanup
            await db.accounting_audit_log.insert_one({
                "action": "cleanup_duplicate_customer_payment",
                "deleted_count": result.deleted_count,
                "transaction_ids": list(all_txn_ids),
                "total_amount": total_amount,
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "executed_by": "system_cleanup_script"
            })
            print("Cleanup logged to accounting_audit_log.")
        else:
            print("Deletion cancelled.")

if __name__ == "__main__":
    asyncio.run(main())
