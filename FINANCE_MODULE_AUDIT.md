# 📊 FINANCE CORE MODULE CONNECTIVITY AUDIT
**Date:** March 2, 2026  
**Status:** READ-ONLY AUDIT - NO FIXES APPLIED

---

## 1️⃣ TRIAL BALANCE AUDIT

### Data Sources
| Collection | Used? | Purpose |
|------------|-------|---------|
| `accounting_transactions` | ✅ YES | Primary source - fetches ALL transactions in period |
| `journal_entries` | ❌ NO | **NOT DIRECTLY USED** - only via transactions |
| `party_ledger_entries` | ✅ YES | Party sub-ledger movements (vendor/customer/employee) |
| `finance_accounts` | ✅ YES | Bank/Cash account metadata |
| `accounting_accounts` | ❌ NO | Not queried (uses finance_accounts) |
| `accounting_categories` | ✅ YES | Expense category names |
| `finance_liabilities` | ✅ YES | Open vendor liabilities |
| `party_subledger_accounts` | ✅ YES | Party account metadata |
| `projects` | ✅ YES | Accounts receivable from signoff_value |

### What It INCLUDES
- ✅ All inflow/outflow transactions from `accounting_transactions`
- ✅ Party sub-ledger balances (vendor/customer/employee)
- ✅ Open liabilities from `finance_liabilities`
- ✅ Bank/Cash account movements
- ✅ Expense breakdown by category
- ✅ Project revenue (project-linked inflows)
- ✅ Other income (non-project inflows)

### What It EXCLUDES / GAPS
- ⚠️ **Opening balances** - Uses current balances only, no opening balance query
- ⚠️ **Journal entries** - Not directly queried from `journal_entries` collection
- ⚠️ **Salary transactions** - Only captured if they create `accounting_transactions`
- ⚠️ **Purchase module** - Only if creates `accounting_transactions`

### Calculation Logic
| Component | Formula |
|-----------|---------|
| Asset Debit | Sum of account inflows |
| Asset Credit | Sum of account outflows |
| Liability Debit | Liability payments made |
| Liability Credit | New liabilities created |
| Income Credit | Project + other inflows |
| Expense Debit | All outflows by category |
| Equity | **Balancing figure** (Credit - Debit) |

### Balance Check
- ✅ Checks if Total Debit ≈ Total Credit (within ₹1 tolerance)
- ⚠️ Forces balance via "Retained Earnings / Net Movement" entry

### Backend Function
- **Endpoint:** `GET /api/finance/trial-balance`
- **Function:** `get_trial_balance()` (Line 28529)

---

## 2️⃣ GENERAL LEDGER AUDIT

### Data Sources
| Collection | Used? | Condition |
|------------|-------|-----------|
| `accounting_transactions` | ✅ YES | For bank/cash/category accounts |
| `party_ledger_entries` | ✅ YES | For party sub-ledger accounts |
| `finance_accounts` | ✅ YES | Account metadata lookup |
| `accounting_accounts` | ✅ YES | Fallback account lookup |
| `accounting_categories` | ✅ YES | Category name lookup |
| `party_subledger_accounts` | ✅ YES | Party account detection |

### Account Types Supported
| Type | Source Collection | Running Balance |
|------|-------------------|-----------------|
| Bank/Cash | `accounting_transactions` | Opening + Inflow - Outflow |
| Categories (Expense/Income) | `accounting_transactions` | Opening + Credits - Debits |
| Vendor Sub-ledger | `party_ledger_entries` | Credit increases, Debit decreases |
| Customer Sub-ledger | `party_ledger_entries` | Debit increases, Credit decreases |
| Employee Sub-ledger | `party_ledger_entries` | Credit increases, Debit decreases |

### Opening Balance Calculation
```
Opening = Master Opening Balance + Transactions BEFORE start_date
```

### What It INCLUDES
- ✅ All `accounting_transactions` for the account
- ✅ Party ledger entries (auto-redirects to party GL function)
- ✅ Opening balance from prior transactions
- ✅ Running balance per entry
- ✅ Closing balance

