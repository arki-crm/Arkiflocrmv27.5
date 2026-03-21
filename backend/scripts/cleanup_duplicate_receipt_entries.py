#!/usr/bin/env python3
"""
Cleanup Duplicate Receipt Accounting Entries

This script:
1. Audits all receipts for duplicate accounting entries
2. Identifies receipts with more than 2 entries (excluding cancellation reversals)
3. Removes duplicate counter entries while keeping the correct 2-entry structure:
   - 1x Primary inflow (Bank debit)
   - 1x Counter outflow (Customer Advance credit)

Run with: python cleanup_duplicate_receipt_entries.py [--dry-run]
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

async def audit_and_cleanup_duplicates(dry_run=True):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"{'='*60}")
    print(f"RECEIPT DUPLICATE ENTRY CLEANUP")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will delete duplicates)'}")
    print(f"{'='*60}\n")
    
    # Get all receipts
    receipts = await db.finance_receipts.find({}, {"_id": 0, "receipt_id": 1, "receipt_number": 1, "amount": 1, "status": 1}).to_list(1000)
    
    print(f"Total receipts: {len(receipts)}\n")
    
    duplicates_fixed = 0
    entries_deleted = 0
    
    for receipt in receipts:
        rid = receipt.get("receipt_id")
        rnum = receipt.get("receipt_number")
        amt = receipt.get("amount", 0)
        status = receipt.get("status", "active")
        
        # Find ALL transactions linked to this receipt
        txns = await db.accounting_transactions.find(
            {"$or": [
                {"receipt_id": rid},
                {"reference_id": rid},
                {"source_id": rid}
            ]},
            {"_id": 1, "transaction_id": 1, "source_module": 1, "entry_role": 1, 
             "transaction_type": 1, "amount": 1, "account_id": 1, "remarks": 1, "created_at": 1}
        ).to_list(50)
        
        # Categorize entries
        primary_entries = []
        counter_entries = []
        reversal_entries = []
        cashbook_duplicates = []
        
        for t in txns:
            remarks = (t.get("remarks") or "").lower()
            src = t.get("source_module", "")
            role = t.get("entry_role", "")
            
            # Identify reversal entries (from cancellation)
            if "reversal" in remarks or src == "receipt_cancellation":
                reversal_entries.append(t)
            # Identify primary entries (from receipts module)
            elif src == "receipts" and role != "counter":
                primary_entries.append(t)
            # Identify counter entries (from double-entry)
            elif role == "counter" or "[DE]" in (t.get("remarks") or ""):
                counter_entries.append(t)
            # Identify cashbook duplicates (from cashbook module, not linked properly)
            elif src == "cashbook":
                cashbook_duplicates.append(t)
            else:
                # Unknown - treat as primary if inflow, counter if outflow to customer_advance
                if t.get("transaction_type") == "inflow" and "acc_customer" not in (t.get("account_id") or ""):
                    primary_entries.append(t)
                else:
                    counter_entries.append(t)
        
        # Expected: 1 primary + 1 counter for active receipts
        # Cancelled receipts: 1 primary + 1 counter + 2 reversals = 4 total
        expected_count = 2 if status == "active" else 4
        actual_non_reversal = len(primary_entries) + len(counter_entries) + len(cashbook_duplicates)
        
        if actual_non_reversal > 2:
            print(f"\n{'='*50}")
            print(f"DUPLICATE FOUND: {rnum} ({rid})")
            print(f"Amount: {amt:,.0f} | Status: {status}")
            print(f"Entries: {len(primary_entries)} primary, {len(counter_entries)} counter, {len(cashbook_duplicates)} cashbook, {len(reversal_entries)} reversals")
            
            # Strategy: Keep oldest primary and oldest counter, delete the rest
            entries_to_delete = []
            
            # Sort by created_at and keep only the first primary
            if len(primary_entries) > 1:
                primary_entries.sort(key=lambda x: x.get("created_at", ""))
                for extra in primary_entries[1:]:
                    entries_to_delete.append(extra)
                    print(f"  DELETE: Extra primary {extra.get('transaction_id')}")
            
            # Sort by created_at and keep only the first counter
            if len(counter_entries) > 1:
                counter_entries.sort(key=lambda x: x.get("created_at", ""))
                for extra in counter_entries[1:]:
                    entries_to_delete.append(extra)
                    print(f"  DELETE: Extra counter {extra.get('transaction_id')}")
            
            # Delete all cashbook duplicates (these should not exist)
            for dup in cashbook_duplicates:
                entries_to_delete.append(dup)
                print(f"  DELETE: Cashbook duplicate {dup.get('transaction_id')}")
            
            # Perform deletion
            if not dry_run and entries_to_delete:
                for entry in entries_to_delete:
                    await db.accounting_transactions.delete_one({"_id": entry["_id"]})
                    entries_deleted += 1
                duplicates_fixed += 1
                print(f"  DELETED {len(entries_to_delete)} entries")
            elif entries_to_delete:
                print(f"  [DRY RUN] Would delete {len(entries_to_delete)} entries")
                duplicates_fixed += 1
                entries_deleted += len(entries_to_delete)
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Receipts with duplicates: {duplicates_fixed}")
    print(f"Entries {'would be ' if dry_run else ''}deleted: {entries_deleted}")
    
    if dry_run:
        print(f"\nTo apply changes, run: python {sys.argv[0]}")
    
    return duplicates_fixed, entries_deleted


async def main():
    dry_run = "--dry-run" in sys.argv or len(sys.argv) == 1
    
    if not dry_run:
        print("\n⚠️  WARNING: This will DELETE duplicate entries from the database!")
        confirm = input("Type 'yes' to proceed: ")
        if confirm.lower() != "yes":
            print("Aborted.")
            return
    
    await audit_and_cleanup_duplicates(dry_run=dry_run)


if __name__ == "__main__":
    asyncio.run(main())
