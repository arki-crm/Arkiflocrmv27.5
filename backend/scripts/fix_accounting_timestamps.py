"""
Migration Script: Fix Accounting Timestamps
============================================
This script fixes inconsistent timestamp formats in the accounting_transactions collection.
The bug caused some timestamps to be stored as datetime objects while others were ISO strings,
which broke the Trial Balance and General Ledger queries.

Usage:
------
1. First, run in DRY RUN mode to see what will be fixed:
   python fix_accounting_timestamps.py --dry-run

2. Then run the actual migration:
   python fix_accounting_timestamps.py

3. Verify the fix by checking a specific receipt:
   python fix_accounting_timestamps.py --verify --receipt-id <RECEIPT_ID>
"""

import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import ObjectId
import argparse

# Configuration - Update these for your environment
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

def get_db():
    """Connect to MongoDB and return the database."""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def normalize_timestamp(value):
    """Convert any timestamp format to ISO 8601 string."""
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    
    if isinstance(value, str):
        # Already a string, ensure it's valid ISO format
        try:
            # Parse and re-format to ensure consistency
            if value.endswith('Z'):
                value = value[:-1] + '+00:00'
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return dt.isoformat()
        except:
            return datetime.now(timezone.utc).isoformat()
    
    if isinstance(value, datetime):
        # Convert datetime object to ISO string
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    
    # Unknown format, use current time
    return datetime.now(timezone.utc).isoformat()

def fix_timestamps(dry_run=False):
    """Fix all inconsistent timestamps in accounting_transactions."""
    db = get_db()
    collection = db["accounting_transactions"]
    
    # Find all transactions
    transactions = list(collection.find({}))
    
    print(f"\n{'='*60}")
    print(f"ACCOUNTING TIMESTAMP MIGRATION")
    print(f"{'='*60}")
    print(f"Database: {DB_NAME}")
    print(f"Total transactions found: {len(transactions)}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will update)'}")
    print(f"{'='*60}\n")
    
    fixed_count = 0
    error_count = 0
    already_correct = 0
    
    for txn in transactions:
        txn_id = txn.get("_id")
        created_at = txn.get("created_at")
        updated_at = txn.get("updated_at")
        
        needs_fix = False
        updates = {}
        
        # Check created_at
        if isinstance(created_at, datetime):
            needs_fix = True
            updates["created_at"] = normalize_timestamp(created_at)
            print(f"[FIX] Transaction {txn_id}")
            print(f"      created_at: {type(created_at).__name__} -> string")
        elif created_at is None:
            needs_fix = True
            updates["created_at"] = datetime.now(timezone.utc).isoformat()
            print(f"[FIX] Transaction {txn_id}")
            print(f"      created_at: None -> string")
        
        # Check updated_at
        if isinstance(updated_at, datetime):
            needs_fix = True
            updates["updated_at"] = normalize_timestamp(updated_at)
            if "created_at" not in updates:
                print(f"[FIX] Transaction {txn_id}")
            print(f"      updated_at: {type(updated_at).__name__} -> string")
        
        if needs_fix:
            if not dry_run:
                try:
                    collection.update_one(
                        {"_id": txn_id},
                        {"$set": updates}
                    )
                    fixed_count += 1
                except Exception as e:
                    print(f"[ERROR] Failed to update {txn_id}: {e}")
                    error_count += 1
            else:
                fixed_count += 1
        else:
            already_correct += 1
    
    print(f"\n{'='*60}")
    print(f"MIGRATION SUMMARY")
    print(f"{'='*60}")
    print(f"Transactions needing fix: {fixed_count}")
    print(f"Already correct: {already_correct}")
    print(f"Errors: {error_count}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN - No changes were made.")
        print(f"   Run without --dry-run to apply fixes.")
    else:
        print(f"\n✅ Migration complete! {fixed_count} transactions fixed.")
    
    print(f"{'='*60}\n")
    
    return fixed_count, error_count

