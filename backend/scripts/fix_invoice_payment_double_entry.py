"""
Migration Script: Fix Invoice Payment Double-Entry
===================================================
This script adds missing counter entries (Vendor Payable debit) for invoice payments
that were recorded before the double-entry fix was implemented.

For each invoice payment:
- Primary entry: Bank Credit (outflow) - already exists
- Counter entry: Vendor Payable Debit (settlement) - MISSING, will be created

Usage:
------
1. DRY RUN (preview changes):
   python fix_invoice_payment_double_entry.py --dry-run

2. APPLY MIGRATION:
   python fix_invoice_payment_double_entry.py

3. VERIFY:
   python fix_invoice_payment_double_entry.py --verify
"""

import os
import uuid
from pymongo import MongoClient
from datetime import datetime, timezone
import argparse

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "arkiflo")

def get_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def fix_invoice_payments(db, dry_run=False):
    """Find and fix invoice payment entries missing counter entries."""
    print("\n" + "="*60)
    print("FIXING INVOICE PAYMENT DOUBLE-ENTRY")
    print("="*60 + "\n")
    
    # Find all invoice payment transactions that don't have double-entry set up
    # These are entries from invoice_ledger source or with reference_type = invoice_payment
    query = {
        "$or": [
            {"source_module": "invoice_ledger"},
            {"reference_type": "invoice_payment"},
            {"category_id": "invoice_payment"}
        ],
        "transaction_type": "outflow",
        # Exclude entries that already have double-entry
        "$or": [
            {"is_double_entry": {"$exists": False}},
            {"is_double_entry": False},
            {"entry_role": {"$exists": False}}
        ]
    }
    
    # Simpler query - find all invoice payment outflows
    invoice_payments = list(db.accounting_transactions.find({
        "transaction_type": "outflow",
        "$or": [
            {"source_module": "invoice_ledger"},
            {"reference_type": "invoice_payment"},
            {"category_id": "invoice_payment"}
        ]
    }))
    
    print(f"Found {len(invoice_payments)} invoice payment transactions\n")
    
    fixed_count = 0
    skipped_count = 0
    error_count = 0
    
    for payment in invoice_payments:
        txn_id = payment.get("transaction_id")
        amount = payment.get("amount", 0)
        vendor_name = payment.get("paid_to") or payment.get("party_name") or "Vendor"
        project_id = payment.get("project_id")
        vendor_id = payment.get("vendor_id")
        payment_date = payment.get("transaction_date") or payment.get("created_at", "")[:10]
        payment_mode = payment.get("mode", "Bank")
        remarks = payment.get("remarks", "")
        created_at = payment.get("created_at")
        created_by = payment.get("created_by")
        created_by_name = payment.get("created_by_name")
        
        # Check if already has double-entry
        if payment.get("is_double_entry") and payment.get("entry_role") == "primary":
            # Check if counter entry exists
            counter_exists = db.accounting_transactions.find_one({
                "linked_transaction_id": txn_id,
                "entry_role": "counter"
            })
            if counter_exists:
                print(f"  [SKIP] {txn_id} - Already has counter entry")
                skipped_count += 1
                continue
        
        # Check if counter entry already exists by reference
        existing_counter = db.accounting_transactions.find_one({
            "linked_transaction_id": txn_id,
            "entry_role": "counter"
        })
        if existing_counter:
            print(f"  [SKIP] {txn_id} - Counter entry already exists")
            skipped_count += 1
            continue
        
        print(f"  [FIX] {txn_id}")
        print(f"        Amount: {amount:,.2f}")
        print(f"        Vendor: {vendor_name}")
        print(f"        Date: {payment_date}")
        
        if not dry_run:
            try:
                # Create counter entry for Vendor Payable
                counter_txn_id = f"txn_{uuid.uuid4().hex[:10]}"
                counter_entry = {
                    "transaction_id": counter_txn_id,
                    "transaction_date": payment_date,
                    "transaction_type": "inflow",  # Reduces liability (debit in accounting)
                    "entry_type": "vendor_payable_settlement",
                    "amount": amount,
                    "debit": amount,
                    "credit": 0,
                    "mode": payment_mode,
                    "category_id": "vendor_payable",
                    "account_id": "vendor_payable",
                    "account_name": "Vendor Payable",
                    "project_id": project_id,
                    "vendor_id": vendor_id,
                    "party_id": vendor_id,
                    "party_type": "vendor",
                    "party_name": vendor_name,
                    "description": f"Payment settlement - {vendor_name}",
                    "remarks": remarks or f"Settlement of vendor payable (migrated)",
                    "reference_type": payment.get("reference_type", "invoice_payment"),
                    "reference_id": payment.get("reference_id"),
                    "linked_transaction_id": txn_id,
                    "is_double_entry": True,
                    "entry_role": "counter",
                    "is_cashbook_entry": False,
                    "is_migrated": True,
                    "migrated_at": datetime.now(timezone.utc).isoformat(),
                    "created_at": created_at or datetime.now(timezone.utc).isoformat(),
                    "created_by": created_by,
                    "created_by_name": created_by_name
                }
                
                db.accounting_transactions.insert_one(counter_entry)
                
                # Update primary entry to mark as double-entry
                db.accounting_transactions.update_one(
                    {"transaction_id": txn_id},
                    {"$set": {
                        "is_double_entry": True,
                        "entry_role": "primary",
                        "linked_transaction_id": counter_txn_id,
                        "debit": 0,
                        "credit": amount,
                        "is_migrated": True,
                        "migrated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                fixed_count += 1
                print(f"        ✅ Created counter entry: {counter_txn_id}")
                
            except Exception as e:
                print(f"        ❌ Error: {e}")
                error_count += 1
        else:
            fixed_count += 1
    
    print(f"\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    print(f"Total invoice payments found: {len(invoice_payments)}")
    print(f"Fixed (counter entries created): {fixed_count}")
    print(f"Skipped (already had counter): {skipped_count}")
    print(f"Errors: {error_count}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN - No changes were made.")
        print(f"   Run without --dry-run to apply fixes.")
    else:
        print(f"\n✅ Migration complete!")
    
    print("="*60 + "\n")
    
    return fixed_count, error_count

def verify_migration(db):
    """Verify that all invoice payments have proper double-entry."""
    print("\n" + "="*60)
    print("VERIFICATION REPORT")
    print("="*60 + "\n")
    
    # Count invoice payments
    total_payments = db.accounting_transactions.count_documents({
        "transaction_type": "outflow",
        "$or": [
            {"source_module": "invoice_ledger"},
            {"reference_type": "invoice_payment"},
            {"category_id": "invoice_payment"}
        ]
    })
    
    # Count with double-entry
    with_double_entry = db.accounting_transactions.count_documents({
        "transaction_type": "outflow",
        "$or": [
            {"source_module": "invoice_ledger"},
            {"reference_type": "invoice_payment"},
            {"category_id": "invoice_payment"}
        ],
        "is_double_entry": True,
        "entry_role": "primary"
    })
    
    # Count counter entries
    counter_entries = db.accounting_transactions.count_documents({
        "entry_type": "vendor_payable_settlement",
        "entry_role": "counter"
    })
    
    print(f"Total invoice payment transactions: {total_payments}")
    print(f"With double-entry marked: {with_double_entry}")
    print(f"Counter entries (Vendor Payable): {counter_entries}")
    
    if total_payments == with_double_entry and total_payments == counter_entries:
        print(f"\n✅ All invoice payments have proper double-entry!")
    else:
        print(f"\n⚠️  Some entries may still need migration.")
        missing = total_payments - with_double_entry
        if missing > 0:
            print(f"   Missing double-entry: {missing}")
    
    # Show sample entries
    print(f"\n--- Sample Invoice Payment Entries ---")
    samples = list(db.accounting_transactions.find({
        "transaction_type": "outflow",
        "$or": [
            {"source_module": "invoice_ledger"},
            {"reference_type": "invoice_payment"},
            {"category_id": "invoice_payment"}
        ]
    }).limit(3))
    
    for s in samples:
        print(f"\n  Transaction: {s.get('transaction_id')}")
        print(f"  Amount: {s.get('amount', 0):,.2f}")
        print(f"  Double-entry: {s.get('is_double_entry', False)}")
        print(f"  Entry role: {s.get('entry_role', 'N/A')}")
        print(f"  Linked to: {s.get('linked_transaction_id', 'N/A')}")
    
    print("\n" + "="*60 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Fix invoice payment double-entry")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--verify", action="store_true", help="Verify migration status")
    
    args = parser.parse_args()
    
    db = get_db()
    
    print(f"\nDatabase: {DB_NAME}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE' if not args.verify else 'VERIFY'}")
    
    if args.verify:
        verify_migration(db)
    else:
        fix_invoice_payments(db, args.dry_run)
        if not args.dry_run:
            verify_migration(db)

if __name__ == "__main__":
    main()
