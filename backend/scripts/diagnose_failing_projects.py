#!/usr/bin/env python3
"""
Production Diagnostic Script: Identify Failing Projects in Project Financials

Run this script on your production server:
    python3 diagnose_failing_projects.py

Or with custom connection:
    MONGO_URL="mongodb://arkiflo_app:pass123@localhost:27017/arkiflo?authSource=arkiflo" python3 diagnose_failing_projects.py
"""

import os
import sys
from datetime import datetime
from collections import defaultdict

# Try to use motor for async, fall back to pymongo for sync
try:
    from pymongo import MongoClient
    ASYNC_MODE = False
except ImportError:
    print("ERROR: pymongo not installed. Run: pip install pymongo")
    sys.exit(1)

# Connection settings
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://arkiflo_app:pass123@localhost:27017/arkiflo?authSource=arkiflo')
DB_NAME = os.environ.get('DB_NAME', 'arkiflo')


def connect():
    """Connect to MongoDB"""
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]
    # Test connection
    db.command('ping')
    return client, db


def analyze_project_transactions(db, project_id, project_name):
    """Analyze all transactions for a specific project"""
    issues = []
    
    # Get all transactions for this project
    txns = list(db.accounting_transactions.find({"project_id": project_id}))
    
    if not txns:
        return {"project_id": project_id, "project_name": project_name, "txn_count": 0, "issues": []}
    
    # Group by source_id
    by_source = defaultdict(list)
    for t in txns:
        source_id = t.get("source_id") or t.get("reference_id") or t.get("receipt_id") or "NO_SOURCE"
        by_source[source_id].append(t)
    
    # Check each source_id group
    for source_id, entries in by_source.items():
        if source_id == "NO_SOURCE":
            for e in entries:
                issues.append({
                    "type": "MISSING_SOURCE_ID",
                    "severity": "HIGH",
                    "transaction_id": e.get("transaction_id"),
                    "amount": e.get("amount"),
                    "details": "Transaction has no source_id/reference_id"
                })
            continue
        
        # Check entry count (should be exactly 2 for double-entry)
        if len(entries) > 2:
            issues.append({
                "type": "DUPLICATE_ENTRIES",
                "severity": "CRITICAL",
                "source_id": source_id,
                "entry_count": len(entries),
                "transaction_ids": [e.get("transaction_id") for e in entries],
                "details": f"source_id has {len(entries)} entries (expected 2)"
            })
        elif len(entries) == 1:
            e = entries[0]
            # Single entry might be okay for pre-double-entry data
            if e.get("is_double_entry") or e.get("entry_role"):
                issues.append({
                    "type": "ORPHAN_ENTRY",
                    "severity": "HIGH",
                    "source_id": source_id,
                    "transaction_id": e.get("transaction_id"),
                    "entry_role": e.get("entry_role"),
                    "details": "Double-entry marked but missing pair"
                })
        
        # Check for balance (debit == credit)
        if len(entries) == 2:
            total_inflow = sum(e.get("amount", 0) for e in entries if e.get("transaction_type") == "inflow")
            total_outflow = sum(e.get("amount", 0) for e in entries if e.get("transaction_type") == "outflow")
            
            # For proper double-entry, amounts should match
            amounts = [e.get("amount", 0) for e in entries]
            if len(set(amounts)) > 1:
                issues.append({
                    "type": "UNBALANCED_PAIR",
                    "severity": "CRITICAL",
                    "source_id": source_id,
                    "amounts": amounts,
                    "details": f"Entry amounts don't match: {amounts}"
                })
    
    # Check for NULL/invalid fields
    for t in txns:
        if t.get("amount") is None:
            issues.append({
                "type": "NULL_AMOUNT",
                "severity": "CRITICAL",
                "transaction_id": t.get("transaction_id"),
                "details": "Transaction has NULL amount"
            })
        
        if t.get("transaction_type") not in ["inflow", "outflow", None]:
            issues.append({
                "type": "INVALID_TYPE",
                "severity": "HIGH",
                "transaction_id": t.get("transaction_id"),
                "transaction_type": t.get("transaction_type"),
                "details": f"Invalid transaction_type: {t.get('transaction_type')}"
            })
    
    return {
        "project_id": project_id,
        "project_name": project_name,
        "txn_count": len(txns),
        "source_id_count": len(by_source),
        "issues": issues
    }


