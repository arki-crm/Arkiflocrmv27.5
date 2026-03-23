#!/usr/bin/env python3
"""
ACCOUNTING DATA INTEGRITY DIAGNOSTIC AND FIX SCRIPT

This script:
1. Identifies ALL sources of imbalance in the accounting data
2. Finds missing counter entries (should have 2 entries per source_id)
3. Finds orphan entries (counter entries without primary)
4. Finds duplicate entries (same source_id with >2 entries)
5. Calculates the exact imbalance amount
6. Provides targeted fixes

Usage:
    python fix_historical_imbalance.py --diagnose    # Analyze only
    python fix_historical_imbalance.py --fix-missing # Create missing counter entries
    python fix_historical_imbalance.py --fix-orphans # Remove orphan entries
    python fix_historical_imbalance.py --fix-all     # Fix everything
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--diagnose"
    
    print("=" * 80)
    print("ACCOUNTING DATA INTEGRITY DIAGNOSTIC")
    print("=" * 80)
    
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db_name = os.environ.get("DB_NAME", "arkiflo_db")
    db = client[db_name]
    
    print(f"Database: {db_name}")
    print(f"Mode: {mode}")
    print()
    
    # ============ PHASE 1: GET ALL TRANSACTIONS ============
    all_txns = await db.accounting_transactions.find({}, {"_id": 0}).to_list(100000)
    print(f"Total transactions: {len(all_txns)}")
    
    # ============ PHASE 2: CALCULATE GLOBAL BALANCE ============
    total_inflows = sum(t.get("amount", 0) for t in all_txns if t.get("transaction_type") == "inflow")
    total_outflows = sum(t.get("amount", 0) for t in all_txns if t.get("transaction_type") == "outflow")
    imbalance = total_inflows - total_outflows
    
    print(f"\n=== GLOBAL BALANCE CHECK ===")
    print(f"Total Inflows (Debits):  ₹{total_inflows:,.2f}")
    print(f"Total Outflows (Credits): ₹{total_outflows:,.2f}")
    print(f"Imbalance:               ₹{imbalance:,.2f}")
    
    if abs(imbalance) < 0.01:
        print("✓ BALANCED!")
    else:
        print(f"✗ IMBALANCED by ₹{abs(imbalance):,.2f}")
    
    # ============ PHASE 3: GROUP BY SOURCE ============
    # Group transactions by their source (receipt_id, source_id, or reference_id)
    by_source = defaultdict(list)
    no_source = []
    
    for t in all_txns:
        source = t.get("receipt_id") or t.get("source_id") or t.get("reference_id")
        if source and source != t.get("transaction_id"):
            by_source[source].append(t)
        else:
            no_source.append(t)
    
    print(f"\n=== TRANSACTION GROUPING ===")
    print(f"Transactions with source_id: {sum(len(v) for v in by_source.values())}")
    print(f"Transactions without source_id: {len(no_source)}")
    
    # ============ PHASE 4: IDENTIFY PROBLEMS ============
    problems = {
        "missing_counter": [],      # Has primary but no counter (single entry)
        "missing_primary": [],      # Has counter but no primary (orphan)
        "duplicates": [],           # More than 2 entries for same source
        "unbalanced_pairs": [],     # Pair exists but amounts don't match
        "single_entry_legacy": [],  # Old entries without double-entry
    }
    
    print(f"\n=== ANALYZING {len(by_source)} SOURCE GROUPS ===")
    
    for source_id, entries in by_source.items():
        # Check entry count
        if len(entries) == 1:
            # Single entry - might be missing counter
            entry = entries[0]
            # Check if this is a primary entry that should have a counter
            if entry.get("entry_role") == "primary" or not entry.get("entry_role"):
                # Check if it's after double-entry start date
                txn_date = entry.get("transaction_date", entry.get("created_at", "2020-01-01"))[:10]
                if txn_date >= "2026-03-03":
                    problems["missing_counter"].append({
                        "source_id": source_id,
                        "entry": entry,
                        "amount": entry.get("amount", 0)
                    })
                else:
                    problems["single_entry_legacy"].append({
                        "source_id": source_id,
                        "entry": entry,
                        "amount": entry.get("amount", 0)
                    })
            elif entry.get("entry_role") == "counter":
                problems["missing_primary"].append({
                    "source_id": source_id,
                    "entry": entry,
                    "amount": entry.get("amount", 0)
                })
        
        elif len(entries) == 2:
            # Check if amounts match
            amounts = [e.get("amount", 0) for e in entries]
            if amounts[0] != amounts[1]:
                problems["unbalanced_pairs"].append({
                    "source_id": source_id,
                    "entries": entries,
                    "amounts": amounts
                })
            # Check if one is inflow and one is outflow
            types = [e.get("transaction_type") for e in entries]
            if types[0] == types[1]:
                problems["unbalanced_pairs"].append({
                    "source_id": source_id,
                    "entries": entries,
                    "issue": f"Both entries are {types[0]}"
                })
        
        elif len(entries) > 2:
            problems["duplicates"].append({
                "source_id": source_id,
                "count": len(entries),
                "entries": entries,
                "total_amount": sum(e.get("amount", 0) for e in entries)
            })
    
    # ============ PHASE 5: REPORT PROBLEMS ============
    print(f"\n=== PROBLEMS FOUND ===")
    print(f"Missing counter entries (post 2026-03-03): {len(problems['missing_counter'])}")
    print(f"Orphan counter entries (no primary): {len(problems['missing_primary'])}")
    print(f"Duplicate entries (>2 per source): {len(problems['duplicates'])}")
    print(f"Unbalanced pairs: {len(problems['unbalanced_pairs'])}")
    print(f"Single-entry legacy (pre 2026-03-03): {len(problems['single_entry_legacy'])}")
    
    # Calculate impact
    missing_counter_amount = sum(p["amount"] for p in problems["missing_counter"])
    orphan_amount = sum(p["amount"] for p in problems["missing_primary"])
    legacy_amount = sum(p["amount"] for p in problems["single_entry_legacy"])
    
    print(f"\n=== IMBALANCE BREAKDOWN ===")
    print(f"Missing counters contribute: ₹{missing_counter_amount:,.2f}")
    print(f"Orphan entries contribute: ₹{orphan_amount:,.2f}")
    print(f"Legacy single-entry contributes: ₹{legacy_amount:,.2f}")
    
    # ============ PHASE 6: DETAILED REPORTS ============
    if problems["missing_counter"]:
        print(f"\n=== MISSING COUNTER ENTRIES (Need to create) ===")
        for p in problems["missing_counter"][:10]:
            e = p["entry"]
            print(f"  {p['source_id']}: ₹{p['amount']:,.0f} from {e.get('source_module','?')} on {e.get('transaction_date','?')[:10]}")
        if len(problems["missing_counter"]) > 10:
            print(f"  ... and {len(problems['missing_counter']) - 10} more")
    
    if problems["duplicates"]:
        print(f"\n=== DUPLICATE ENTRIES (Need to cleanup) ===")
        for p in problems["duplicates"][:10]:
            print(f"  {p['source_id']}: {p['count']} entries, total ₹{p['total_amount']:,.0f}")
            for e in p["entries"]:
                print(f"    - {e['transaction_id']}: {e.get('entry_role','none')} {e.get('transaction_type')} ₹{e.get('amount',0):,.0f}")
        if len(problems["duplicates"]) > 10:
            print(f"  ... and {len(problems['duplicates']) - 10} more")
    
    if problems["missing_primary"]:
        print(f"\n=== ORPHAN COUNTER ENTRIES (Need to delete or link) ===")
        for p in problems["missing_primary"][:10]:
            e = p["entry"]
            print(f"  {p['source_id']}: ₹{p['amount']:,.0f} - {e.get('transaction_id')}")
    
    # ============ PHASE 7: FIXES ============
    if mode == "--diagnose":
        print("\n" + "=" * 80)
        print("DIAGNOSIS COMPLETE. Run with --fix-missing, --fix-orphans, or --fix-all to apply fixes.")
        return
    
    fixes_applied = 0
    
    if mode in ["--fix-missing", "--fix-all"]:
        print(f"\n=== CREATING MISSING COUNTER ENTRIES ===")
        for p in problems["missing_counter"]:
            entry = p["entry"]
            
            # Determine the counter account based on category
            category_id = entry.get("category_id", "")
            if category_id == "customer_payment":
                counter_account = {"account_id": "acc_customer_advance", "account_name": "Customer Advance", "account_type": "liability"}
            elif category_id == "liability_settlement":
                counter_account = {"account_id": "acc_accounts_payable", "account_name": "Accounts Payable", "account_type": "liability"}
            else:
                # Default to a general expense/income account
                if entry.get("transaction_type") == "outflow":
                    counter_account = {"account_id": "acc_general_expense", "account_name": "General Expense", "account_type": "expense"}
                else:
                    counter_account = {"account_id": "acc_general_income", "account_name": "General Income", "account_type": "income"}
            
            # Create counter entry
            counter_type = "outflow" if entry.get("transaction_type") == "inflow" else "inflow"
            counter_txn = {
                "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                "transaction_date": entry.get("transaction_date"),
                "transaction_type": counter_type,
                "amount": entry.get("amount"),
                "mode": "double_entry",
                "category_id": entry.get("category_id"),
                "account_id": counter_account["account_id"],
                "project_id": entry.get("project_id"),
                "remarks": f"[DE-FIX] Counter for {entry.get('remarks', '')}",
                "party_id": entry.get("party_id"),
                "party_type": entry.get("party_type"),
                "party_name": entry.get("party_name"),
                "is_double_entry": True,
                "paired_transaction_id": entry.get("transaction_id"),
                "reference_id": p["source_id"],
                "source_id": p["source_id"],
                "entry_role": "counter",
                "source_module": entry.get("source_module", "data_fix"),
                "is_system_generated": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system_fix_script",
                "created_by_name": "Data Integrity Fix",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.accounting_transactions.insert_one(counter_txn)
            
            # Update the primary entry to mark it has a counter
            await db.accounting_transactions.update_one(
                {"transaction_id": entry.get("transaction_id")},
                {"$set": {
                    "entry_role": "primary",
                    "is_double_entry": True,
                    "paired_transaction_id": counter_txn["transaction_id"]
                }}
            )
            
            fixes_applied += 1
            print(f"  Created counter for {p['source_id']}: ₹{entry.get('amount'):,.0f}")
        
        print(f"Created {fixes_applied} missing counter entries")
    
    if mode in ["--fix-orphans", "--fix-all"]:
        print(f"\n=== REMOVING ORPHAN ENTRIES ===")
        orphans_removed = 0
        for p in problems["missing_primary"]:
            await db.accounting_transactions.delete_one({"transaction_id": p["entry"].get("transaction_id")})
            orphans_removed += 1
            print(f"  Removed orphan: {p['entry'].get('transaction_id')}")
        print(f"Removed {orphans_removed} orphan entries")
        fixes_applied += orphans_removed
    
    if mode == "--fix-all" and problems["duplicates"]:
        print(f"\n=== CLEANING UP DUPLICATES ===")
        dups_removed = 0
        for p in problems["duplicates"]:
            entries = p["entries"]
            # Keep the first primary and first counter, delete the rest
            primary = next((e for e in entries if e.get("entry_role") == "primary"), entries[0])
            counter = next((e for e in entries if e.get("entry_role") == "counter"), None)
            
            keep_ids = {primary.get("transaction_id")}
            if counter:
                keep_ids.add(counter.get("transaction_id"))
            
            for e in entries:
                if e.get("transaction_id") not in keep_ids:
                    await db.accounting_transactions.delete_one({"transaction_id": e.get("transaction_id")})
                    dups_removed += 1
                    print(f"  Removed duplicate: {e.get('transaction_id')}")
        
        print(f"Removed {dups_removed} duplicate entries")
        fixes_applied += dups_removed
    
    # ============ PHASE 8: VERIFY FIX ============
    if fixes_applied > 0:
        print(f"\n=== VERIFYING FIX ===")
        all_txns_after = await db.accounting_transactions.find({}, {"_id": 0}).to_list(100000)
        total_inflows_after = sum(t.get("amount", 0) for t in all_txns_after if t.get("transaction_type") == "inflow")
        total_outflows_after = sum(t.get("amount", 0) for t in all_txns_after if t.get("transaction_type") == "outflow")
        imbalance_after = total_inflows_after - total_outflows_after
        
        print(f"Before fix: ₹{imbalance:,.2f} imbalance")
        print(f"After fix:  ₹{imbalance_after:,.2f} imbalance")
        print(f"Improvement: ₹{abs(imbalance) - abs(imbalance_after):,.2f}")
        
        # Log the fix
        await db.accounting_audit_log.insert_one({
            "action": "data_integrity_fix",
            "fixes_applied": fixes_applied,
            "imbalance_before": imbalance,
            "imbalance_after": imbalance_after,
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "executed_by": "system_fix_script"
        })

if __name__ == "__main__":
    asyncio.run(main())