def verify_receipt(receipt_id):
    """Verify that a specific receipt has correct double-entry transactions."""
    db = get_db()
    
    print(f"\n{'='*60}")
    print(f"VERIFYING RECEIPT: {receipt_id}")
    print(f"{'='*60}\n")
    
    # Find all transactions for this receipt
    transactions = list(db["accounting_transactions"].find({
        "reference_id": receipt_id,
        "reference_type": "receipt"
    }))
    
    if not transactions:
        print(f"❌ No transactions found for receipt {receipt_id}")
        return False
    
    print(f"Found {len(transactions)} transaction(s):\n")
    
    total_debit = 0
    total_credit = 0
    
    for txn in transactions:
        debit = txn.get("debit", 0)
        credit = txn.get("credit", 0)
        account = txn.get("account_name", "Unknown")
        created_at = txn.get("created_at")
        entry_role = txn.get("entry_role", "N/A")
        
        total_debit += debit
        total_credit += credit
        
        timestamp_type = type(created_at).__name__
        timestamp_ok = "✅" if isinstance(created_at, str) else "❌"
        
        print(f"  Account: {account}")
        print(f"  Debit: {debit:,.2f} | Credit: {credit:,.2f}")
        print(f"  Entry Role: {entry_role}")
        print(f"  Timestamp: {timestamp_ok} ({timestamp_type})")
        print(f"  ---")
    
    print(f"\nTOTALS:")
    print(f"  Total Debit:  {total_debit:,.2f}")
    print(f"  Total Credit: {total_credit:,.2f}")
    
    balanced = abs(total_debit - total_credit) < 0.01
    
    if balanced:
        print(f"\n✅ BALANCED - Double-entry is correct!")
    else:
        print(f"\n❌ UNBALANCED - Difference: {abs(total_debit - total_credit):,.2f}")
    
    print(f"{'='*60}\n")
    
    return balanced

def check_all_receipts():
    """Check all receipts for proper double-entry."""
    db = get_db()
    
    print(f"\n{'='*60}")
    print(f"CHECKING ALL RECEIPTS FOR DOUBLE-ENTRY")
    print(f"{'='*60}\n")
    
    # Get all receipts
    receipts = list(db["receipts"].find({}))
    print(f"Total receipts: {len(receipts)}\n")
    
    balanced_count = 0
    unbalanced_count = 0
    missing_entries = []
    
    for receipt in receipts:
        receipt_id = str(receipt["_id"])
        receipt_no = receipt.get("receipt_no", "N/A")
        
        # Find transactions for this receipt
        transactions = list(db["accounting_transactions"].find({
            "reference_id": receipt_id,
            "reference_type": "receipt"
        }))
        
        if len(transactions) == 0:
            print(f"❌ Receipt {receipt_no}: NO TRANSACTIONS FOUND")
            missing_entries.append(receipt_id)
            unbalanced_count += 1
            continue
        
        total_debit = sum(t.get("debit", 0) for t in transactions)
        total_credit = sum(t.get("credit", 0) for t in transactions)
        
        if abs(total_debit - total_credit) < 0.01:
            print(f"✅ Receipt {receipt_no}: Balanced (D:{total_debit:,.2f} C:{total_credit:,.2f})")
            balanced_count += 1
        else:
            print(f"❌ Receipt {receipt_no}: UNBALANCED (D:{total_debit:,.2f} C:{total_credit:,.2f})")
            unbalanced_count += 1
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Balanced receipts: {balanced_count}")
    print(f"Unbalanced receipts: {unbalanced_count}")
    
    if missing_entries:
        print(f"\nReceipts missing transactions: {len(missing_entries)}")
        for rid in missing_entries[:5]:
            print(f"  - {rid}")
        if len(missing_entries) > 5:
            print(f"  ... and {len(missing_entries) - 5} more")
    
    print(f"{'='*60}\n")

def main():
    parser = argparse.ArgumentParser(description="Fix accounting timestamp inconsistencies")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying them")
    parser.add_argument("--verify", action="store_true", help="Verify a specific receipt")
    parser.add_argument("--receipt-id", type=str, help="Receipt ID to verify")
    parser.add_argument("--check-all", action="store_true", help="Check all receipts for double-entry")
    
    args = parser.parse_args()
    
    if args.verify:
        if not args.receipt_id:
            print("Error: --receipt-id is required with --verify")
            sys.exit(1)
        verify_receipt(args.receipt_id)
    elif args.check_all:
        check_all_receipts()
    else:
        fix_timestamps(dry_run=args.dry_run)

if __name__ == "__main__":
    main()
