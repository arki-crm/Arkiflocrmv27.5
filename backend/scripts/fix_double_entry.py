"""
Comprehensive Double-Entry Fix Migration
=========================================
This script audits ALL transactions and creates missing counter entries
to ensure proper double-entry accounting (every debit has a credit).

Rules:
1. Receipt (inflow to bank): Dr Bank, Cr Customer Advance
2. Payment (outflow from bank): Dr Expense/Vendor, Cr Bank
3. Opening Balance: Dr Bank, Cr Opening Balance/Capital

Usage:
------
python fix_double_entry.py --dry-run    # Preview
python fix_double_entry.py              # Apply fix
python fix_double_entry.py --verify     # Verify after fix
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

def fix_receipts(db, dry_run=False):
    """Fix receipts - ensure every inflow has Cr Customer Advance"""
    print("\n" + "="*60)
    print("FIXING RECEIPTS (Inflows)")
    print("="*60 + "\n")
    
    # Find all inflow transactions (receipts)
    inflows = list(db.accounting_transactions.find({
        "transaction_type": "inflow"
    }))
    
    print(f"Total inflow transactions: {len(inflows)}")
    
    fixed = 0
    skipped = 0
    total_amount = 0
    
    for txn in inflows:
        txn_id = txn.get("transaction_id")
        amount = txn.get("amount", 0)
        
        # Check if this is already a counter entry
        if txn.get("entry_role") == "counter":
            skipped += 1
            continue
        
        # Check if counter entry already exists
        counter_exists = db.accounting_transactions.find_one({
            "$or": [
                {"linked_transaction_id": txn_id, "entry_role": "counter"},
                {"transaction_id": txn.get("linked_transaction_id"), "entry_role": "counter"} if txn.get("linked_transaction_id") else {"_id": None}
            ]
        })
        
        if counter_exists:
            skipped += 1
            continue
        
        # Also check if already marked as double-entry with a link
        if txn.get("is_double_entry") and txn.get("linked_transaction_id"):
            linked = db.accounting_transactions.find_one({"transaction_id": txn.get("linked_transaction_id")})
            if linked:
                skipped += 1
                continue
        
        print(f"  [FIX] {txn_id}: {amount:,.2f} - Missing Cr Customer Advance")
        total_amount += amount
        
        if not dry_run:
            # Create counter entry: Cr Customer Advance
            counter_txn_id = f"txn_{uuid.uuid4().hex[:12]}"
            counter_entry = {
                "transaction_id": counter_txn_id,
                "transaction_date": txn.get("transaction_date") or txn.get("date"),
                "transaction_type": "outflow",  # Credit side for liability
                "entry_type": "customer_advance_credit",
                "amount": amount,
                "debit": 0,
                "credit": amount,
                "mode": txn.get("mode", "Bank"),
                "account_id": "acc_customer_advance",
                "account_name": "Customer Advance",
                "category_id": "customer_advance",
                "project_id": txn.get("project_id"),
                "party_id": txn.get("party_id"),
                "party_type": "customer",
                "party_name": txn.get("party_name", "Customer"),
                "description": f"Customer advance credit - {txn.get('description', '')}",
                "remarks": txn.get("remarks"),
                "reference_type": txn.get("reference_type", "receipt"),
                "reference_id": txn.get("reference_id"),
                "linked_transaction_id": txn_id,
                "is_double_entry": True,
                "entry_role": "counter",
                "is_cashbook_entry": False,
                "created_at": txn.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "created_by": txn.get("created_by"),
                "created_by_name": txn.get("created_by_name"),
                "is_migrated": True,
                "migrated_at": datetime.now(timezone.utc).isoformat()
            }
            
            db.accounting_transactions.insert_one(counter_entry)
            
            # Update primary entry
            db.accounting_transactions.update_one(
                {"transaction_id": txn_id},
                {"$set": {
                    "is_double_entry": True,
                    "entry_role": "primary",
                    "linked_transaction_id": counter_txn_id,
                    "debit": amount,
                    "credit": 0
                }}
            )
        
        fixed += 1
    
    print(f"\nReceipts Fixed: {fixed} | Skipped: {skipped}")
    print(f"Total amount with missing Cr Customer Advance: {total_amount:,.2f}")
    return fixed, total_amount

def fix_opening_balances(db, dry_run=False):
    """Fix opening balances - ensure they have Cr Capital/Opening Balance"""
    print("\n" + "="*60)
    print("FIXING OPENING BALANCES")
    print("="*60 + "\n")
    
    # Check accounting_accounts for opening_balance > 0
    accounts = list(db.accounting_accounts.find({
        "opening_balance": {"$gt": 0}
    }))
    
    print(f"Accounts with opening balance: {len(accounts)}")
    
    fixed = 0
    total_amount = 0
    
    for acc in accounts:
        acc_id = acc.get("account_id")
        acc_name = acc.get("account_name")
        opening = acc.get("opening_balance", 0)
        
        # Check if opening balance transaction exists
        existing = db.accounting_transactions.find_one({
            "account_id": acc_id,
            "entry_type": {"$in": ["opening_balance", "opening_balance_debit"]}
        })
        
        if existing:
            # Check if counter entry exists
            if existing.get("linked_transaction_id"):
                print(f"  [SKIP] {acc_name}: Opening balance already has counter entry")
                continue
        
        print(f"  [FIX] {acc_name}: Opening {opening:,.2f} - Need Cr Capital Account")
        total_amount += opening
        
        if not dry_run:
            now = datetime.now(timezone.utc).isoformat()
            
            # Create/update debit entry for bank
            debit_txn_id = f"txn_ob_dr_{acc_id}"
            credit_txn_id = f"txn_ob_cr_{acc_id}"
            
            # Debit entry (Bank/Cash)
            db.accounting_transactions.update_one(
                {"transaction_id": debit_txn_id},
                {"$set": {
                    "transaction_id": debit_txn_id,
                    "transaction_date": "2026-01-01",
                    "transaction_type": "inflow",
                    "entry_type": "opening_balance_debit",
                    "amount": opening,
                    "debit": opening,
                    "credit": 0,
                    "account_id": acc_id,
                    "account_name": acc_name,
                    "description": f"Opening balance - {acc_name}",
                    "is_double_entry": True,
                    "entry_role": "primary",
                    "linked_transaction_id": credit_txn_id,
                    "is_opening_balance": True,
                    "created_at": now,
                    "is_migrated": True
                }},
                upsert=True
            )
            
            # Credit entry (Capital/Opening Balance Equity)
            db.accounting_transactions.update_one(
                {"transaction_id": credit_txn_id},
                {"$set": {
                    "transaction_id": credit_txn_id,
                    "transaction_date": "2026-01-01",
                    "transaction_type": "outflow",
                    "entry_type": "opening_balance_credit",
                    "amount": opening,
                    "debit": 0,
                    "credit": opening,
                    "account_id": "acc_capital",
                    "account_name": "Capital / Opening Balance",
                    "description": f"Capital for {acc_name} opening balance",
                    "is_double_entry": True,
                    "entry_role": "counter",
                    "linked_transaction_id": debit_txn_id,
                    "is_opening_balance": True,
                    "created_at": now,
                    "is_migrated": True
                }},
                upsert=True
            )
        
        fixed += 1
    
    # Create Capital account if doesn't exist
    if not dry_run and fixed > 0:
        db.accounting_accounts.update_one(
            {"account_id": "acc_capital"},
            {"$set": {
                "account_id": "acc_capital",
                "account_name": "Capital / Opening Balance",
                "account_type": "equity",
                "description": "Owner's capital and opening balance equity",
                "opening_balance": 0,
                "current_balance": 0,
                "is_system": True,
                "is_active": True
            }},
            upsert=True
        )
        print("\n  Created/Updated Capital account")
    
    print(f"\nOpening Balances Fixed: {fixed}")
    print(f"Total opening balance amount: {total_amount:,.2f}")
    return fixed, total_amount

def ensure_customer_advance_account(db, dry_run=False):
    """Ensure Customer Advance account exists as liability"""
    if not dry_run:
        db.accounting_accounts.update_one(
            {"account_id": "acc_customer_advance"},
            {"$set": {
                "account_id": "acc_customer_advance",
                "account_name": "Customer Advance",
                "account_type": "liability",
                "description": "Advance payments received from customers",
                "opening_balance": 0,
                "current_balance": 0,
                "is_system": True,
                "is_active": True
            }},
            upsert=True
        )
        print("Ensured Customer Advance account exists as LIABILITY")

def verify_balance(db):
    """Verify trial balance after fix"""
    print("\n" + "="*60)
    print("VERIFICATION - TRIAL BALANCE CHECK")
    print("="*60 + "\n")
    
    txns = list(db.accounting_transactions.find({}))
    
    total_debit = sum(t.get("debit", 0) or 0 for t in txns)
    total_credit = sum(t.get("credit", 0) or 0 for t in txns)
    
    print(f"Total Debit: {total_debit:,.2f}")
    print(f"Total Credit: {total_credit:,.2f}")
    print(f"Difference: {abs(total_debit - total_credit):,.2f}")
    
    if abs(total_debit - total_credit) < 1:
        print("\n✅ TRIAL BALANCE IS BALANCED!")
    else:
        print("\n⚠️  Trial balance still has mismatch")
        
        # Find orphan entries
        primary_count = db.accounting_transactions.count_documents({"entry_role": "primary"})
        counter_count = db.accounting_transactions.count_documents({"entry_role": "counter"})
        no_role_count = db.accounting_transactions.count_documents({
            "$or": [
                {"entry_role": {"$exists": False}},
                {"entry_role": None}
            ]
        })
        
        print(f"\n  Primary entries: {primary_count}")
        print(f"  Counter entries: {counter_count}")
        print(f"  Entries without role: {no_role_count}")
    
    # Show by account type
    print("\n--- BY ACCOUNT ---")
    by_account = {}
    for t in txns:
        acc = t.get("account_id", "unknown")
        if acc not in by_account:
            by_account[acc] = {"debit": 0, "credit": 0}
        by_account[acc]["debit"] += t.get("debit", 0) or 0
        by_account[acc]["credit"] += t.get("credit", 0) or 0
    
    for acc, vals in sorted(by_account.items(), key=lambda x: x[1]["debit"] + x[1]["credit"], reverse=True)[:10]:
        net = vals["debit"] - vals["credit"]
        print(f"  {acc}: D={vals['debit']:,.0f} C={vals['credit']:,.0f} Net={net:,.0f}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    
    db = get_db()
    print(f"Database: {DB_NAME}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'VERIFY' if args.verify else 'LIVE'}")
    
    if args.verify:
        verify_balance(db)
    else:
        ensure_customer_advance_account(db, args.dry_run)
        fix_receipts(db, args.dry_run)
        fix_opening_balances(db, args.dry_run)
        
        if args.dry_run:
            print("\n" + "="*60)
            print("DRY RUN COMPLETE - No changes made")
            print("Run without --dry-run to apply fixes")
            print("="*60)
        else:
            print("\n" + "="*60)
            print("MIGRATION COMPLETE")
            print("="*60)
            verify_balance(db)

if __name__ == "__main__":
    main()
