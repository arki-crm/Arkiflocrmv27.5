# Double-Entry Review Report
**Date:** March 5, 2026

## Modules Requiring Double-Entry Review

Based on the audit, these modules create `accounting_transactions` entries but do NOT create double-entry pairs:

---

### 1. Liability Settlement (`settle_liability`)
**Location:** Line ~28568
**Current:** Single outflow entry (cash payment)

**Expected Double-Entry:**
| Entry | Account | Debit | Credit |
|-------|---------|-------|--------|
| Primary | Cash/Bank (Asset) | | ₹X |
| Counter | Accounts Payable (Liability) | ₹X | |

**Analysis:** When we pay a vendor, we should:
- Credit the bank (reduce asset)
- Debit the liability (reduce what we owe)

**Status:** ⚠️ NEEDS FIX

---

### 2. Recurring Payments (`record_recurring_payment`)
**Location:** Line ~38320
**Current:** Single outflow entry

**Expected Double-Entry:**
| Entry | Account | Debit | Credit |
|-------|---------|-------|--------|
| Primary | Cash/Bank (Asset) | | ₹X |
| Counter | Expense Category | ₹X | |

**Analysis:** Recurring payments (rent, subscriptions) should:
- Credit the bank (reduce asset)
- Debit the expense category

**Status:** ⚠️ NEEDS FIX

---

### 3. Sales Return Refund (`update_sales_return_refund`)
**Location:** Line ~40197
**Current:** Single outflow entry

**Expected Double-Entry:**
| Entry | Account | Debit | Credit |
|-------|---------|-------|--------|
| Primary | Cash/Bank (Asset) | | ₹X |
| Counter | Sales Returns (Contra-Revenue) | ₹X | |

**Analysis:** When we refund a customer:
- Credit the bank (money going out)
- Debit sales returns (reduce revenue)

**Status:** ⚠️ NEEDS FIX

---

### 4. Credit Note (`create_credit_note`)
**Location:** Line ~40757
**Current:** Single daybook entry

**Expected Double-Entry:**
| Entry | Account | Debit | Credit |
|-------|---------|-------|--------|
| Primary | Customer Advance (Liability) | ₹X | |
| Counter | Sales/Revenue | | ₹X |

**Analysis:** Credit notes represent money owed to customer:
- This is a daybook entry (not cashbook)
- May not need double-entry as it's a memo item

**Status:** ⚠️ REVIEW - Daybook entry may be OK

---

### 5. Debit Note (`create_debit_note`)
**Location:** Line ~40873
**Current:** Single daybook entry

**Expected Double-Entry:**
| Entry | Account | Debit | Credit |
|-------|---------|-------|--------|
| Primary | Accounts Receivable | ₹X | |
| Counter | Vendor Returns | | ₹X |

**Analysis:** Debit notes represent money owed from vendor:
- This is a daybook entry
- May not need double-entry as it's a memo item

**Status:** ⚠️ REVIEW - Daybook entry may be OK

---

## Additional Single-Entry Modules (Lower Priority)

### 6. Self Transfer (from/to entries)
- Creates TWO entries (from and to accounts)
- This IS balanced inherently
- **Status:** ✅ OK

### 7. Import Transactions
- Legacy data import
- Does not require double-entry (historical data)
- **Status:** ✅ OK (legacy)

### 8. Cash Disbursement
- Petty cash disbursement
- Should ideally have double-entry
- **Status:** ⚠️ REVIEW

---

## Recommended Fixes

### Priority 1: Liability Settlement
This is a core accounting function - vendor payments MUST be properly recorded.

### Priority 2: Recurring Payments
These are regular expenses and should have proper double-entry.

### Priority 3: Sales Return Refund
Customer refunds should be properly tracked.

### Lower Priority: Credit/Debit Notes
These are daybook entries and may be acceptable as single-entry memos.
