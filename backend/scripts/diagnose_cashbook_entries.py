#!/usr/bin/env python3
"""
Diagnostic script to analyze cashbook entries in production.
Shows all cashbook entries and their categories to identify duplicates.
"""

import asyncio
import os
import sys
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    print("=" * 70)
    print("CASHBOOK ENTRIES DIAGNOSTIC")
    print("=" * 70)
    
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db_name = os.environ.get("DB_NAME", "arkiflo_db")
    db = client[db_name]
    
    print(f"Database: {db_name}")
    print()
    
    # 1. Get ALL cashbook entries (any source_module containing 'cashbook' or missing)
    print("=== ALL ENTRIES BY SOURCE_MODULE ===")
    all_txns = await db.accounting_transactions.find({}, {"_id": 0}).to_list(10000)
    print(f"Total transactions: {len(all_txns)}")
    
    by_source = defaultdict(int)
    for t in all_txns:
        src = t.get("source_module")
        if src is None:
            by_source["<None/Missing>"] += 1
        elif src == "":
            by_source["<Empty String>"] += 1
        else:
            by_source[src] += 1
    
    print("\nBy source_module:")
    for src, count in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  {src}: {count}")
    
    # 2. Find cashbook entries specifically
    print("\n=== CASHBOOK ENTRIES ANALYSIS ===")
    cashbook_entries = [t for t in all_txns if t.get("source_module") == "cashbook"]
    print(f"Entries with source_module='cashbook': {len(cashbook_entries)}")
    
    # Group by category_id
    cb_by_category = defaultdict(list)
    for t in cashbook_entries:
        cat = t.get("category_id")
        if cat is None:
            cb_by_category["<None>"].append(t)
        elif cat == "":
            cb_by_category["<Empty>"].append(t)
        else:
            cb_by_category[cat].append(t)
    
    print("\nCashbook entries by category_id:")
    for cat, entries in sorted(cb_by_category.items(), key=lambda x: -len(x[1])):
        total_amt = sum(e.get("amount", 0) for e in entries)
        print(f"  {cat}: {len(entries)} entries, total ₹{total_amt:,.0f}")
    
    # 3. Find entries that might be customer payment duplicates
    print("\n=== POTENTIAL DUPLICATE CUSTOMER PAYMENT ENTRIES ===")
    
    # Check for inflow entries that might be customer payments
    inflow_entries = [t for t in cashbook_entries if t.get("transaction_type") == "inflow"]
    print(f"Cashbook INFLOW entries: {len(inflow_entries)}")
    
    # Show sample of inflow entries
    print("\nSample cashbook inflow entries:")
    for t in inflow_entries[:10]:
        print(f"  {t.get('transaction_id')}: cat={t.get('category_id')} amt=₹{t.get('amount', 0):,.0f} date={t.get('transaction_date', t.get('created_at', '?'))[:10]}")
        if t.get('project_id'):
            print(f"    project_id: {t.get('project_id')}")
        if t.get('remarks'):
            print(f"    remarks: {t.get('remarks', '')[:50]}")
    
    # 4. Find ALL entries related to customer payments (by remarks or other indicators)
    print("\n=== ENTRIES THAT LOOK LIKE CUSTOMER PAYMENTS ===")
    potential_receipts = []
    for t in all_txns:
        remarks = (t.get("remarks") or "").lower()
        category = (t.get("category_id") or "").lower()
        if any(x in remarks for x in ["receipt", "payment", "customer", "advance", "booking"]):
            potential_receipts.append(t)
        elif any(x in category for x in ["customer", "payment", "receipt", "advance"]):
            potential_receipts.append(t)
        elif t.get("transaction_type") == "inflow" and t.get("project_id") and t.get("source_module") != "receipts":
            potential_receipts.append(t)
    
    print(f"Potential customer payment entries (non-receipts source): {len(potential_receipts)}")
    
    by_src = defaultdict(int)
    for t in potential_receipts:
        by_src[t.get("source_module", "<None>")] += 1
    print(f"By source: {dict(by_src)}")
    
    # 5. Show what receipts module entries look like
    print("\n=== RECEIPTS MODULE ENTRIES (REFERENCE) ===")
    receipts_entries = [t for t in all_txns if t.get("source_module") == "receipts"]
    print(f"Entries from receipts module: {len(receipts_entries)}")
    if receipts_entries:
        sample = receipts_entries[0]
        print(f"Sample entry keys: {list(sample.keys())}")
        print(f"Sample category_id: {sample.get('category_id')}")
    
    # 6. Find entries with missing source_module that have project_id (likely old receipts)
    print("\n=== LEGACY ENTRIES (NO SOURCE_MODULE) WITH PROJECT_ID ===")
    legacy_with_project = [t for t in all_txns if not t.get("source_module") and t.get("project_id") and t.get("transaction_type") == "inflow"]
    print(f"Found: {len(legacy_with_project)}")
    for t in legacy_with_project[:5]:
        print(f"  {t.get('transaction_id')}: cat={t.get('category_id')} amt=₹{t.get('amount', 0):,.0f} proj={t.get('project_id')[:15] if t.get('project_id') else 'N/A'}")

asyncio.run(main())
