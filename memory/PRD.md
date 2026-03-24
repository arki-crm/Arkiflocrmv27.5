# CRM Finance Module - Product Requirements Document

## Original Problem Statement
Build a full-stack CRM (FastAPI + React + MongoDB) with a custom double-entry accounting engine. The system must enforce strict double-entry compliance where Total Debits = Total Credits.

## Current State (As of March 24, 2026)

### ✅ P0 SAFETY HARDENING COMPLETE

**100% of production `insert_one` calls to `accounting_transactions` have been replaced with unified atomic functions.**

All accounting writes now go through:
- `create_atomic_double_entry()` - For double-entry transactions
- `create_atomic_single_entry()` - For legacy single entries
- `create_atomic_journal_entries()` - For journal entries

### ✅ Project Financials Pagination Fix (March 24, 2026)

Fixed issue where only 20 transactions were visible in Project Financials → Transactions section:
- Added "Load More" button to progressively load transactions
- Shows count indicator (e.g., "20 of 86")
- "Collapse to 20" option after all loaded
- User can now access ALL project transactions

### ✅ Project Financials Salary Component Fix (March 24, 2026)

Fixed issue where project-linked incentives and commissions were NOT appearing in Actual Cost:
- Added `incentive_payout` and `commission_payout` source_modules to aggregation query
- Only includes PRIMARY entries (avoids double-counting counter entries)
- Maps to user-friendly categories: "Incentive Cost", "Commission Cost"
- Does NOT affect base salary handling (salary_payment excluded)

### Core Features Implemented
- **Double-Entry Accounting Engine**: Enforced at insert level with validation
- **Data Integrity Guards**: Duplicate prevention, entry count validation
- **Smart Routing**: Cashbook guides users to correct modules
- **Diagnostic Tools**: API endpoints to check and fix data integrity

### Modules Fully Refactored (Atomic)

| Module | Source ID Pattern | Status |
|--------|------------------|--------|
| Liability Settlement | `lia_settle_{id}_{hash}` | ✅ |
| Liability Creation | `lia_create_{id}` | ✅ |
| Invoice Payment | `inv_pay_{id}_{hash}` | ✅ |
| Journal Entries | `je_{id}` | ✅ |
| Receipt Cancellation | `rcp_cancel_{id}` | ✅ |
| Salary Payments | `sal_{id}` | ✅ |
| Self-Transfer | `trf_{id}` | ✅ |
| Expense Recording | `exp_record_{id}` | ✅ |
| Expense Refund | `exp_refund_{id}` | ✅ |
| Purchase Return Refund | `pr_refund_{id}_{hash}` | ✅ |
| Purchase Return Reversal | `pr_refund_rev_{id}_{hash}` | ✅ |
| Sales Return Daybook | `sr_daybook_{id}` | ✅ |
| Sales Return Refund | `sr_refund_{id}_{hash}` | ✅ |
| Credit Note Issued | `cn_issued_{id}` | ✅ |
| Debit Note Issued | `dn_issued_{id}` | ✅ |
| Data Import | `import_txn_{id}` | ✅ |

### Production Data Status
- ✅ **25/26 projects balanced** (after diagnostic cleanup)
- ⚠️ **2 minor entries with NULL project_id** (pending user verification)

## Backlog

### P0 (Critical) - COMPLETED ✅
- [x] Add insert-level duplicate guards
- [x] Add post-insert validation
- [x] Create data integrity API
- [x] Strict Atomic Flow for all accounting writes
- [x] 100% coverage of `insert_one` replacement

### P1 (High) - NEXT
- [ ] Remove GL/TB filter-based masking (production data is now clean)
- [ ] Remove `/mongo-debug` endpoints from production (security risk)
- [ ] Add automated pytest tests for finance module
- [ ] Split server.py into modules (~46k lines)

### P2 (Medium)
- [ ] Complete category system refactor (work_type, sub_category)
- [ ] Security fixes (debug endpoint exposure, API versioning)
- [ ] Quotation Builder Module

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

### Safety Guarantees
1. **Idempotency**: Each transaction has unique `source_id` - duplicate calls safely skipped
2. **Atomicity**: Both entries inserted together via `insert_many()` - all or nothing
3. **Validation**: Post-insert check ensures exactly 2 entries exist
4. **Traceability**: Both entries share `source_id` and `paired_transaction_id`
5. **Auditability**: Failed validations flag entries with `needs_audit: true`

### Database Indexes (Auto-created on startup)
- `source_id`
- `receipt_id`
- `reference_id`
- `paired_transaction_id`
- Compound: `(source_id, entry_role)`

## Credentials (Testing)
- Founder: `sidheeq.arkidots@gmail.com` / `founder123`

## Deployment Instructions

See `/app/backend/SAFETY_HARDENING_STATUS.md` for detailed production deployment steps.
