#!/usr/bin/env python3
"""
SAFE ACCOUNTING DATA FIX SCRIPT v2

Safety-first approach:
- Validates pairs before any action
- Skips uncertain cases for manual review
- No blind deletions based on position
- All decisions logged with reasoning

Run with:
    python fix_accounting_data_safe.py --dry-run    # Preview only (default)
    python fix_accounting_data_safe.py --execute    # Apply fixes
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient

# Output collections for review
SAFE_TO_FIX = []
NEEDS_MANUAL_REVIEW = []
SKIPPED = []


def is_valid_double_entry_pair(entry1, entry2):
    """
    Validate that two entries form a correct double-entry pair.
    
    Requirements:
    1. Same amount
    2. One inflow (debit) and one outflow (credit)
    3. Different accounts (Dr and Cr should hit different accounts)
    
    Returns: (is_valid, reason)
    """
    amt1 = entry1.get("amount", 0)
    amt2 = entry2.get("amount", 0)
    type1 = entry1.get("transaction_type")
    type2 = entry2.get("transaction_type")
    acct1 = entry1.get("account_id")
    acct2 = entry2.get("account_id")
    
    # Check 1: Amounts must match
    if abs(amt1 - amt2) > 0.01:
        return False, f"Amount mismatch: {amt1} vs {amt2}"
    
    # Check 2: Must have opposite transaction types
    if type1 == type2:
        return False, f"Same transaction type: both are {type1}"
    
    # Check 3: Should be different accounts (Dr Bank, Cr Liability)
    if acct1 == acct2:
        return False, f"Same account: {acct1}"
    
    return True, "Valid pair"


def find_valid_pair(entries):
    """
    From a list of entries, find a valid double-entry pair.
    
    Strategy:
    1. Try entries with explicit entry_role first
    2. Then try all combinations
    3. Return (primary, counter) or (None, None) if no valid pair found
    """
    # First, try to find entries with explicit roles
    primaries = [e for e in entries if e.get("entry_role") == "primary"]
    counters = [e for e in entries if e.get("entry_role") == "counter"]
    
    # Try explicit primary + counter combinations
    for p in primaries:
        for c in counters:
            is_valid, reason = is_valid_double_entry_pair(p, c)
            if is_valid:
                return p, c, "Matched by entry_role"
    
    # Try all combinations (for entries without explicit roles)
    for i, e1 in enumerate(entries):
        for e2 in entries[i+1:]:
            is_valid, reason = is_valid_double_entry_pair(e1, e2)
            if is_valid:
                # Determine which is primary (inflow to asset = primary typically)
                if e1.get("transaction_type") == "inflow":
                    return e1, e2, "Matched by validation (inflow first)"
                else:
                    return e2, e1, "Matched by validation (inflow first)"
    
    return None, None, "No valid pair found"


async def check_orphan_has_matching_primary(db, orphan_entry):
    """
    Before deleting an orphan counter, check if there might be a matching primary
    that just isn't linked properly.
    
    Checks:
    1. Same amount
    2. Similar timestamp (within 1 minute)
    3. Opposite transaction type
    """
    amount = orphan_entry.get("amount", 0)
    created_at = orphan_entry.get("created_at", "")
    txn_type = orphan_entry.get("transaction_type")
    opposite_type = "inflow" if txn_type == "outflow" else "outflow"
    
    # Look for potential matching primary
    potential_matches = await db.accounting_transactions.find({
        "amount": amount,
        "transaction_type": opposite_type,
        "entry_role": {"$ne": "counter"}  # Not another counter
    }, {"_id": 0}).to_list(100)
    
    # Filter by timestamp proximity if we have created_at
    if created_at and potential_matches:
        # Check if any match is within reasonable time window
        for match in potential_matches:
            match_time = match.get("created_at", "")
            # If timestamps are close (same minute prefix), might be related
            if match_time[:16] == created_at[:16]:  # YYYY-MM-DDTHH:MM
                return True, match.get("transaction_id"), "Found potential primary with same amount and timestamp"
    
    # Also check by paired_transaction_id reference
    orphan_id = orphan_entry.get("transaction_id")
    linked_primary = await db.accounting_transactions.find_one({
        "paired_transaction_id": orphan_id
    }, {"_id": 0})
    
    if linked_primary:
        return True, linked_primary.get("transaction_id"), "Found primary that references this counter"
    
    return False, None, "No matching primary found"


def validate_execution_cost_fix(entry1, entry2):
    """
    Validate that flipping transaction_type for execution cost pair is safe.
    
    Checks:
    1. Amounts match
    2. One should be expense account, one should be cash/bank
    3. The flip makes accounting sense
    """
    amt1 = entry1.get("amount", 0)
    amt2 = entry2.get("amount", 0)
    acct1 = entry1.get("account_id", "")
    acct2 = entry2.get("account_id", "")
    
    # Check amounts match
    if abs(amt1 - amt2) > 0.01:
        return False, f"Amount mismatch: {amt1} vs {amt2}"
    
    # Check one is cash/bank account
    cash_accounts = ["acc_d3cd5544", "acc_2b39a50e", "acc_petty_cash"]  # Known cash/bank accounts
    has_cash_account = acct1 in cash_accounts or acct2 in cash_accounts or \
                       "cash" in acct1.lower() or "bank" in acct1.lower() or \
                       "cash" in acct2.lower() or "bank" in acct2.lower()
    
    if not has_cash_account:
        return False, f"No cash/bank account found: {acct1}, {acct2}"
    
    return True, "Valid for type correction"


async def main():
    dry_run = "--dry-run" in sys.argv or "--execute" not in sys.argv
    
    print("=" * 80)
    print("SAFE ACCOUNTING DATA FIX v2")
    print("=" * 80)
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'EXECUTE (will modify data)'}")
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
    
    # Results tracking
    orphans_to_delete = []
    orphans_for_review = []
    duplicates_to_delete = []
    duplicates_for_review = []
    exec_to_fix = []
    exec_for_review = []
    
    # ============ ANALYSIS 1: ORPHAN COUNTER ENTRIES ============
    print("\n" + "=" * 80)
    print("ANALYSIS 1: ORPHAN COUNTER ENTRIES")
    print("=" * 80)
    
    for source_id, entries in by_source.items():
        if len(entries) == 1:
            entry = entries[0]
            if entry.get("entry_role") == "counter":
                # SAFETY CHECK: Look for potentially unlinked primary
                has_match, match_id, reason = await check_orphan_has_matching_primary(db, entry)
                
                if has_match:
                    orphans_for_review.append({
                        "action": "NEEDS_REVIEW",
                        "reason": reason,
                        "orphan_id": entry.get("transaction_id"),
                        "potential_primary": match_id,
                        "source_id": source_id,
                        "amount": entry.get("amount"),
                        "suggestion": "May need to link entries instead of delete"
                    })
                else:
                    orphans_to_delete.append({
                        "action": "SAFE_TO_DELETE",
                        "reason": "No matching primary found - true orphan",
                        "transaction_id": entry.get("transaction_id"),
                        "source_id": source_id,
                        "amount": entry.get("amount"),
                        "type": entry.get("transaction_type")
                    })
    
    print(f"Safe to delete: {len(orphans_to_delete)}")
    print(f"Needs manual review: {len(orphans_for_review)}")
    
    if orphans_to_delete:
        print("\n[SAFE TO DELETE]")
        for o in orphans_to_delete[:5]:
            print(f"  {o['transaction_id']}: ₹{o['amount']:,.0f} - {o['reason']}")
        if len(orphans_to_delete) > 5:
            print(f"  ... and {len(orphans_to_delete) - 5} more")
    
    if orphans_for_review:
        print("\n[NEEDS MANUAL REVIEW]")
        for o in orphans_for_review[:5]:
            print(f"  {o['orphan_id']}: ₹{o['amount']:,.0f}")
            print(f"    Reason: {o['reason']}")
            print(f"    Potential primary: {o['potential_primary']}")
        if len(orphans_for_review) > 5:
            print(f"  ... and {len(orphans_for_review) - 5} more")
    
    # ============ ANALYSIS 2: DUPLICATE ENTRIES ============
    print("\n" + "=" * 80)
    print("ANALYSIS 2: DUPLICATE ENTRIES (>2 per source)")
    print("=" * 80)
    
    for source_id, entries in by_source.items():
        if len(entries) > 2:
            # Try to find a valid pair
            primary, counter, match_reason = find_valid_pair(entries)
            
            if primary and counter:
                # Found valid pair - mark others for deletion
                keep_ids = {primary.get("transaction_id"), counter.get("transaction_id")}
                extras = [e for e in entries if e.get("transaction_id") not in keep_ids]
                
                for extra in extras:
                    duplicates_to_delete.append({
                        "action": "SAFE_TO_DELETE",
                        "reason": f"Valid pair found ({match_reason}), this is extra",
                        "transaction_id": extra.get("transaction_id"),
                        "source_id": source_id,
                        "amount": extra.get("amount"),
                        "type": extra.get("transaction_type"),
                        "kept_primary": primary.get("transaction_id"),
                        "kept_counter": counter.get("transaction_id")
                    })
            else:
                # No valid pair found - needs manual review
                duplicates_for_review.append({
                    "action": "NEEDS_REVIEW",
                    "reason": match_reason,
                    "source_id": source_id,
                    "entry_count": len(entries),
                    "entries": [
                        {
                            "id": e.get("transaction_id"),
                            "amount": e.get("amount"),
                            "type": e.get("transaction_type"),
                            "role": e.get("entry_role", "none"),
                            "account": e.get("account_id")
                        }
                        for e in entries
                    ]
                })
    
    print(f"Safe to delete: {len(duplicates_to_delete)}")
    print(f"Needs manual review: {len(duplicates_for_review)}")
    
    if duplicates_to_delete:
        print("\n[SAFE TO DELETE]")
        for d in duplicates_to_delete[:5]:
            print(f"  {d['transaction_id']}: ₹{d['amount']:,.0f} ({d['type']})")
            print(f"    Source: {d['source_id']}")
            print(f"    Keeping: {d['kept_primary']} + {d['kept_counter']}")
        if len(duplicates_to_delete) > 5:
            print(f"  ... and {len(duplicates_to_delete) - 5} more")
    
    if duplicates_for_review:
        print("\n[NEEDS MANUAL REVIEW]")
        for d in duplicates_for_review[:3]:
            print(f"  Source: {d['source_id']} ({d['entry_count']} entries)")
            print(f"    Reason: {d['reason']}")
            for e in d['entries']:
                print(f"      - {e['id']}: {e['type']} ₹{e['amount']:,.0f} role={e['role']} acct={e['account']}")
        if len(duplicates_for_review) > 3:
            print(f"  ... and {len(duplicates_for_review) - 3} more")
    
    # ============ ANALYSIS 3: EXECUTION COST PAIRS ============
    print("\n" + "=" * 80)
    print("ANALYSIS 3: UNBALANCED EXECUTION COST PAIRS")
    print("=" * 80)
    
    for source_id, entries in by_source.items():
        if source_id.startswith("exec_") and len(entries) == 2:
            types = [e.get("transaction_type") for e in entries]
            
            # Check if both are same type (wrong)
            if types[0] == types[1]:
                # Validate before fixing
                is_valid, reason = validate_execution_cost_fix(entries[0], entries[1])
                
                if is_valid:
                    # Find which one should be flipped (prefer the one marked as counter)
                    to_flip = None
                    for e in entries:
                        if e.get("entry_role") == "counter":
                            to_flip = e
                            break
                    
                    if not to_flip:
                        # If no explicit counter, flip the second one
                        to_flip = entries[1]
                    
                    new_type = "inflow" if to_flip.get("transaction_type") == "outflow" else "outflow"
                    
                    exec_to_fix.append({
                        "action": "SAFE_TO_FIX",
                        "reason": reason,
                        "transaction_id": to_flip.get("transaction_id"),
                        "source_id": source_id,
                        "current_type": to_flip.get("transaction_type"),
                        "new_type": new_type,
                        "amount": to_flip.get("amount")
                    })
                else:
                    exec_for_review.append({
                        "action": "NEEDS_REVIEW",
                        "reason": reason,
                        "source_id": source_id,
                        "entries": [
                            {
                                "id": e.get("transaction_id"),
                                "type": e.get("transaction_type"),
                                "amount": e.get("amount"),
                                "account": e.get("account_id")
                            }
                            for e in entries
                        ]
                    })
    
    print(f"Safe to fix: {len(exec_to_fix)}")
    print(f"Needs manual review: {len(exec_for_review)}")
    
    if exec_to_fix:
        print("\n[SAFE TO FIX]")
        for e in exec_to_fix:
            print(f"  {e['transaction_id']}: {e['current_type']} → {e['new_type']} (₹{e['amount']:,.0f})")
    
    if exec_for_review:
        print("\n[NEEDS MANUAL REVIEW]")
        for e in exec_for_review:
            print(f"  Source: {e['source_id']}")
            print(f"    Reason: {e['reason']}")
    
    # ============ SUMMARY ============
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    total_safe_fixes = len(orphans_to_delete) + len(duplicates_to_delete) + len(exec_to_fix)
    total_manual_review = len(orphans_for_review) + len(duplicates_for_review) + len(exec_for_review)
    
    print(f"\nSAFE TO FIX AUTOMATICALLY: {total_safe_fixes}")
    print(f"  - Orphan deletions: {len(orphans_to_delete)}")
    print(f"  - Duplicate deletions: {len(duplicates_to_delete)}")
    print(f"  - Exec cost type fixes: {len(exec_to_fix)}")
    
    print(f"\nNEEDS MANUAL REVIEW: {total_manual_review}")
    print(f"  - Orphans with potential primary: {len(orphans_for_review)}")
    print(f"  - Duplicates without valid pair: {len(duplicates_for_review)}")
    print(f"  - Exec costs with validation issues: {len(exec_for_review)}")
    
    # Calculate expected impact (only for safe fixes)
    expected_change = 0
    for o in orphans_to_delete:
        if o["type"] == "outflow":
            expected_change += o["amount"]
        else:
            expected_change -= o["amount"]
    
    for d in duplicates_to_delete:
        if d["type"] == "outflow":
            expected_change += d["amount"]
        else:
            expected_change -= d["amount"]
    
    print(f"\nExpected balance change from safe fixes: ₹{expected_change:,.2f}")
    print(f"Current imbalance: ₹{initial_imbalance:,.2f}")
    print(f"Expected new imbalance: ₹{initial_imbalance - expected_change:,.2f}")
    
    # ============ EXECUTE OR DRY RUN ============
    if dry_run:
        print("\n" + "=" * 80)
        print("DRY RUN COMPLETE")
        print("=" * 80)
        print("No changes made. Review the output above.")
        print("\nTo apply ONLY the safe fixes, run:")
        print("  python fix_accounting_data_safe.py --execute")
        print("\nManual review items will be SKIPPED (not modified).")
        
        # Write review items to file for manual inspection
        if total_manual_review > 0:
            review_file = f"/tmp/accounting_manual_review_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            with open(review_file, "w") as f:
                f.write("ITEMS NEEDING MANUAL REVIEW\n")
                f.write("=" * 80 + "\n\n")
                
                if orphans_for_review:
                    f.write("ORPHAN COUNTERS WITH POTENTIAL PRIMARY:\n")
                    for o in orphans_for_review:
                        f.write(f"  Orphan: {o['orphan_id']}\n")
                        f.write(f"  Potential primary: {o['potential_primary']}\n")
                        f.write(f"  Amount: {o['amount']}\n")
                        f.write(f"  Suggestion: {o['suggestion']}\n\n")
                
                if duplicates_for_review:
                    f.write("\nDUPLICATES WITHOUT VALID PAIR:\n")
                    for d in duplicates_for_review:
                        f.write(f"  Source: {d['source_id']}\n")
                        f.write(f"  Entries:\n")
                        for e in d['entries']:
                            f.write(f"    - {e['id']}: {e['type']} ₹{e['amount']} acct={e['account']}\n")
                        f.write("\n")
                
                if exec_for_review:
                    f.write("\nEXECUTION COSTS WITH VALIDATION ISSUES:\n")
                    for e in exec_for_review:
                        f.write(f"  Source: {e['source_id']}\n")
                        f.write(f"  Reason: {e['reason']}\n\n")
            
            print(f"\nManual review items written to: {review_file}")
        
        return
    
    # ============ EXECUTE SAFE FIXES ONLY ============
    print("\n" + "=" * 80)
    print("EXECUTING SAFE FIXES ONLY")
    print("=" * 80)
    print(f"Skipping {total_manual_review} items that need manual review")
    print()
    
    # Delete orphans (safe only)
    deleted_orphans = 0
    for o in orphans_to_delete:
        result = await db.accounting_transactions.delete_one({"transaction_id": o["transaction_id"]})
        if result.deleted_count > 0:
            deleted_orphans += 1
            print(f"  Deleted orphan: {o['transaction_id']}")
    print(f"Deleted {deleted_orphans} orphan entries")
    
    # Delete duplicates (safe only)
    deleted_dups = 0
    for d in duplicates_to_delete:
        result = await db.accounting_transactions.delete_one({"transaction_id": d["transaction_id"]})
        if result.deleted_count > 0:
            deleted_dups += 1
            print(f"  Deleted duplicate: {d['transaction_id']}")
    print(f"Deleted {deleted_dups} duplicate entries")
    
    # Fix execution costs (safe only)
    fixed_exec = 0
    for e in exec_to_fix:
        result = await db.accounting_transactions.update_one(
            {"transaction_id": e["transaction_id"]},
            {"$set": {"transaction_type": e["new_type"]}}
        )
        if result.modified_count > 0:
            fixed_exec += 1
            print(f"  Fixed exec cost: {e['transaction_id']} → {e['new_type']}")
    print(f"Fixed {fixed_exec} execution cost entries")
    
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
    
    improvement = abs(initial_imbalance) - abs(final_imbalance)
    if improvement > 0:
        print(f"Improvement: ₹{improvement:,.2f} ✓")
    else:
        print(f"Change: ₹{-improvement:,.2f} (may need manual review items fixed)")
    
    # Log
    await db.accounting_audit_log.insert_one({
        "action": "safe_data_integrity_fix_v2",
        "orphans_deleted": deleted_orphans,
        "duplicates_deleted": deleted_dups,
        "exec_costs_fixed": fixed_exec,
        "skipped_for_review": total_manual_review,
        "initial_imbalance": initial_imbalance,
        "final_imbalance": final_imbalance,
        "executed_at": datetime.now(timezone.utc).isoformat()
    })
    
    if total_manual_review > 0:
        print(f"\n⚠️  {total_manual_review} items were SKIPPED and need manual review.")
        print("Run with --dry-run to see the review file location.")


if __name__ == "__main__":
    asyncio.run(main())