### What It EXCLUDES / GAPS
- ⚠️ **Journal entries** - Only if they created `accounting_transactions`
- ⚠️ **Source module** - Displayed but not filtered

### Backend Functions
- **Endpoint:** `GET /api/finance/general-ledger`
- **Main Function:** `get_general_ledger()` (Line 29643)
- **Party GL Function:** `get_party_general_ledger()` (Line 29847)

---

## 3️⃣ JOURNAL ENTRY AUDIT

### Storage
- **Collection:** `journal_entries`
- **Creates Transactions:** ✅ YES - Creates `accounting_transactions` on post

### Transaction Creation Flow
```
Journal Entry Created
    ↓
For each Debit line:
    → Creates accounting_transaction (type: "outflow", source_module: "journal_entry")
    
For each Credit line:
    → Creates accounting_transaction (type: "inflow", source_module: "journal_entry")
```

### Fields Written to `accounting_transactions`
```json
{
  "transaction_id": "txn_xxx",
  "account_id": "[from JE line]",
  "transaction_type": "inflow/outflow",
  "amount": "[debit/credit amount]",
  "date": "[JE date]",
  "category_id": "journal_entry",
  "source_module": "journal_entry",
  "reference_id": "[JE reference number]",
  "is_daybook_entry": true,
  "je_id": "[parent JE ID]",
  "je_line_id": "[line ID]",
  "is_verified": true
}
```

### Reflects In Other Modules?
| Module | Reflects? | How |
|--------|-----------|-----|
| Trial Balance | ✅ YES | Via `accounting_transactions` query |
| General Ledger | ✅ YES | Via `accounting_transactions` query |
| Daily Closing | ✅ YES | Via `transaction_date` query |
| Daybook | ✅ YES | `is_daybook_entry: true` |

### Double-Entry Enforcement
- ✅ **Validated** - Total Debit must equal Total Credit (within 0.01)
- ✅ **Minimum 2 lines required**
- ✅ **Must have at least 1 debit AND 1 credit**

### Reversal Supported
- ✅ YES - Creates a new JE with swapped debits/credits
- ✅ Marks original as `is_reversed: true`
- ✅ Links via `reversed_by_je` / `reversal_of_je`

### Backend Functions
- **List:** `GET /api/finance/journal-entries` (Line 29159)
- **Create:** `POST /api/finance/journal-entries` (Line 29255)
- **Reverse:** `POST /api/finance/journal-entries/{je_id}/reverse` (Line 29456)

---

## 4️⃣ DAILY CLOSING SNAPSHOT AUDIT

### Data Sources
| Collection | Used? | Purpose |
|------------|-------|---------|
| `accounting_transactions` | ✅ YES | Day's transactions (by `transaction_date`) |
| `accounting_accounts` | ✅ YES | Active bank/cash accounts |
| `accounting_daily_closings` | ✅ YES | Lock status storage |

### What It Calculates
```
For each account:
    Day Net = Inflow - Outflow (from transactions on that day)
    Opening = current_balance - Day Net
    Closing = current_balance
```

### ⚠️ CRITICAL ISSUE: Opening Balance Logic
```python
day_net = acc_inflow - acc_outflow
opening_balance = acc["current_balance"] - day_net  # DERIVED FROM CURRENT!
closing_balance = acc["current_balance"]  # USES CURRENT BALANCE!
```
**Problem:** Opening is calculated backwards from current balance, not from stored opening balance. This will be WRONG if viewing historical dates.

### Exclusions Applied
- ✅ Excludes `is_cashbook_entry: false` entries
- ✅ Excludes `entry_type: purchase_invoice` or `purchase_invoice_credit`

### What It INCLUDES
- ✅ Bank account transactions
- ✅ Cash account transactions
- ✅ Self-transfers (if they create transactions)
- ✅ Journal adjustments (if `is_cashbook_entry` not explicitly false)

