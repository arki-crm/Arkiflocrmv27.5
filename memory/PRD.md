# CRM Finance Module - Product Requirements Document

## Original Problem Statement
Build a full-stack CRM (FastAPI + React + MongoDB) with a custom double-entry accounting engine. The system must enforce strict double-entry compliance where Total Debits = Total Credits.

## Current State (As of March 23, 2026)

### Core Features Implemented
- **Double-Entry Accounting Engine**: `create_double_entry_pair()` in server.py
- **Permission System**: Stable and working
- **Trial Balance**: Direct aggregation from `accounting_transactions` using inflow/outflow mapping
- **General Ledger**: Account-wise transaction history with running balances
- **Daily Closing**: Snapshot calculations using historical transactions
- **Receipts Module**: Customer payment tracking with proper double-entry
- **Liability Management**: Creation and settlement with proper DE pairs
- **Expense Requests**: With approval workflows
- **Smart Routing**: Cashbook guides users to correct modules

### Recent Fixes (March 2026)
1. ✅ **Trial Balance Fix**: Removed flawed `account_type` logic
2. ✅ **Liability DE Pairs**: Creation now spawns Expense Debit + AP Credit
3. ✅ **Journal Entry Dates**: Added missing `transaction_date` field
4. ✅ **Date Filtering**: Trial Balance/GL now filter by `transaction_date`
5. ✅ **Financial Quarters**: Corrected to Indian FY (April-June = Q1)
6. ✅ **Daily Closing Balance**: Uses historical transactions
7. ✅ **Liability Settlement**: Correctly creates outflow/Debit to AP
8. ✅ **Receipt Duplicates**: Backend blocks customer_payment in Cashbook
9. ✅ **Category Fallback**: All "Unknown" → "General"
10. ✅ **Single Source Posting**: GL/TB filters exclude duplicate entries
11. ✅ **Smart Routing UI**: Cashbook guides users to Receipts for customer payments

### Accounting Architecture (Enforced)
```
┌─────────────────────────────────────────────────────────────────┐
│                    POSTING SOURCES                               │
│  (Where transactions are CREATED)                                │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│  Receipts   │  Payments   │  Expenses   │  Invoices   │ Journal │
│  (Customer) │  (Vendor)   │  (Direct)   │  (Sales)    │ Entries │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       └─────────────┴─────────────┴─────────────┴───────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │    GENERAL LEDGER      │
                 │  (Single Source of     │
                 │       Truth)           │
                 └────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  CASHBOOK   │       │  TRIAL      │       │  P&L /      │
│  (VIEW)     │       │  BALANCE    │       │  Balance    │
└─────────────┘       └─────────────┘       └─────────────┘
```

### Known Issues
- **Historical Data Imbalance (₹585,951)**: Pre-March 3, 2026 data is single-entry only

## Technical Architecture

### Key Files
- `/app/backend/server.py` - Monolithic backend (45,000+ lines)
- `/app/frontend/src/pages/CashBook.jsx` - Smart routing UI
- `/app/frontend/src/pages/Receipts.jsx` - Customer payment entry
- `/app/backend/scripts/` - Migration and cleanup scripts

### Database Schema
```
accounting_transactions:
  - transaction_id, transaction_date, created_at
  - account_id, transaction_type ('inflow'/'outflow')
  - amount, entry_role ('primary'/'counter')
  - source_module, category_id
  - paired_transaction_id

accounting_categories:
  - category_id, name, type
```

### Double-Entry Logic
- **Assets/Expenses**: Inflow = Debit, Outflow = Credit
- **Liabilities/Income**: Inflow = Credit, Outflow = Debit
- **DOUBLE_ENTRY_START_DATE**: March 3, 2026

### Single Source of Posting Filter (in GL/TB)
```python
query["$nor"] = [
    {"source_module": "cashbook", "category_id": "customer_payment"},
    {"source_module": {"$in": [None, "unknown"]}, "category_id": "customer_payment"},
    {"source_module": {"$exists": False}, "category_id": "customer_payment"}
]
```

## Backlog

### P0 (Critical)
- [ ] Create diagnostic script for ₹585,951 historical imbalance
- [ ] Automated pytest tests for finance module

### P1 (High)
- [ ] Complete category system refactor (Expense Entry)
- [ ] Split server.py into feature modules

### P2 (Medium)
- [ ] Security fixes (debug endpoint exposure, API versioning)
- [ ] Quotation Builder Module

### P3 (Low)
- [ ] Full logistics status lifecycle UI for Purchase Returns

## Integrations
- Google Auth (Emergent-managed)

## Credentials (Testing)
- Founder: `sidheeq.arkidots@gmail.com` / `founder123`
