"""
Historical Data Backfill Script for Party Metadata
===================================================

This script populates party_id, party_type, and party_name for historical 
accounting_transactions that are missing these fields.

Run from: /app/backend/
Command: python3 backfill_party_metadata.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "arkidots")

async def backfill_party_metadata():
    """Main backfill function"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("PARTY METADATA BACKFILL SCRIPT")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    print()
    
    # Statistics
    stats = {
        "total_transactions": 0,
        "missing_party": 0,
        "updated_receipt": 0,
        "updated_salary": 0,
        "updated_vendor": 0,
        "updated_expense": 0,
        "updated_other": 0,
        "skipped": 0,
        "errors": 0
    }
    
    # Get all transactions missing party_id
    transactions = await db.accounting_transactions.find({
        "$or": [
            {"party_id": {"$exists": False}},
            {"party_id": None}
        ]
    }).to_list(100000)
    
    stats["total_transactions"] = await db.accounting_transactions.count_documents({})
    stats["missing_party"] = len(transactions)
    
    print(f"Total transactions: {stats['total_transactions']}")
    print(f"Missing party metadata: {stats['missing_party']}")
    print()
    
    # Build lookup caches
    print("Building lookup caches...")
    
    # Cache receipts
    receipts_cache = {}
    receipts = await db.finance_receipts.find({}, {"_id": 0, "receipt_id": 1, "project_id": 1}).to_list(10000)
    for r in receipts:
        receipts_cache[r.get("receipt_id")] = r
    print(f"  Receipts cached: {len(receipts_cache)}")
    
    # Cache projects (for customer info)
    projects_cache = {}
    projects = await db.projects.find({}, {"_id": 0, "project_id": 1, "customer_id": 1, "client_name": 1}).to_list(10000)
    for p in projects:
        projects_cache[p.get("project_id")] = p
    print(f"  Projects cached: {len(projects_cache)}")
    
    # Cache customers
    customers_cache = {}
    customers = await db.customers.find({}, {"_id": 0, "customer_id": 1, "client_name": 1}).to_list(10000)
    for c in customers:
        customers_cache[c.get("customer_id")] = c
    print(f"  Customers cached: {len(customers_cache)}")
    
    # Cache vendors
    vendors_cache = {}
    vendors = await db.finance_vendors.find({}, {"_id": 0, "vendor_id": 1, "vendor_name": 1}).to_list(10000)
    for v in vendors:
        vendors_cache[v.get("vendor_id")] = v
    print(f"  Vendors cached: {len(vendors_cache)}")
    
    # Cache liabilities (for vendor info)
    liabilities_cache = {}
    liabilities = await db.finance_liabilities.find({}, {"_id": 0, "liability_id": 1, "vendor_id": 1, "vendor_name": 1}).to_list(10000)
    for l in liabilities:
        liabilities_cache[l.get("liability_id")] = l
    print(f"  Liabilities cached: {len(liabilities_cache)}")
    
    # Cache salary payments (for employee info)
    salary_cache = {}
    salaries = await db.salary_payments.find({}, {"_id": 0, "payment_id": 1, "employee_id": 1}).to_list(10000)
    for s in salaries:
        salary_cache[s.get("payment_id")] = s
    print(f"  Salary payments cached: {len(salary_cache)}")
    
    # Cache salary masters (for employee names)
    salary_masters_cache = {}
    salary_masters = await db.salary_masters.find({}, {"_id": 0, "employee_id": 1, "employee_name": 1}).to_list(1000)
    for sm in salary_masters:
        salary_masters_cache[sm.get("employee_id")] = sm
    print(f"  Salary masters cached: {len(salary_masters_cache)}")
    
    # Cache team members (for employee info)
    team_cache = {}
    team = await db.team_members.find({}, {"_id": 0, "user_id": 1, "name": 1}).to_list(1000)
    for t in team:
        team_cache[t.get("user_id")] = t
    print(f"  Team members cached: {len(team_cache)}")
    
    # Cache execution ledger (for vendor info)
    execution_cache = {}
    executions = await db.execution_ledger.find({}, {"_id": 0, "execution_id": 1, "vendor_id": 1, "vendor_name": 1}).to_list(10000)
    for e in executions:
        execution_cache[e.get("execution_id")] = e
    print(f"  Execution entries cached: {len(execution_cache)}")
    
    # Cache expense requests (for project/employee)
    expense_cache = {}
    expenses = await db.finance_expense_requests.find({}, {"_id": 0, "request_id": 1, "project_id": 1, "created_by": 1}).to_list(10000)
    for e in expenses:
        expense_cache[e.get("request_id")] = e
    print(f"  Expense requests cached: {len(expense_cache)}")
    
    # Cache incentives
    incentive_cache = {}
    incentives = await db.incentives.find({}, {"_id": 0, "incentive_id": 1, "employee_id": 1, "employee_name": 1}).to_list(10000)
    for i in incentives:
        incentive_cache[i.get("incentive_id")] = i
    print(f"  Incentives cached: {len(incentive_cache)}")
    
    # Cache commissions
    commission_cache = {}
    commissions = await db.commissions.find({}, {"_id": 0, "commission_id": 1, "recipient_id": 1, "recipient_name": 1, "recipient_type": 1}).to_list(10000)
    for c in commissions:
        commission_cache[c.get("commission_id")] = c
    print(f"  Commissions cached: {len(commission_cache)}")
    
    print()
    print("Processing transactions...")
    print()
    
    # Process each transaction
    for i, txn in enumerate(transactions):
        if i % 100 == 0 and i > 0:
            print(f"  Processed {i}/{len(transactions)}...")
        
        try:
            txn_id = txn.get("transaction_id")
            update_data = None
            
            # 1. Check if it's a receipt-linked transaction
            receipt_id = txn.get("receipt_id")
            if receipt_id:
                receipt = receipts_cache.get(receipt_id)
                if receipt:
                    project_id = receipt.get("project_id") or txn.get("project_id")
                    project = projects_cache.get(project_id)
                    if project:
                        update_data = {
                            "party_id": project.get("customer_id"),
                            "party_type": "customer",
                            "party_name": project.get("client_name")
                        }
                        stats["updated_receipt"] += 1
            
            # 2. Check if it's a liability settlement (vendor payment)
            if not update_data and txn.get("reference_type") == "liability_settlement":
                liability_id = txn.get("liability_id") or txn.get("reference_id")
                if liability_id:
                    liability = liabilities_cache.get(liability_id)
                    if liability:
                        update_data = {
                            "party_id": liability.get("vendor_id"),
                            "party_type": "vendor",
                            "party_name": liability.get("vendor_name")
                        }
                        stats["updated_vendor"] += 1
            
            # 3. Check if it has vendor_id directly
            if not update_data and txn.get("vendor_id"):
                vendor = vendors_cache.get(txn.get("vendor_id"))
                vendor_name = txn.get("paid_to") or (vendor.get("vendor_name") if vendor else None)
                if vendor_name:
                    update_data = {
                        "party_id": txn.get("vendor_id"),
                        "party_type": "vendor",
                        "party_name": vendor_name
                    }
                    stats["updated_vendor"] += 1
            
            # 4. Check if it's a salary payment
            if not update_data and txn.get("reference_type") == "salary_payment":
                payment_id = txn.get("reference_id") or txn.get("source_id")
                employee_id = txn.get("employee_id")
                employee_name = txn.get("employee_name")
                
                if not employee_id and payment_id:
                    salary = salary_cache.get(payment_id)
                    if salary:
                        employee_id = salary.get("employee_id")
                
                if employee_id:
                    if not employee_name:
                        master = salary_masters_cache.get(employee_id)
                        if master:
                            employee_name = master.get("employee_name")
                        else:
                            team_member = team_cache.get(employee_id)
                            if team_member:
                                employee_name = team_member.get("name")
                    
                    update_data = {
                        "party_id": employee_id,
                        "party_type": "employee",
                        "party_name": employee_name or "Employee"
                    }
                    stats["updated_salary"] += 1
            
            # 5. Check if it's a stipend payment
            if not update_data and txn.get("reference_type") == "stipend_payment":
                employee_id = txn.get("employee_id")
                employee_name = txn.get("paid_to")
                if employee_id:
                    update_data = {
                        "party_id": employee_id,
                        "party_type": "employee",
                        "party_name": employee_name or "Trainee"
                    }
                    stats["updated_salary"] += 1
            
            # 6. Check if it's an incentive payout
            if not update_data and txn.get("reference_type") == "incentive_payout":
                employee_id = txn.get("employee_id")
                employee_name = txn.get("employee_name") or txn.get("paid_to")
                incentive_id = txn.get("source_id")
                
                if not employee_id and incentive_id:
                    incentive = incentive_cache.get(incentive_id)
                    if incentive:
                        employee_id = incentive.get("employee_id")
                        employee_name = employee_name or incentive.get("employee_name")
                
                if employee_id:
                    update_data = {
                        "party_id": employee_id,
                        "party_type": "employee",
                        "party_name": employee_name or "Employee"
                    }
                    stats["updated_salary"] += 1
            
            # 7. Check if it's a commission payout
            if not update_data and txn.get("reference_type") == "commission_payout":
                recipient_id = txn.get("recipient_id")
                recipient_name = txn.get("recipient_name") or txn.get("paid_to")
                commission_id = txn.get("source_id")
                
                if not recipient_id and commission_id:
                    commission = commission_cache.get(commission_id)
                    if commission:
                        recipient_id = commission.get("recipient_id")
                        recipient_name = recipient_name or commission.get("recipient_name")
                        recipient_type = commission.get("recipient_type", "vendor")
                
                if recipient_id:
                    update_data = {
                        "party_id": recipient_id,
                        "party_type": recipient_type if 'recipient_type' in dir() else "vendor",
                        "party_name": recipient_name or "Recipient"
                    }
                    stats["updated_other"] += 1
            
            # 8. Check if it's a purchase invoice / execution ledger entry
            if not update_data and txn.get("reference_type") == "execution_ledger":
                execution_id = txn.get("reference_id")
                if execution_id:
                    execution = execution_cache.get(execution_id)
                    if execution:
                        update_data = {
                            "party_id": execution.get("vendor_id"),
                            "party_type": "vendor",
                            "party_name": execution.get("vendor_name")
                        }
                        stats["updated_vendor"] += 1
            
            # 9. Check if it's an expense request
            if not update_data and txn.get("source_type") in ["expense_request", "expense_refund"]:
                request_id = txn.get("source_id")
                if request_id:
                    expense = expense_cache.get(request_id)
                    if expense:
                        # For expenses, we use the project's customer if available
                        project_id = expense.get("project_id") or txn.get("project_id")
                        if project_id:
                            project = projects_cache.get(project_id)
                            if project and project.get("customer_id"):
                                update_data = {
                                    "party_id": project.get("customer_id"),
                                    "party_type": "customer",
                                    "party_name": project.get("client_name")
                                }
                                stats["updated_expense"] += 1
            
            # 10. Fallback: Try to get customer from project_id
            if not update_data and txn.get("project_id"):
                project = projects_cache.get(txn.get("project_id"))
                if project and project.get("customer_id"):
                    # Only for inflows (customer payments)
                    if txn.get("transaction_type") == "inflow" and txn.get("category_id") == "customer_payment":
                        update_data = {
                            "party_id": project.get("customer_id"),
                            "party_type": "customer",
                            "party_name": project.get("client_name")
                        }
                        stats["updated_other"] += 1
            
            # Apply update if we found party info
            if update_data:
                # Filter out None values
                update_data = {k: v for k, v in update_data.items() if v is not None}
                
                if update_data:
                    await db.accounting_transactions.update_one(
                        {"transaction_id": txn_id},
                        {"$set": update_data}
                    )
            else:
                stats["skipped"] += 1
                
        except Exception as e:
            stats["errors"] += 1
            print(f"  Error processing {txn.get('transaction_id')}: {e}")
    
    # Print summary
    print()
    print("=" * 60)
    print("BACKFILL COMPLETE")
    print("=" * 60)
    print(f"Completed at: {datetime.now().isoformat()}")
    print()
    print("Statistics:")
    print(f"  Total transactions in DB: {stats['total_transactions']}")
    print(f"  Missing party metadata:   {stats['missing_party']}")
    print()
    print("Updates by type:")
    print(f"  Receipt (customer):       {stats['updated_receipt']}")
    print(f"  Vendor payments:          {stats['updated_vendor']}")
    print(f"  Salary/Stipend/Incentive: {stats['updated_salary']}")
    print(f"  Expense requests:         {stats['updated_expense']}")
    print(f"  Other:                    {stats['updated_other']}")
    print()
    total_updated = stats['updated_receipt'] + stats['updated_vendor'] + stats['updated_salary'] + stats['updated_expense'] + stats['updated_other']
    print(f"  Total updated:            {total_updated}")
    print(f"  Skipped (no party info):  {stats['skipped']}")
    print(f"  Errors:                   {stats['errors']}")
    print()
    
    # Close connection
    client.close()
    
    return stats


if __name__ == "__main__":
    asyncio.run(backfill_party_metadata())
