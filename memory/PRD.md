# CRM Finance Module - Product Requirements Document

## Original Problem Statement
Build a full-stack CRM (FastAPI + React + MongoDB) with a custom double-entry accounting engine. The system must enforce strict double-entry compliance where Total Debits = Total Credits.

## Current State (As of March 21, 2026)

### Core Features Implemented
- **Double-Entry Accounting Engine**: `create_double_entry_pair()` in server.py
- **Permission System**: Stable and working
- **Trial Balance**: Direct aggregation from `accounting_transactions` using inflow/outflow mapping
- **General Ledger**: Account-wise transaction history with running balances
- **Daily Closing**: Snapshot calculations using historical transactions
- **Receipts Module**: Customer payment tracking with proper double-entry
- **Liability Management**: Creation and settlement with proper DE pairs
- **Expense Requests**: With approval workflows

### Recent Fixes (March 2026)
1. ✅ **Trial Balance Fix**: Removed flawed `account_type` logic; replaced with direct aggregation
2. ✅ **Liability DE Pairs**: Creation now spawns Expense Debit + AP Credit
3. ✅ **Journal Entry Dates**: Added missing `transaction_date` field
4. ✅ **Date Filtering**: Trial Balance/GL now filter by `transaction_date` with `created_at` fallback
5. ✅ **Financial Quarters**: Corrected to Indian FY (April-June = Q1)
6. ✅ **Daily Closing Balance**: Uses historical transactions, not real-time master balance
7. ✅ **Liability Settlement**: Correctly creates outflow/Debit to Accounts Payable
8. ✅ **Receipt Duplicates**: Safeguards prevent cashbook from generating duplicate DE pairs
9. ✅ **Category Fallback**: All "Unknown" category fallbacks changed to "General"
10. ✅ **Single Source Posting**: Cashbook now BLOCKS customer_payment category; GL/TB filters exclude duplicates

### Known Issues
- **Historical Data Imbalance (₹585,951)**: Pre-March 3, 2026 data is single-entry only
- **Existing Duplicate Entries**: 13 entries totaling ₹1,155,555 need cleanup (script provided)

## Technical Architecture

### Key Files
- `/app/backend/server.py` - Monolithic backend (44,000+ lines)
- `/app/frontend/src/pages/GeneralLedger.jsx` - GL UI
- `/app/backend/scripts/` - Migration and cleanup scripts
  - `cleanup_cashbook_customer_payment_duplicates.py` - Remove duplicate ledger entries

### Database Schema
```
accounting_transactions:
  - transaction_id, transaction_date, created_at
  - account_id, transaction_type ('inflow'/'outflow')
  - amount, entry_role ('primary'/'counter')
  - source_module, category_id
  - paired_transaction_id (links primary ↔ counter)

accounting_categories:
  - category_id, name, type
```

### Double-Entry Logic
- **Assets/Expenses**: Inflow = Debit (Increase), Outflow = Credit (Decrease)
- **Liabilities/Income**: Inflow = Credit (Increase), Outflow = Debit (Decrease)
- **DOUBLE_ENTRY_START_DATE**: March 3, 2026 (cutoff for strict DE enforcement)

### Single Source of Posting Rules
- **Customer Payments**: ONLY created via `/api/finance/receipts`
- **Cashbook** (`/api/accounting/transactions`): Blocks `customer_payment`, `customer_advance`, `receipt` categories
- **GL/TB Queries**: Use `$nor` filter to exclude `{source_module: "cashbook", category_id: "customer_payment"}`

## Backlog

### P0 (Critical)
- [ ] Run cleanup script for existing duplicate entries
- [ ] Create diagnostic script for ₹585,951 historical imbalance
- [ ] Automated pytest tests for finance module

### P1 (High)
- [ ] Complete category system refactor (Cashbook, Expense Entry)
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

## Test Reports
- `/app/test_reports/iteration_85.json` - Duplicate ledger fix verification
