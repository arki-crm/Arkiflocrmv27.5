#!/usr/bin/env python3
"""
SAFE DATA FIX SCRIPT: Fix Corrupted Double-Entry Transactions

This script fixes two patterns of corruption:
1. TRIPLES: source_id has 3 entries (remove the duplicate "txn_fix_" entries)
2. ORPHANS: source_id has 1 entry (mark for review - do not auto-fix)

USAGE:
    # Dry run (no changes)
    python3 fix_corrupted_transactions.py --dry-run
    
    # Apply fixes
    python3 fix_corrupted_transactions.py --apply

CONNECTION:
    MONGO_URL="mongodb://arkiflo_app:pass123@localhost:27017/arkiflo?authSource=arkiflo" python3 fix_corrupted_transactions.py --dry-run
"""

import os
import sys
import argparse
from datetime import datetime, timezone
from collections import defaultdict

try:
    from pymongo import MongoClient
except ImportError:
    print("ERROR: pymongo not installed. Run: pip install pymongo")
    sys.exit(1)

# Configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://arkiflo_app:pass123@localhost:27017/arkiflo?authSource=arkiflo')
DB_NAME = os.environ.get('DB_NAME', 'arkiflo')


def connect():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]
    db.command('ping')
    return client, db


def analyze_transactions(db):
    """Analyze all transactions and identify corrupted entries"""
    print("\n[1] Analyzing all accounting transactions...")
    
    txns = list(db.accounting_transactions.find({}))
    print(f"    Total transactions: {len(txns)}")
    
    # Group by source_id
    by_source = defaultdict(list)
    for t in txns:
        source_id = t.get('source_id') or t.get('reference_id') or t.get('receipt_id') or 'NO_SOURCE'
        by_source[source_id].append(t)
    
    print(f"    Unique source_ids: {len(by_source)}")
    
    # Categorize
    triples = []  # 3+ entries (duplicates)
    orphans = []  # 1 entry (missing pair)
    valid = []    # 2 entries (correct)
    no_source = []  # NO_SOURCE entries
    
    for source_id, entries in by_source.items():
        if source_id == 'NO_SOURCE':
            no_source.extend(entries)
        elif len(entries) > 2:
            triples.append((source_id, entries))
        elif len(entries) == 1:
            orphans.append((source_id, entries[0]))
        else:
            valid.append((source_id, entries))
    
    return {
        'triples': triples,
        'orphans': orphans,
        'valid': valid,
        'no_source': no_source,
        'total': len(txns)
    }


def fix_triples(db, triples, dry_run=True):
    """
    Fix triple entries by removing the duplicate "txn_fix_" entries.
    Keep the original entry + one valid counter.
    """
    print(f"\n[2] Fixing TRIPLE entries ({len(triples)} source_ids with >2 entries)")
    
    to_delete = []
    
    for source_id, entries in triples:
        # Identify entries to keep vs delete
        # Strategy: Keep entries that DON'T have "txn_fix_" prefix
        # If all have txn_fix_, keep the first 2
        
        original_entries = [e for e in entries if not e.get('transaction_id', '').startswith('txn_fix_')]
        fix_entries = [e for e in entries if e.get('transaction_id', '').startswith('txn_fix_')]
        
        if len(original_entries) == 1 and len(fix_entries) >= 2:
            # Pattern: 1 original + 2 fix entries
            # Keep original + 1 fix entry that forms a valid pair
            # Delete the extra fix entry
            
            original = original_entries[0]
            original_type = original.get('transaction_type')
            
            # Find the fix entry with OPPOSITE type to form valid pair
            opposite_type = 'inflow' if original_type == 'outflow' else 'outflow'
            
            keep_fix = None
            delete_fixes = []
            
            for fe in fix_entries:
                if fe.get('transaction_type') == opposite_type and keep_fix is None:
                    keep_fix = fe
                else:
                    delete_fixes.append(fe)
            
            if keep_fix:
                print(f"\n    source_id: {source_id}")
                print(f"      KEEP: {original.get('transaction_id')} ({original_type})")
                print(f"      KEEP: {keep_fix.get('transaction_id')} ({keep_fix.get('transaction_type')})")
                for df in delete_fixes:
                    print(f"      DELETE: {df.get('transaction_id')} ({df.get('transaction_type')})")
                    to_delete.append(df['_id'])
            else:
                # Can't find valid pair - delete all fix entries
                print(f"\n    source_id: {source_id} - No valid pair found")
                for fe in fix_entries:
                    print(f"      DELETE: {fe.get('transaction_id')}")
                    to_delete.append(fe['_id'])
        
        elif len(original_entries) >= 2:
            # Multiple originals - delete extras, keep first 2
            print(f"\n    source_id: {source_id} - Multiple originals")
            for extra in original_entries[2:]:
                print(f"      DELETE (extra original): {extra.get('transaction_id')}")
                to_delete.append(extra['_id'])
            for fe in fix_entries:
                print(f"      DELETE (fix): {fe.get('transaction_id')}")
                to_delete.append(fe['_id'])
        
        else:
            # Unexpected pattern - flag for manual review
            print(f"\n    source_id: {source_id} - MANUAL REVIEW NEEDED")
            print(f"      Originals: {len(original_entries)}, Fixes: {len(fix_entries)}")
    
    # Execute deletions
    if to_delete:
        print(f"\n    Total entries to delete: {len(to_delete)}")
        
        if dry_run:
            print("    [DRY RUN] No changes made")
        else:
            result = db.accounting_transactions.delete_many({'_id': {'$in': to_delete}})
            print(f"    DELETED: {result.deleted_count} entries")
    else:
        print("    No triple entries to fix")
    
    return len(to_delete)


