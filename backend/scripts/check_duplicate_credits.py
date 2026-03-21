#!/usr/bin/env python3
"""
Check for Duplicate and Orphan Credit Entries

This script identifies:
1. Orphan counter entries (no matching primary)
2. Duplicate credit entries for the same receipt
3. Cashbook customer_payment entries that duplicate receipts
4. Receipts with more than 2 entries

Run with: python3 check_duplicate_credits.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# UPDATE THIS TO YOUR ACTUAL DATABASE NAME
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "arkiflo_db"  # <-- CHANGE THIS TO YOUR DB NAME

async def check_duplicates():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"{'='*70}")
    print(f"DUPLICATE & ORPHAN CREDIT ENTRY AUDIT")
    print(f"Database: {DB_NAME}")
    print(f"{'='*70}\n")
    
    # ============================================================
    # 1. Find ALL counter entries and check if they have matching primary
    # ============================================================
    print("=" * 50)
    print("1. ORPHAN COUNTER ENTRIES (no matching primary)")
    print("=" * 50)
    
    counter_entries = await db.accounting_transactions.find(
        {"entry_role": "counter"},
        {"_id": 1, "transaction_id": 1, "paired_transaction_id": 1, "linked_transaction_id": 1,
         "amount": 1, "account_id": 1, "remarks": 1, "source_module": 1, "created_at": 1}
    ).to_list(5000)
    
    orphan_counters = []
    for counter in counter_entries:
        paired_id = counter.get("paired_transaction_id") or counter.get("linked_transaction_id")
        if paired_id:
            # Check if primary exists
            primary = await db.accounting_transactions.find_one({"transaction_id": paired_id})
            if not primary:
                orphan_counters.append(counter)
        else:
            # No paired ID - definitely orphan
            orphan_counters.append(counter)
    
    print(f"Total counter entries: {len(counter_entries)}")
    print(f"Orphan counters (no primary): {len(orphan_counters)}")
    
    if orphan_counters:
        print("\nOrphan counter entries:")
        for o in orphan_counters[:20]:
            print(f"  {o.get('transaction_id', '')[:15]} | {o.get('source_module', 'N/A'):12} | "
                  f"{o.get('account_id', '')[:20]:20} | {o.get('amount', 0):>12,.0f} | "
                  f"{(o.get('remarks') or '')[:30]}")
        if len(orphan_counters) > 20:
            print(f"  ... and {len(orphan_counters) - 20} more")
    
    # ============================================================
    # 2. Find cashbook entries with customer_payment category
    # ============================================================
    print("\n" + "=" * 50)
    print("2. CASHBOOK CUSTOMER_PAYMENT ENTRIES")
    print("=" * 50)
    
    cashbook_customer = await db.accounting_transactions.find({
        "source_module": "cashbook",
        "$or": [
            {"category_id": "customer_payment"},
            {"category_id": "customer_advance"}
        ]
    }, {"_id": 1, "transaction_id": 1, "entry_role": 1, "transaction_type": 1,
        "amount": 1, "account_id": 1, "remarks": 1, "receipt_id": 1}).to_list(1000)
    
    # Separate primary and counter
    cashbook_primary = [c for c in cashbook_customer if c.get("entry_role") != "counter"]
    cashbook_counter = [c for c in cashbook_customer if c.get("entry_role") == "counter"]
    
    print(f"Cashbook customer_payment entries: {len(cashbook_customer)}")
    print(f"  - Primary entries: {len(cashbook_primary)}")
    print(f"  - Counter entries: {len(cashbook_counter)}")
    
    # Check if any are linked to receipts
    linked_to_receipt = [c for c in cashbook_customer if c.get("receipt_id")]
    print(f"  - Linked to receipts: {len(linked_to_receipt)}")
    print(f"  - NOT linked to receipts (potential duplicates): {len(cashbook_customer) - len(linked_to_receipt)}")
    
    if cashbook_counter:
        print("\nCashbook counter entries (these may be duplicates):")
        for c in cashbook_counter[:15]:
            print(f"  {c.get('transaction_id', '')[:15]} | {c.get('account_id', '')[:20]:20} | "
                  f"{c.get('transaction_type', ''):7} | {c.get('amount', 0):>12,.0f} | "
                  f"{(c.get('remarks') or '')[:30]}")
        if len(cashbook_counter) > 15:
            print(f"  ... and {len(cashbook_counter) - 15} more")
    
    # ============================================================
    # 3. Find receipts with more than 2 entries
    # ============================================================
    print("\n" + "=" * 50)
    print("3. RECEIPTS WITH MORE THAN 2 ENTRIES")
    print("=" * 50)
    
    receipts = await db.finance_receipts.find({}, 
        {"_id": 0, "receipt_id": 1, "receipt_number": 1, "amount": 1, "status": 1}).to_list(5000)
    
    print(f"Total receipts: {len(receipts)}")
    
    receipts_with_issues = []
    for receipt in receipts:
        rid = receipt.get("receipt_id")
        
        # Count entries for this receipt
        entries = await db.accounting_transactions.find(
            {"$or": [
                {"receipt_id": rid},
                {"reference_id": rid},
                {"source_id": rid}
            ]},
            {"_id": 1, "transaction_id": 1, "entry_role": 1, "transaction_type": 1,
             "source_module": 1, "amount": 1, "remarks": 1}
        ).to_list(50)
        
        # Exclude reversal entries for cancelled receipts
        non_reversal = [e for e in entries if "reversal" not in (e.get("remarks") or "").lower()]
        
        if len(non_reversal) > 2:
            receipt["entries"] = non_reversal
            receipt["entry_count"] = len(non_reversal)
            receipts_with_issues.append(receipt)
    
    print(f"Receipts with more than 2 entries: {len(receipts_with_issues)}")
    
    if receipts_with_issues:
        print("\nReceipts with duplicate entries:")
        for r in receipts_with_issues[:10]:
            print(f"\n  {r.get('receipt_number')} ({r.get('receipt_id')}) - Amount: {r.get('amount', 0):,.0f}")
            print(f"  Status: {r.get('status', 'N/A')} | Entry count: {r.get('entry_count')}")
            for e in r.get("entries", []):
                role = e.get("entry_role", "-")
                src = e.get("source_module", "N/A")
                ttype = e.get("transaction_type", "N/A")
                print(f"    - {e.get('transaction_id', '')[:15]} | {src:10} | {role:8} | {ttype:7}")
        if len(receipts_with_issues) > 10:
            print(f"\n  ... and {len(receipts_with_issues) - 10} more receipts with issues")
    
    # ============================================================
    # 4. Check for duplicate credits to Customer Advance
    # ============================================================
    print("\n" + "=" * 50)
    print("4. CUSTOMER ADVANCE CREDITS (potential duplicates)")
    print("=" * 50)
    
    customer_advance_credits = await db.accounting_transactions.find({
        "account_id": {"$in": ["acc_customer_advance", "customer_advance", "acc_customer_adv"]},
        "transaction_type": "outflow"  # Credit to liability
    }, {"_id": 1, "transaction_id": 1, "source_module": 1, "entry_role": 1,
        "amount": 1, "remarks": 1, "receipt_id": 1, "reference_id": 1}).to_list(5000)
    
    print(f"Total Customer Advance credits: {len(customer_advance_credits)}")
    
    # Group by source module
    by_source = {}
    for c in customer_advance_credits:
        src = c.get("source_module", "unknown")
        by_source[src] = by_source.get(src, 0) + 1
    
    print("\nBy source module:")
    for src, count in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  {src}: {count}")
    
    # Find potential duplicates (same amount, similar time)
    print("\n" + "=" * 50)
    print("5. SUMMARY & RECOMMENDATIONS")
    print("=" * 50)
    
    total_issues = len(orphan_counters) + len(cashbook_counter) + len(receipts_with_issues)
    
    print(f"\nTotal potential issues found: {total_issues}")
    print(f"  - Orphan counter entries: {len(orphan_counters)}")
    print(f"  - Cashbook customer_payment counters: {len(cashbook_counter)}")
    print(f"  - Receipts with >2 entries: {len(receipts_with_issues)}")
    
    if total_issues > 0:
        print("\n⚠️  RECOMMENDED ACTIONS:")
        if orphan_counters:
            print("  1. Review and delete orphan counter entries")
        if cashbook_counter:
            print("  2. Delete cashbook customer_payment counter entries (duplicates of receipts)")
        if receipts_with_issues:
            print("  3. Clean up receipts with extra entries")
    else:
        print("\n✅ No duplicate issues found!")
    
    return {
        "orphan_counters": len(orphan_counters),
        "cashbook_counters": len(cashbook_counter),
        "receipts_with_issues": len(receipts_with_issues)
    }


if __name__ == "__main__":
    asyncio.run(check_duplicates())