### What It EXCLUDES
- ❌ Credit purchase entries (correctly excluded)
- ⚠️ Does NOT query `journal_entries` directly

### Reconciliation with Trial Balance
- ⚠️ **NOT GUARANTEED** - Different query approaches

### Backend Function
- **Endpoint:** `GET /api/accounting/daily-summary/{date}` (Line 23054)
- **Lock Endpoint:** `POST /api/accounting/close-day/{date}` (Line 23123)

---

## 5️⃣ CROSS-MODULE DEPENDENCY MATRIX

| Source Module | Writes To | Creates `accounting_transactions`? | Affects TB? | Affects GL? | Affects Daily? |
|---------------|-----------|-----------------------------------|-------------|-------------|----------------|
| **Cashbook** | `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Journal Entry** | `journal_entries` + `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Salary Payout** | `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Stipend Payout** | `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Incentive Payout** | `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Commission Payout** | `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Self-Transfer** | `accounting_transactions` (2 entries) | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Liability Creation** | `finance_liabilities` | ❌ NO | ✅ Partial* | ❌ NO | ❌ NO |
| **Liability Payment** | `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Purchase Return** | `accounting_transactions` | ✅ YES | ✅ YES | ✅ YES | ✅ YES |
| **Party Sub-Ledger** | `party_ledger_entries` | ❌ NO** | ✅ YES | ✅ YES | ❌ NO |

*Liability creation is queried separately in Trial Balance
**Party entries have separate query path

---

## 6️⃣ IDENTIFIED GAPS

### 🔴 CRITICAL GAPS

| # | Gap | Impact | Location |
|---|-----|--------|----------|
| G1 | **Daily Closing uses CURRENT balance** | Historical views show wrong opening balance | Line 23096-23098 |
| G2 | **No true opening balance tracking** | Opening balances derived, not stored per-period | Trial Balance + GL |

### 🟠 FUNCTIONAL GAPS

| # | Gap | Impact | Location |
|---|-----|--------|----------|
| G3 | Trial Balance doesn't query `journal_entries` directly | JE visible only via accounting_transactions | Line 28613-28622 |
| G4 | Daily Closing doesn't include party sub-ledger | Vendor/customer movements not in daily view | Line 23055 |
| G5 | No cross-collection consistency check | TB and GL can diverge | System-wide |

### 🟡 DATA FLOW GAPS

| # | Gap | Impact |
|---|-----|--------|
| G6 | `finance_accounts` vs `accounting_accounts` - two collections | Potential lookup misses |
| G7 | Party entries don't create `accounting_transactions` | Dual query path required |
| G8 | No stored daily snapshots | Must recalculate on each view |

### 🟢 MINOR GAPS

| # | Gap | Impact |
|---|-----|--------|
| G9 | TB "Retained Earnings" is a balancing figure | Not true equity tracking |
| G10 | No period-end closing journal entries | FY close not automated |

---

## 7️⃣ SUMMARY TABLE

| Module | Data Complete? | Opening Balance? | JE Integration? | Party Integration? |
|--------|----------------|------------------|-----------------|-------------------|
| **Trial Balance** | ⚠️ Partial | ❌ Missing | ✅ Via txns | ✅ YES |
| **General Ledger** | ✅ Good | ✅ Calculated | ✅ Via txns | ✅ YES |
| **Journal Entry** | ✅ Good | N/A | ✅ Creates txns | ❌ NO |
| **Daily Closing** | ⚠️ Partial | ❌ Wrong logic | ✅ Via txns | ❌ NO |

---

## RECOMMENDATIONS (NOT IMPLEMENTED)

1. **G1 Fix:** Store daily opening balances OR query transactions before date
2. **G2 Fix:** Add `opening_balance` field to accounts with period tracking
3. **G4 Fix:** Include party_ledger_entries in daily summary
4. **G6 Fix:** Consolidate to single accounts collection
5. **G7 Fix:** Either create accounting_transactions from party entries OR ensure all queries handle both paths

---

**Audit Complete. Awaiting instruction before any fixes.**