def report_orphans(orphans):
    """Report orphan entries (don't auto-fix these)"""
    print(f"\n[3] Reporting ORPHAN entries ({len(orphans)} source_ids with 1 entry)")
    print("    NOTE: Orphans require manual review - not auto-fixed")
    
    for source_id, entry in orphans[:10]:  # Show first 10
        print(f"\n    source_id: {source_id}")
        print(f"      {entry.get('transaction_id')}: {entry.get('transaction_type')} ₹{entry.get('amount', 0):,.0f}")
        print(f"      entry_role: {entry.get('entry_role')}, is_double_entry: {entry.get('is_double_entry')}")
        print(f"      project_id: {entry.get('project_id')}")
    
    if len(orphans) > 10:
        print(f"\n    ... and {len(orphans) - 10} more orphans")


def report_no_source(no_source):
    """Report entries with no source_id"""
    print(f"\n[4] Reporting NO_SOURCE entries ({len(no_source)} entries)")
    print("    NOTE: These may be legacy entries - require manual review")
    
    # Group by project_id
    by_project = defaultdict(list)
    for e in no_source:
        by_project[e.get('project_id', 'NO_PROJECT')].append(e)
    
    for pid, entries in list(by_project.items())[:5]:
        print(f"\n    Project: {pid}")
        for e in entries[:3]:
            print(f"      {e.get('transaction_id')}: {e.get('transaction_type')} ₹{e.get('amount', 0):,.0f}")
        if len(entries) > 3:
            print(f"      ... and {len(entries) - 3} more")


def main():
    parser = argparse.ArgumentParser(description='Fix corrupted double-entry transactions')
    parser.add_argument('--dry-run', action='store_true', help='Analyze only, no changes')
    parser.add_argument('--apply', action='store_true', help='Apply fixes')
    args = parser.parse_args()
    
    if not args.dry_run and not args.apply:
        print("ERROR: Must specify --dry-run or --apply")
        sys.exit(1)
    
    dry_run = args.dry_run or not args.apply
    
    print("=" * 80)
    print("SAFE DATA FIX: Corrupted Double-Entry Transactions")
    print(f"Mode: {'DRY RUN' if dry_run else 'APPLY FIXES'}")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)
    
    # Connect
    print("\n[0] Connecting to MongoDB...")
    try:
        client, db = connect()
        print(f"    Connected to {DB_NAME}")
    except Exception as e:
        print(f"    Connection failed: {e}")
        sys.exit(1)
    
    # Analyze
    analysis = analyze_transactions(db)
    
    print(f"\n{'=' * 80}")
    print("ANALYSIS SUMMARY")
    print(f"{'=' * 80}")
    print(f"  Total transactions: {analysis['total']}")
    print(f"  Valid pairs (2 entries): {len(analysis['valid'])}")
    print(f"  Triples (3+ entries): {len(analysis['triples'])} ← WILL FIX")
    print(f"  Orphans (1 entry): {len(analysis['orphans'])} ← MANUAL REVIEW")
    print(f"  No source_id: {len(analysis['no_source'])} ← MANUAL REVIEW")
    
    # Fix triples
    deleted = fix_triples(db, analysis['triples'], dry_run)
    
    # Report orphans
    report_orphans(analysis['orphans'])
    
    # Report no_source
    report_no_source(analysis['no_source'])
    
    # Summary
    print(f"\n{'=' * 80}")
    print("EXECUTION SUMMARY")
    print(f"{'=' * 80}")
    print(f"  Entries {'would be' if dry_run else ''} deleted: {deleted}")
    print(f"  Orphans requiring manual review: {len(analysis['orphans'])}")
    print(f"  No-source entries requiring review: {len(analysis['no_source'])}")
    
    if dry_run:
        print("\n  [DRY RUN] No changes were made")
        print("  Run with --apply to execute fixes")
    else:
        print("\n  ✓ Fixes applied successfully")
    
    client.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
