# CRM Finance Module - Product Requirements Document

## Original Problem Statement
Build a full-stack CRM (FastAPI + React + MongoDB) with a custom double-entry accounting engine. The system must enforce strict double-entry compliance where Total Debits = Total Credits.

## Current State (As of March 23, 2026)

### Core Features Implemented
- **Double-Entry Accounting Engine**: Enforced at insert level with validation
- **Data Integrity Guards**: Duplicate prevention, entry count validation
- **Smart Routing**: Cashbook guides users to correct modules
- **Diagnostic Tools**: API endpoints to check and fix data integrity

### P0 Fix Completed (March 23, 2026)
**Strict Atomic Double-Entry for Purchase Invoices and Payment Settlements**

1. **Liability Settlement** (`/api/finance/liabilities/{id}/settle`)
   - Idempotency: Unique `source_id` = `lia_settle_{liability_id}_{timestamp_hash}`
   - Atomic: Uses `insert_many([primary, counter])`
   - Validation: Post-insert check ensures exactly 2 entries
   - Contract: Dr Vendor Payable (outflow) / Cr Bank (outflow)

2. **Invoice Payment** (`/api/finance/execution-ledger/{id}/record-payment`)
   - Idempotency: Unique `source_id` = `inv_pay_{execution_id}_{timestamp_hash}`
   - Atomic: Uses `insert_many([primary, counter])`
   - Validation: Post-insert check ensures exactly 2 entries
   - Contract: Dr Vendor Payable (outflow) / Cr Bank (outflow)

3. **Liability Creation** (`/api/finance/liabilities`)
   - Idempotency: Unique `source_id` = `lia_create_{liability_id}`
   - Atomic: Uses `insert_many([primary, counter])`
   - Validation: Post-insert check ensures exactly 2 entries
   - Contract: Dr Expense (outflow) / Cr Accounts Payable (inflow)

### Data Integrity Features
1. **Insert-Level Guards**
   - `create_double_entry_pair()` checks source_id count before creating counter
   - Receipt creation validates exactly 2 entries created
   - Database indexes for fast duplicate detection

2. **Diagnostic API**
   - `GET /api/finance/data-integrity` - Full system diagnosis
   - `POST /api/finance/data-integrity/fix` - Auto-fix issues

3. **Verified Behavior**
   - New receipt → exactly 2 entries (Dr Bank, Cr Customer Advance)
   - Post-insert validation logs errors if count != 2

### Historical Data Issues (To Be Fixed)
Based on `/api/finance/data-integrity`:
- **Global imbalance**: ₹595,105.99 (debits > credits)
- **29 orphan counter entries** - counter without primary
- **5 duplicate sources** - 3+ entries per receipt
- **8 unbalanced pairs** - execution costs with wrong types

### Fix Scripts
- `/app/backend/scripts/fix_accounting_data.py` - Targeted production fix
- `/app/backend/scripts/fix_historical_imbalance.py` - Comprehensive diagnostic

## Technical Architecture

### Double-Entry Logic
```
Receipt Created:
1. Primary Entry: Dr Bank (inflow) ← Asset increases
2. Counter Entry: Cr Customer Advance (outflow) ← Liability increases

Both entries have:
- Same amount
- Same source_id/reference_id  
- entry_role: 'primary' / 'counter'
- paired_transaction_id: links to each other
```

### Safeguards in Code
```python
# In create_double_entry_pair():
# 1. Check if counter already exists by paired_transaction_id
# 2. Check if source_id already has 2+ entries
# 3. Return existing counter_id if found (no duplicate)

# In create_receipt():
# 1. Check existing_entries before insert
# 2. Post-insert validation: count == 2
# 3. Log to accounting_integrity_errors if mismatch
```

### Database Indexes (Auto-created on startup)
- `source_id`
- `receipt_id`
- `reference_id`
- `paired_transaction_id`
- Compound: `(source_id, entry_role)`

## Backlog

### P0 (Critical) - COMPLETED
- [x] Add insert-level duplicate guards
- [x] Add post-insert validation
- [x] Create data integrity API
- [x] **Strict Atomic Flow for Purchase Invoices & Settlements** (March 23, 2026)
  - Idempotency checks with unique source_id
  - Atomic insert_many for entry pairs
  - Post-insert validation (exactly 2 entries)
- [ ] Run fix script on production data (User action needed)
- [x] Add pytest tests for double-entry

### P1 (High)
- [ ] Remove GL/TB filter-based masking after production data cleanup
- [ ] Production Project Financials crash (PM2 `jose` module missing - user environment issue)
- [ ] Split server.py into modules (~45k lines)

### P2 (Medium)
- [ ] Complete category system refactor (work_type, sub_category)
- [ ] Security fixes (debug endpoint exposure, API versioning)
- [ ] Quotation Builder Module

## Credentials (Testing)
- Founder: `sidheeq.arkidots@gmail.com` / `founder123`

## Production Fix Commands
```bash
# On production server:
cd ~/arkiflo/backend

# 1. Preview fixes
python3 scripts/fix_accounting_data.py --dry-run

# 2. Apply fixes
python3 scripts/fix_accounting_data.py --execute

# 3. Verify via API
curl -X GET "https://your-domain/api/finance/data-integrity" -H "Cookie: ..."
```
