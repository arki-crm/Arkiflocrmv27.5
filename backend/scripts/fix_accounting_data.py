#!/usr/bin/env python3
"""
TARGETED FIX SCRIPT FOR ACCOUNTING DATA INTEGRITY

Based on the diagnostic results, this script will:
1. Remove orphan counter entries (29 entries)
2. Remove duplicate entries from receipts (keep 2 per source)
3. Fix unbalanced execution cost pairs

Run with:
    python fix_accounting_data.py --dry-run    # Preview only
    python fix_accounting_data.py --execute    # Apply fixes
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    dry_run = "--dry-run" in sys.argv or "--execute" not in sys.argv
    
    print("=" * 80)
    print("TARGETED ACCOUNTING DATA FIX")
    print("=" * 80)
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    print()
    
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db_name = os.environ.get("DB_NAME", "arkiflo_db")
    db = client[db_name]
    
    print(f"Database: {db_name}")
    
    # Get all transactions
    all_txns = await db.accounting_transactions.find({}, {"_id": 0}).to_list(100000)
    print(f"Total transactions: {len(all_txns)}")
    
    # Calculate initial imbalance
    initial_inflows = sum(t.get("amount", 0) for t in all_txns if t.get("transaction_type") == "inflow")
    initial_outflows = sum(t.get("amount", 0) for t in all_txns if t.get("transaction_type") == "outflow")
    initial_imbalance = initial_inflows - initial_outflows
    print(f"Initial imbalance: ₹{initial_imbalance:,.2f}")
    
    # Group by source_id
    by_source = defaultdict(list)
    for t in all_txns:
        source = t.get("receipt_id") or t.get("source_id") or t.get("reference_id")
        if source and source != t.get("transaction_id"):
            by_source[source].append(t)
    
    fixes = []
    
    # ============ FIX 1: ORPHAN COUNTER ENTRIES ============
    print("\n=== FIX 1: ORPHAN COUNTER ENTRIES ===")
    orphans_to_delete = []
    
    for source_id, entries in by_source.items():
        if len(entries) == 1:
            entry = entries[0]
            # Orphan counter = counter entry without primary
            if entry.get("entry_role") == "counter":
                orphans_to_delete.append({
                    "transaction_id": entry.get("transaction_id"),
                    "source_id": source_id,
                    "amount": entry.get("amount"),
                    "type": entry.get("transaction_type")
                })
    
    print(f"Found {len(orphans_to_delete)} orphan counter entries")
    orphan_amount = sum(o["amount"] for o in orphans_to_delete)
    print(f"Total orphan amount: ₹{orphan_amount:,.2f}")
    
    if orphans_to_delete:
        print("\nOrphan entries to delete:")
        for o in orphans_to_delete[:10]:
            print(f"  {o['transaction_id']}: ₹{o['amount']:,.0f} ({o['type']})")
        if len(orphans_to_delete) > 10:
            print(f"  ... and {len(orphans_to_delete) - 10} more")
    
    # ============ FIX 2: DUPLICATE ENTRIES ============
    print("\n=== FIX 2: DUPLICATE ENTRIES ===")
    duplicates_to_delete = []
    
    for source_id, entries in by_source.items():
        if len(entries) > 2:
            # Keep first primary and first counter
            primary = None
            counter = None
            extras = []
            
            for e in entries:
                role = e.get("entry_role", "primary")
                if role == "primary" and primary is None:
                    primary = e
                elif role == "counter" and counter is None:
                    counter = e
                else:
                    extras.append(e)
            
            # If no explicit roles, keep first 2
            if primary is None:
                primary = entries[0]
                extras = [e for e in entries[1:] if e.get("transaction_id") != (counter.get("transaction_id") if counter else None)]
            
            for e in extras:
                duplicates_to_delete.append({
                    "transaction_id": e.get("transaction_id"),
                    "source_id": source_id,
                    "amount": e.get("amount"),
                    "type": e.get("transaction_type")
                })
    
    print(f"Found {len(duplicates_to_delete)} duplicate entries to remove")
    dup_amount = sum(d["amount"] for d in duplicates_to_delete)
    print(f"Total duplicate amount: ₹{dup_amount:,.2f}")
    
    if duplicates_to_delete:
        print("\nDuplicate entries to delete:")
        for d in duplicates_to_delete:
            print(f"  {d['transaction_id']}: source={d['source_id'][:15]} ₹{d['amount']:,.0f} ({d['type']})")
    
    # ============ FIX 3: UNBALANCED PAIRS (exec_* entries) ============
    print("\n=== FIX 3: UNBALANCED EXECUTION COST PAIRS ===")
    unbalanced_fixes = []
    
    for source_id, entries in by_source.items():
        if source_id.startswith("exec_") and len(entries) == 2:
            amounts = [e.get("amount", 0) for e in entries]
            types = [e.get("transaction_type") for e in entries]
            
            # Both are outflow = wrong
            if types[0] == types[1]:
                # The counter should be inflow (to balance)
                # Find the one marked as counter (or the second one)
                for e in entries:
                    if e.get("entry_role") == "counter" or e == entries[1]:
                        unbalanced_fixes.append({
                            "transaction_id": e.get("transaction_id"),
                            "source_id": source_id,
                            "current_type": e.get("transaction_type"),
                            "fix_type": "inflow" if e.get("transaction_type") == "outflow" else "outflow"
                        })
                        break
    
    print(f"Found {len(unbalanced_fixes)} unbalanced pairs to fix")
    
    if unbalanced_fixes:
        print("\nUnbalanced pairs to fix:")
        for u in unbalanced_fixes:
            print(f"  {u['transaction_id']}: {u['current_type']} → {u['fix_type']}")
    
    # ============ SUMMARY ============
    print("\n" + "=" * 80)
    print("SUMMARY OF FIXES")
    print("=" * 80)
    print(f"Orphan entries to delete: {len(orphans_to_delete)}")
    print(f"Duplicate entries to delete: {len(duplicates_to_delete)}")
    print(f"Unbalanced pairs to fix: {len(unbalanced_fixes)}")
    
    # Calculate expected impact
    # Orphans are counter entries (outflows for inflows, inflows for outflows)
    # Deleting them will affect the balance
    expected_change = 0
    for o in orphans_to_delete:
        if o["type"] == "outflow":
            expected_change += o["amount"]  # Removing outflow increases balance
        else:
            expected_change -= o["amount"]  # Removing inflow decreases balance
    
    for d in duplicates_to_delete:
        if d["type"] == "outflow":
            expected_change += d["amount"]
        else:
            expected_change -= d["amount"]
    
    print(f"\nExpected balance change: ₹{expected_change:,.2f}")
    print(f"Current imbalance: ₹{initial_imbalance:,.2f}")
    print(f"Expected new imbalance: ₹{initial_imbalance - expected_change:,.2f}")
    
    # ============ EXECUTE FIXES ============
    if dry_run:
        print("\n" + "=" * 80)
        print("DRY RUN COMPLETE. Run with --execute to apply fixes.")
        return
    
    print("\n" + "=" * 80)
    print("EXECUTING FIXES...")
    print("=" * 80)
    
    # Delete orphans
    deleted_orphans = 0
    for o in orphans_to_delete:
        await db.accounting_transactions.delete_one({"transaction_id": o["transaction_id"]})
        deleted_orphans += 1
    print(f"Deleted {deleted_orphans} orphan entries")
    
    # Delete duplicates
    deleted_dups = 0
    for d in duplicates_to_delete:
        await db.accounting_transactions.delete_one({"transaction_id": d["transaction_id"]})
        deleted_dups += 1
    print(f"Deleted {deleted_dups} duplicate entries")
    
    # Fix unbalanced pairs
    fixed_pairs = 0
    for u in unbalanced_fixes:
        await db.accounting_transactions.update_one(
            {"transaction_id": u["transaction_id"]},
            {"$set": {"transaction_type": u["fix_type"]}}
        )
        fixed_pairs += 1
    print(f"Fixed {fixed_pairs} unbalanced pairs")
    
    # Verify
    all_txns_after = await db.accounting_transactions.find({}, {"_id": 0}).to_list(100000)
    final_inflows = sum(t.get("amount", 0) for t in all_txns_after if t.get("transaction_type") == "inflow")
    final_outflows = sum(t.get("amount", 0) for t in all_txns_after if t.get("transaction_type") == "outflow")
    final_imbalance = final_inflows - final_outflows
    
    print("\n" + "=" * 80)
    print("VERIFICATION")
    print("=" * 80)
    print(f"Transactions before: {len(all_txns)}")
    print(f"Transactions after: {len(all_txns_after)}")
    print(f"Initial imbalance: ₹{initial_imbalance:,.2f}")
    print(f"Final imbalance: ₹{final_imbalance:,.2f}")
    print(f"Improvement: ₹{abs(initial_imbalance) - abs(final_imbalance):,.2f}")
    
    # Log
    await db.accounting_audit_log.insert_one({
        "action": "data_integrity_fix",
        "orphans_deleted": deleted_orphans,
        "duplicates_deleted": deleted_dups,
        "pairs_fixed": fixed_pairs,
        "initial_imbalance": initial_imbalance,
        "final_imbalance": final_imbalance,
        "executed_at": datetime.now(timezone.utc).isoformat()
    })

if __name__ == "__main__":
    asyncio.run(main())