def simulate_project_financials_query(db, project_id):
    """Simulate what the Project Financials API does - find where it might fail"""
    errors = []
    
    try:
        # This is similar to what get_project_finance_detail does
        
        # 1. Get project
        project = db.projects.find_one({"project_id": project_id})
        if not project:
            errors.append(f"Project not found: {project_id}")
            return errors
        
        # 2. Get all accounting transactions
        txns = list(db.accounting_transactions.find({"project_id": project_id}))
        
        # 3. Try to process them (this is where errors might occur)
        for t in txns:
            try:
                # Simulate aggregation/calculation
                amount = t.get("amount")
                if amount is None:
                    errors.append(f"NULL amount in txn {t.get('transaction_id')}")
                    continue
                
                # Try to convert/use the amount
                float(amount)
                
                # Check transaction_type
                txn_type = t.get("transaction_type")
                if txn_type not in ["inflow", "outflow"]:
                    errors.append(f"Invalid type '{txn_type}' in txn {t.get('transaction_id')}")
                
            except (TypeError, ValueError) as e:
                errors.append(f"Error processing txn {t.get('transaction_id')}: {e}")
        
        # 4. Get execution ledger entries
        exec_entries = list(db.execution_ledger.find({"project_id": project_id}))
        for e in exec_entries:
            try:
                grand_total = e.get("grand_total") or e.get("total_value", 0)
                float(grand_total)
            except (TypeError, ValueError) as err:
                errors.append(f"Invalid grand_total in execution {e.get('execution_id')}: {err}")
        
        # 5. Get expense requests
        expenses = list(db.expense_requests.find({"project_id": project_id}))
        for exp in expenses:
            try:
                amount = exp.get("amount", 0)
                float(amount)
            except (TypeError, ValueError) as err:
                errors.append(f"Invalid amount in expense {exp.get('request_id')}: {err}")
        
    except Exception as e:
        errors.append(f"Query error: {type(e).__name__}: {e}")
    
    return errors


def main():
    print("=" * 70)
    print("PRODUCTION DIAGNOSTIC: Failing Project Financials")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 70)
    
    # Connect
    print("\n[1] Connecting to MongoDB...")
    try:
        client, db = connect()
        print(f"    ✓ Connected to {DB_NAME}")
    except Exception as e:
        print(f"    ✗ Connection failed: {e}")
        sys.exit(1)
    
    # Get all projects
    print("\n[2] Fetching all projects...")
    projects = list(db.projects.find({}, {"project_id": 1, "project_name": 1, "name": 1}))
    print(f"    Found {len(projects)} projects")
    
    # Analyze each project
    print("\n[3] Analyzing projects for transaction integrity issues...")
    
    failing_projects = []
    all_issues = []
    
    for proj in projects:
        project_id = proj.get("project_id")
        project_name = proj.get("project_name") or proj.get("name", "Unknown")
        
        # Analyze transactions
        result = analyze_project_transactions(db, project_id, project_name)
        
        # Simulate API query
        api_errors = simulate_project_financials_query(db, project_id)
        
        if result["issues"] or api_errors:
            result["api_errors"] = api_errors
            failing_projects.append(result)
            all_issues.extend(result["issues"])
    
    # Report findings
    print("\n" + "=" * 70)
    print("DIAGNOSTIC RESULTS")
    print("=" * 70)
    
    if not failing_projects:
        print("\n✓ No issues found in any project!")
    else:
        print(f"\n✗ Found {len(failing_projects)} projects with issues:\n")
        
        for fp in failing_projects:
            print(f"\n{'─' * 60}")
            print(f"PROJECT: {fp['project_name']}")
            print(f"ID: {fp['project_id']}")
            print(f"Transactions: {fp['txn_count']}")
            print(f"Unique source_ids: {fp.get('source_id_count', 'N/A')}")
            
            if fp.get("api_errors"):
                print(f"\n  API ERRORS ({len(fp['api_errors'])}):")
                for err in fp["api_errors"][:5]:
                    print(f"    - {err}")
            
            if fp["issues"]:
                print(f"\n  TRANSACTION ISSUES ({len(fp['issues'])}):")
                
                # Group by type
                by_type = defaultdict(list)
                for issue in fp["issues"]:
                    by_type[issue["type"]].append(issue)
                
                for issue_type, issues in by_type.items():
                    print(f"\n    [{issue_type}] - {len(issues)} occurrence(s)")
                    for issue in issues[:3]:  # Show first 3
                        print(f"      Severity: {issue['severity']}")
                        print(f"      Details: {issue['details']}")
                        if issue.get("source_id"):
                            print(f"      source_id: {issue['source_id']}")
                        if issue.get("transaction_ids"):
                            print(f"      txn_ids: {issue['transaction_ids']}")
                        print()
    
    # Summary of all issues
    print("\n" + "=" * 70)
    print("ISSUE SUMMARY")
    print("=" * 70)
    
    issue_counts = defaultdict(int)
    for issue in all_issues:
        issue_counts[issue["type"]] += 1
    
    print(f"\nTotal issues found: {len(all_issues)}")
    for issue_type, count in sorted(issue_counts.items(), key=lambda x: -x[1]):
        print(f"  - {issue_type}: {count}")
    
    # Detailed broken source_ids
    print("\n" + "=" * 70)
    print("BROKEN SOURCE_IDS (Requiring Fix)")
    print("=" * 70)
    
    broken_sources = [i for i in all_issues if i["type"] in ["DUPLICATE_ENTRIES", "ORPHAN_ENTRY", "UNBALANCED_PAIR"]]
    if broken_sources:
        for issue in broken_sources[:20]:
            print(f"\n  Type: {issue['type']}")
            print(f"  source_id: {issue.get('source_id', 'N/A')}")
            print(f"  Details: {issue['details']}")
            if issue.get("transaction_ids"):
                print(f"  Transactions: {issue['transaction_ids']}")
    else:
        print("\n  No broken source_ids found.")
    
    client.close()
    print("\n\nDiagnostic complete.")


if __name__ == "__main__":
    main()
