# Finance Module User Manual
## Complete Operator Training Guide for Arkiflo Finance System

**Version:** 1.0  
**Last Updated:** February 2026  
**Audience:** Finance Team, Accountants, Managers, Admin Staff

---

# Table of Contents

1. [Introduction](#introduction)
2. [Finance Overview Dashboard](#finance-overview-dashboard)
3. [Cashbook](#cashbook)
4. [Daybook](#daybook)
5. [Project Finance](#project-finance)
6. [Payment Schedule](#payment-schedule)
7. [Vendor Mapping & Budget Control](#vendor-mapping--budget-control)
8. [Purchase Invoice](#purchase-invoice)
9. [Purchase Returns](#purchase-returns)
10. [Salary Management](#salary-management)
11. [Incentives](#incentives)
12. [Commissions](#commissions)
13. [Account Management](#account-management)
14. [Permission & Role Governance](#permission--role-governance)
15. [Diagnostics & Audit Guide](#diagnostics--audit-guide)
16. [Quick Reference Tables](#quick-reference-tables)
17. [Troubleshooting Guide](#troubleshooting-guide)

---

# Introduction

## What is the Finance Module?

The Finance Module in Arkiflo is the complete financial management system for interior design projects. It handles all money-related activities from client payments to vendor expenses, staff salaries to profit tracking.

## Who Uses This Module?

| Role | Primary Tasks |
|------|---------------|
| Junior Accountant | Daily entries, payment recording |
| Senior Accountant | Invoice processing, reconciliation |
| Finance Manager | Approval, oversight, profit analysis |
| Admin/Founder | Full control, governance decisions |

## Key Principle: Single Source of Truth

**IMPORTANT:** All financial data flows through ONE system. Never maintain parallel Excel sheets. The system is designed to be your only financial record.

---

# Finance Overview Dashboard

## 1️⃣ Purpose

The Finance Overview is your daily command center. It shows the financial health of the entire organization at a glance.

**Business Problem Solved:** Without this dashboard, you would need to check multiple reports to understand if the company is profitable, has enough cash, or has pending liabilities.

## 2️⃣ Accounting Meaning

| Metric | Accounting Classification |
|--------|--------------------------|
| Total Revenue | Income (Credit in P&L) |
| Total Expenses | Expense (Debit in P&L) |
| Net Profit | Revenue - Expenses |
| Cash Balance | Current Asset |
| Bank Balance | Current Asset |
| Pending Liabilities | Current Liability |

## 3️⃣ Plain English Meaning

Think of this as your daily financial health checkup:
- **Revenue** = Money clients have paid us
- **Expenses** = Money we've spent (on vendors, salaries, materials)
- **Profit** = What's left after paying everyone
- **Cash/Bank Balance** = How much money we actually have right now
- **Liabilities** = Money we owe to vendors but haven't paid yet

## 4️⃣ How to Use — Step-by-Step

```
Step 1: Go to Finance → Overview
Step 2: Review the summary cards at the top
Step 3: Check "Today's Transactions" for recent activity
Step 4: Review "Pending Approvals" if you're a manager
Step 5: Check "Low Balance Alerts" for accounts needing attention
```

## 5️⃣ Scenario Example

**Morning Review Routine:**

Finance Manager Priya starts her day:
1. Opens Finance Overview
2. Sees Bank Balance: ₹5,20,000 | Cash Balance: ₹45,000
3. Notices Pending Liabilities: ₹2,30,000
4. Realizes: "We have enough to pay vendors today"
5. Checks Today's Inflows: ₹1,50,000 received from Project ABC
6. Plans the day's vendor payments accordingly

## 6️⃣ Reflection Mapping

| What You See | Where Data Comes From |
|--------------|----------------------|
| Total Revenue | Sum of all Cashbook Inflows |
| Total Expenses | Sum of all Cashbook Outflows |
| Pending Liabilities | Unpaid Purchase Invoices |
| Project Profits | Project Finance calculations |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Why is profit showing high but bank balance is low?"
✅ **Explanation:** Profit includes unpaid client invoices. Cash only shows what's actually received.

❌ **Mistake:** "Liability shows ₹0 but I know we owe vendors"
✅ **Resolution:** Check if Purchase Invoices were entered. Liability only shows from formal invoice entries, not verbal commitments.

---

# Cashbook

## 1️⃣ Purpose

The Cashbook is the master record of ALL actual money movement — every rupee that enters or leaves your accounts.

**Business Problem Solved:** Tracks real cash flow. Without this, you wouldn't know how much money you actually have or where it went.

## 2️⃣ Accounting Meaning

| Entry Type | Accounting Treatment |
|------------|---------------------|
| Inflow (Client Payment) | Debit: Bank/Cash, Credit: Revenue |
| Outflow (Expense Payment) | Debit: Expense, Credit: Bank/Cash |
| Internal Transfer | Debit: Destination Account, Credit: Source Account |

**Ledger Impact:** Every Cashbook entry directly affects your Bank/Cash ledger and the corresponding Income/Expense account.

## 3️⃣ Plain English Meaning

- **Inflow** = Money coming IN (client pays us)
- **Outflow** = Money going OUT (we pay someone)
- **Transfer** = Moving money between our own accounts (Bank → Cash)

**Real Life:** When client Mr. Sharma pays ₹50,000 for his project, you record an INFLOW. When you pay the carpenter ₹20,000, you record an OUTFLOW.

## 4️⃣ How to Use — Step-by-Step

### Recording a Client Payment (Inflow)

```
Step 1: Go to Finance → Cashbook
Step 2: Click "New Entry" button (top right)
Step 3: Select Type: "Inflow"
Step 4: Fill the form:
        - Date: Today's date
        - Amount: ₹50,000
        - Account: Select bank account (e.g., "HDFC Current Account")
        - Category: "Client Payment"
        - Project: Link to the correct project (e.g., "Sharma Residence")
        - Mode: Bank Transfer / UPI / Cheque / Cash
        - Reference: UTR number or cheque number
        - Remarks: "Design milestone payment"
Step 5: Click "Save Entry"
Step 6: Entry appears in the transaction list immediately
```

### Recording an Expense (Outflow)

```
Step 1: Finance → Cashbook → New Entry
Step 2: Select Type: "Outflow"
Step 3: Fill the form:
        - Date: Payment date
        - Amount: ₹20,000
        - Account: From which account you paid
        - Category: "Material Purchase" / "Contractor Payment" / etc.
        - Project: Link to project (IMPORTANT for cost tracking)
        - Vendor: Select vendor name
        - Mode: How you paid
        - Reference: Receipt/Bill number
        - Remarks: Description of expense
Step 4: Save Entry
```

### Recording Internal Transfer

```
Step 1: Finance → Cashbook → New Entry
Step 2: Select Type: "Transfer"
Step 3: Fill:
        - From Account: "HDFC Current"
        - To Account: "Petty Cash"
        - Amount: ₹10,000
        - Reference: Withdrawal slip number
Step 4: Save
```

## 5️⃣ Scenario Example

**Daily Office Scenario:**

Morning 10 AM:
- Client deposits ₹1,50,000 (Project: Mehta Villa) → Record INFLOW

Afternoon 2 PM:
- Paid plywood vendor ₹45,000 → Record OUTFLOW (Link to Mehta Villa)

Evening 5 PM:
- Withdrew ₹5,000 from bank for petty cash → Record TRANSFER

**Day's Summary:**
- Inflows: ₹1,50,000
- Outflows: ₹45,000
- Net Cash Flow: +₹1,05,000

## 6️⃣ Reflection Mapping

| Cashbook Entry | Reflects In |
|----------------|------------|
| Client Payment (Inflow) | ✅ Cashbook ✅ Project Finance (Received) ✅ Profit Calculation |
| Vendor Payment (Outflow) | ✅ Cashbook ✅ Project Finance (Actual Cost) ✅ Profit Calculation |
| Salary Payment (Outflow) | ✅ Cashbook ✅ Salary Records ❌ Project Finance (unless linked) |
| Internal Transfer | ✅ Cashbook ✅ Both Account Balances ❌ P&L (neutral) |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "I recorded vendor payment but Project Finance still shows ₹0 actual cost"
✅ **Resolution:** Did you link the expense to a Project? Unlinked expenses don't appear in Project Finance.

❌ **Mistake:** "Transfer shows as both inflow and outflow"
✅ **Explanation:** This is correct! Transfer is inflow to one account and outflow from another. Net effect is zero on company cash.

❌ **Mistake:** "Duplicate entries appearing"
✅ **Prevention:** Before entering, search for existing entry. System doesn't block duplicates automatically.

---

# Daybook

## 1️⃣ Purpose

The Daybook is the chronological record of ALL financial activities, including non-cash transactions like credit purchases.

**Business Problem Solved:** Not all transactions involve immediate cash. When you buy materials on credit, money hasn't moved yet, but you have an obligation. Daybook captures this.

## 2️⃣ Accounting Meaning

| Entry Type | Ledger Impact |
|------------|--------------|
| Credit Purchase | Debit: Purchase/Expense, Credit: Accounts Payable (Liability) |
| Sale on Credit | Debit: Accounts Receivable, Credit: Revenue |
| Journal Entry | Depends on nature (adjustments) |

**Key Difference from Cashbook:**
- Cashbook = Only actual cash movement
- Daybook = ALL financial transactions including obligations

## 3️⃣ Plain English Meaning

The Daybook is like a diary of all financial promises:
- "We bought materials worth ₹1,00,000 but will pay next month" → Goes in Daybook
- "Client promised to pay but hasn't yet" → Goes in Daybook

**Real Life:** Vendor delivers plywood on Day 1, you pay on Day 30. On Day 1, Daybook records the purchase. On Day 30, Cashbook records the payment.

## 4️⃣ How to Use — Step-by-Step

### Recording a Credit Purchase (No Immediate Payment)

```
Step 1: Finance → Daybook
Step 2: Click "New Entry"
Step 3: Entry Type: "Purchase Invoice"
Step 4: Fill details:
        - Vendor: Select vendor
        - Date: Invoice date
        - Amount: ₹1,00,000
        - Project: Link to project
        - Category: "Material Purchase"
        - Payment Terms: "Credit - 30 Days"
        - Invoice Number: Vendor's bill number
Step 5: Save
Step 6: This creates a LIABILITY (you owe the vendor)
```

### Recording a Cash Purchase (Immediate Payment)

```
Step 1: Finance → Daybook
Step 2: Click "New Entry"
Step 3: Entry Type: "Cash Purchase"
Step 4: Fill details (same as above)
Step 5: Payment Mode: Select how you paid
Step 6: Save
Step 7: This creates BOTH: Daybook entry + Cashbook outflow
```

## 5️⃣ Scenario Example

**Monthly Vendor Cycle:**

**Day 1:** Received materials from Sharma Plywood
- Invoice: ₹80,000
- Payment Terms: 15 days credit
- Action: Enter in Daybook as Credit Purchase
- Liability Created: ₹80,000 owed to Sharma Plywood

**Day 15:** Payment Due
- Action: Go to Purchase Invoice → Mark as Paid
- This creates Cashbook outflow
- Liability Cleared: ₹0 owed

**Result:**
- Day 1-14: Daybook shows expense, Cashbook doesn't (no cash moved)
- Day 15: Both Daybook and Cashbook reflect the transaction

## 6️⃣ Reflection Mapping

| Daybook Entry Type | Cashbook | Liability | Project Cost | Profit |
|-------------------|----------|-----------|--------------|--------|
| Credit Purchase | ❌ | ✅ Increases | ❌ Until Paid | ❌ Until Paid |
| Cash Purchase | ✅ | ❌ | ✅ Immediate | ✅ Immediate |
| Liability Settlement | ✅ | ✅ Decreases | ✅ Now reflects | ✅ Now reflects |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Credit purchase shows as expense but doesn't affect profit"
✅ **Explanation:** This is intentional. Credit purchases only affect profit when actually paid. This prevents showing fake losses.

❌ **Mistake:** "Paid vendor but liability still showing"
✅ **Resolution:** Did you use "Settle Liability" option? Simply recording Cashbook outflow doesn't auto-clear liability.

❌ **Mistake:** "Same invoice entered twice"
✅ **Prevention:** Always check "Pending Invoices" list before creating new entry.

---

# Project Finance

## 1️⃣ Purpose

Project Finance gives you the complete financial picture of each individual project — from client payments to vendor costs to profit.

**Business Problem Solved:** Without this, you'd have no idea if a specific project is profitable or losing money. You might be busy with projects but bleeding cash.

## 2️⃣ Accounting Meaning

| Metric | Accounting Treatment |
|--------|---------------------|
| Sign-off Value | Contract Revenue (to be recognized) |
| Total Received | Recognized Revenue |
| Planned Cost | Budgeted Expense |
| Actual Cost | Recognized Expense |
| Gross Profit | Revenue - Cost of Goods Sold |
| Remaining Liability | Accounts Payable (per project) |

## 3️⃣ Plain English Meaning

Think of each project as a mini-business:
- **Sign-off Value** = How much the client will pay us (total contract)
- **Total Received** = How much client has ACTUALLY paid
- **Balance Pending** = Client still owes us this much
- **Planned Cost** = Our budget for vendors/materials
- **Actual Cost** = What we've actually spent
- **Profit** = What's left for the company

**Real Life:** Sharma project is ₹5,00,000 total. Client paid ₹3,00,000. We spent ₹2,00,000 on materials. 
- Sign-off: ₹5,00,000
- Received: ₹3,00,000
- Balance: ₹2,00,000
- Actual Cost: ₹2,00,000
- Current Profit: ₹1,00,000 (on what's received)

## 4️⃣ How to Use — Step-by-Step

### Viewing Project Financials

```
Step 1: Finance → Project Finance
Step 2: Find your project in the list
Step 3: Click "View Details"
Step 4: See Financial Summary:
        - Sign-off Value (locked contract value)
        - Total Received (client payments)
        - Planned vs Actual Cost
        - Profit Projection
Step 5: Scroll to see Payment Schedule
Step 6: Review Vendor Mapping for budget vs actual by category
```

### Understanding the Dashboard

**Top Cards:**
- Sign-off Value → Total contract amount
- Total Received → Money in bank from this client
- Balance Pending → Remaining collection target

**Profit Section:**
- Projected Profit = Sign-off Value - Planned Cost (what we expect to make)
- Realised Profit = Received - Actual Cost (what we've actually made so far)

**Vendor Mapping Section:**
- Shows budget by category (Plywood: ₹50,000, Hardware: ₹20,000)
- Shows actual spent against each category
- Red highlight = Over budget

## 5️⃣ Scenario Example

**Project: Mehta Villa (Total Value: ₹8,00,000)**

**Initial Setup:**
- Sign-off locked at: ₹8,00,000
- Vendor Budget mapped:
  - Plywood: ₹1,50,000
  - Hardware: ₹80,000
  - Labour: ₹2,00,000
  - Finishing: ₹70,000
  - Total Planned: ₹5,00,000

**After 3 Months:**
| Category | Planned | Actual | Status |
|----------|---------|--------|--------|
| Plywood | ₹1,50,000 | ₹1,65,000 | ❌ Over by ₹15,000 |
| Hardware | ₹80,000 | ₹72,000 | ✅ Under budget |
| Labour | ₹2,00,000 | ₹1,80,000 | ✅ Under budget |
| Finishing | ₹70,000 | ₹0 | ⏳ Pending |

**Client Payments:**
- Booking: ₹25,000 ✅ Received
- 50% Milestone: ₹4,00,000 ✅ Received
- Final: ₹3,75,000 ⏳ Pending

**Current Status:**
- Received: ₹4,25,000
- Spent: ₹4,17,000
- Realised Profit: ₹8,000 (so far)
- Projected Final Profit: ₹3,00,000

## 6️⃣ Reflection Mapping

| Action | Project Finance Impact |
|--------|----------------------|
| Client pays | ✅ Total Received increases |
| Vendor paid (linked) | ✅ Actual Cost increases |
| Vendor paid (unlinked) | ❌ Doesn't show |
| Purchase Invoice (credit) | ❌ Shows only after payment |
| Vendor Mapping created | ✅ Planned Cost shows |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Sign-off Value shows ₹0"
✅ **Resolution:** Has Design Sign-off been completed? Sign-off value only appears after KWS Sign-Off approval in Design Approval Gate.

❌ **Mistake:** "Expenses not showing in Project Finance"
✅ **Resolution:** When recording Cashbook outflow, did you select the correct Project? Unlinked expenses don't appear.

❌ **Mistake:** "Planned Cost is empty"
✅ **Resolution:** Vendor Mapping must be created first. Without mapping, system doesn't know your budget.

❌ **Mistake:** "Profit showing negative but we collected more than we spent"
✅ **Explanation:** Check if Sign-off is locked. If not locked, calculations use ₹0 as revenue base, making everything look negative.

---

# Payment Schedule

## 1️⃣ Purpose

Payment Schedule defines the milestone-based payment structure for each project — when and how much the client should pay.

**Business Problem Solved:** Without clear milestones, clients may delay payments indefinitely. This creates a structured collection plan.

## 2️⃣ Accounting Meaning

| Stage | Accounting Treatment |
|-------|---------------------|
| Booking Amount | Advance Receipt (Liability until work done) |
| Milestone Payment | Revenue Recognition (as work completes) |
| Final Payment | Final Revenue Recognition |

## 3️⃣ Plain English Meaning

Payment Schedule is like an EMI plan for the client:
- **Booking** = Token amount to confirm project
- **Design Milestone** = Pay after designs approved
- **Production Milestone** = Pay when work starts
- **Final** = Pay remaining amount before handover

**Default Structure:**
1. Booking: Fixed ₹25,000
2. Production Start: 50% of Sign-off Value
3. Before Installation: Remaining Balance

## 4️⃣ How to Use — Step-by-Step

### Viewing Payment Schedule

```
Step 1: Finance → Project Finance → Select Project → View Details
Step 2: Scroll to "Payment Schedule" section
Step 3: See milestone cards:
        - Booking Amount: ₹25,000 (Fixed)
        - Production Start: 50% = ₹X
        - Before Installation: Remaining = ₹Y
Step 4: Status shows: Pending / Paid / Partial
```

### Custom Payment Schedule (Admin Only)

```
Step 1: Project Finance → Select Project → View Details
Step 2: Toggle "Enable Custom Schedule"
Step 3: Edit stages:
        - Add new milestone
        - Change percentage
        - Set fixed amount
Step 4: Save changes
```

## 5️⃣ Scenario Example

**Project: Designer House (Sign-off: ₹6,00,000)**

**Default Schedule:**
| Milestone | Calculation | Amount | Status |
|-----------|-------------|--------|--------|
| Booking | Fixed | ₹25,000 | ✅ Paid |
| Production Start | 50% of ₹6,00,000 | ₹3,00,000 | ✅ Paid |
| Before Installation | Remaining | ₹2,75,000 | ⏳ Pending |

**Collection Tracking:**
- Total Expected: ₹6,00,000
- Total Received: ₹3,25,000
- Balance: ₹2,75,000

**Accounts Team Action:**
- See "Production Start" milestone is paid
- Send reminder to client for "Before Installation" payment
- Track in Finance Overview

## 6️⃣ Reflection Mapping

| Payment Schedule Event | What Changes |
|----------------------|--------------|
| Client pays milestone | Cashbook Inflow + Stage marked "Paid" |
| Partial payment | Cashbook Inflow + Stage marked "Partial" |
| Schedule edited | New milestone amounts calculated |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Total of milestones doesn't match Sign-off Value"
✅ **Explanation:** Previously this was a bug. Now the system automatically calculates "Remaining" stage to ensure total = Sign-off Value.

❌ **Mistake:** "Can't edit payment schedule"
✅ **Resolution:** Only Admin/Manager can edit. Also, paid milestones cannot be changed.

❌ **Mistake:** "Schedule shows ₹0 everywhere"
✅ **Resolution:** Sign-off must be locked first. Without Sign-off Value, schedule cannot be calculated.

---

# Vendor Mapping & Budget Control

## 1️⃣ Purpose

Vendor Mapping is the budget planning tool — it defines how much you plan to spend on each category for a project.

**Business Problem Solved:** Without budgeting, you might overspend on materials and discover losses only at project end. Vendor Mapping enables proactive cost control.

## 2️⃣ Accounting Meaning

| Concept | Accounting Treatment |
|---------|---------------------|
| Planned Cost | Budgeted Expense (not yet a liability) |
| Actual Cost | Recognized Expense (when paid) |
| Variance | Budget vs Actual analysis |

## 3️⃣ Plain English Meaning

Vendor Mapping is your project budget spreadsheet:
- **Before project starts:** Plan how much to spend on what
- **During project:** Compare actual spending against plan
- **After project:** Analyze where you over/under spent

**Real Life:** For a ₹5L project, you might budget:
- Plywood: ₹1,50,000
- Hardware: ₹50,000
- Labour: ₹1,00,000
- Paint: ₹30,000
- Miscellaneous: ₹20,000
- **Expected Profit: ₹1,50,000**

## 4️⃣ How to Use — Step-by-Step

### Creating Vendor Budget

```
Step 1: Finance → Project Finance → Select Project → View Details
Step 2: Scroll to "Vendor Mapping" section
Step 3: Click "Add Mapping"
Step 4: Fill details:
        - Category: "Plywood & Boards"
        - Vendor: Select vendor (or leave blank for category budget)
        - Planned Amount: ₹1,50,000
        - Notes: "Including wastage 10%"
Step 5: Save
Step 6: Repeat for all categories
```

### Monitoring Budget vs Actual

```
Step 1: View Project Finance Details
Step 2: Check "Planned vs Actual" table
Step 3: Red rows = Over budget (action needed)
Step 4: Green rows = Under budget (healthy)
Step 5: Click category to see individual expenses
```

## 5️⃣ Scenario Example

**Project: Modern Kitchen (Budget Planning)**

**Step 1 - Initial Mapping:**
| Category | Planned | Vendor |
|----------|---------|--------|
| Modular Kitchen Units | ₹2,00,000 | Kitchen World |
| Countertop | ₹45,000 | Stone Gallery |
| Appliances | ₹80,000 | Various |
| Plumbing | ₹25,000 | Local Plumber |
| Electrical | ₹15,000 | Raj Electricals |
| **Total Planned** | **₹3,65,000** | |

**Step 2 - Mid-Project Review:**
| Category | Planned | Actual | Status |
|----------|---------|--------|--------|
| Modular Units | ₹2,00,000 | ₹2,15,000 | ❌ Over ₹15,000 |
| Countertop | ₹45,000 | ₹42,000 | ✅ Under |
| Appliances | ₹80,000 | ₹0 | ⏳ Pending |
| Plumbing | ₹25,000 | ₹28,000 | ❌ Over ₹3,000 |
| Electrical | ₹15,000 | ₹12,000 | ✅ Under |

**Step 3 - Action:**
- Kitchen Units over by ₹15,000 → Client requested upgrade, get approval or absorb
- Plumbing over by ₹3,000 → Unexpected pipe replacement, acceptable
- Overall still within ₹5,000 buffer

## 6️⃣ Reflection Mapping

| Vendor Mapping Action | Project Finance | Profit Visibility |
|----------------------|-----------------|-------------------|
| Add mapping | ✅ Planned Cost shows | ✅ Projected Profit updated |
| Expense recorded | ✅ Actual Cost shows | ✅ Realised Profit updated |
| Over budget alert | ⚠️ Red highlight | ⚠️ Margin at risk |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Added mapping but Planned Cost still ₹0"
✅ **Resolution:** Save the mapping. Check if it appears in the list. Refresh page if needed.

❌ **Mistake:** "Can't add mapping - button disabled"
✅ **Resolution:** Check if project has started spending. Once production begins, mapping becomes read-only.

❌ **Mistake:** "Actual cost higher than mapped but no warning"
✅ **Explanation:** Ensure expenses have correct Category selected. Miscategorized expenses won't trigger budget alerts.

---

# Purchase Invoice

## 1️⃣ Purpose

Purchase Invoice records formal bills received from vendors, creating a trackable liability.

**Business Problem Solved:** Vendors give invoices with payment terms. This tab tracks what you owe and when payments are due.

## 2️⃣ Accounting Meaning

| Action | Ledger Entry |
|--------|--------------|
| Invoice Received | Debit: Purchase/Expense, Credit: Accounts Payable |
| Invoice Paid | Debit: Accounts Payable, Credit: Bank/Cash |
| Partial Payment | Proportional reduction in Accounts Payable |

## 3️⃣ Plain English Meaning

Purchase Invoice = Vendor's bill that you haven't paid yet

**Real Life:** 
- Day 1: Vendor delivers plywood, gives invoice for ₹50,000, says "Pay within 15 days"
- You enter this as Purchase Invoice
- System tracks: "You owe ₹50,000 to this vendor"
- Day 15: You pay → Mark invoice as paid → Liability cleared

## 4️⃣ How to Use — Step-by-Step

### Recording a Purchase Invoice

```
Step 1: Finance → Purchase Invoice
Step 2: Click "New Invoice"
Step 3: Fill details:
        - Vendor: Select from list
        - Invoice Number: Vendor's bill number
        - Invoice Date: Date on bill
        - Due Date: Payment deadline
        - Amount: ₹50,000
        - Project: Link to relevant project
        - Category: "Material Purchase"
        - Description: "Plywood for Sharma project"
Step 4: Attach invoice image/PDF (optional but recommended)
Step 5: Save
```

### Settling a Purchase Invoice

```
Step 1: Finance → Purchase Invoice
Step 2: Find the invoice in "Pending" list
Step 3: Click "Settle" button
Step 4: Select payment method:
        - Full Payment: Entire amount
        - Partial Payment: Enter amount being paid
Step 5: Select bank account
Step 6: Enter payment reference (UTR/Cheque number)
Step 7: Confirm payment
Step 8: System automatically:
        - Creates Cashbook outflow
        - Updates Project Finance (actual cost)
        - Clears/reduces liability
```

## 5️⃣ Scenario Example

**Monthly Invoice Processing:**

**Invoices Received This Month:**
| Vendor | Amount | Due Date | Project |
|--------|--------|----------|---------|
| ABC Plywood | ₹75,000 | Feb 25 | Mehta Villa |
| XYZ Hardware | ₹32,000 | Feb 28 | Mehta Villa |
| Sharma Electricals | ₹18,000 | Mar 5 | Designer House |

**Payment Prioritization:**
1. ABC Plywood due first → Pay ₹75,000 on Feb 24
2. XYZ Hardware → Pay ₹32,000 on Feb 27
3. Sharma Electricals → Can wait till Mar 5

**After All Payments:**
- Liability cleared: ₹1,25,000
- Cashbook shows 3 outflows
- Project Finance updated:
  - Mehta Villa: +₹1,07,000 actual cost
  - Designer House: +₹18,000 actual cost

## 6️⃣ Reflection Mapping

| Invoice Action | Cashbook | Daybook | Liability | Project Finance |
|----------------|----------|---------|-----------|-----------------|
| Invoice Created | ❌ | ✅ Entry | ✅ Increases | ❌ |
| Invoice Paid | ✅ Outflow | ✅ Updated | ✅ Decreases | ✅ Actual Cost |
| Partial Payment | ✅ Partial | ✅ Updated | ✅ Partial decrease | ✅ Partial cost |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Invoice paid but liability still showing"
✅ **Resolution:** Did you use "Settle" option from Purchase Invoice screen? Manual Cashbook entry doesn't auto-link.

❌ **Mistake:** "Vendor payment shows in Cashbook but not in Project Finance"
✅ **Resolution:** When settling invoice, ensure correct Project is selected.

❌ **Mistake:** "Duplicate invoices from same vendor"
✅ **Prevention:** Check invoice number. System should warn about duplicates but always verify.

---

# Purchase Returns

## 1️⃣ Purpose

Purchase Returns handles goods returned to vendors — damaged materials, wrong orders, or excess supplies.

**Business Problem Solved:** When goods are returned, you need to track the refund expectation and adjust your costs accordingly.

## 2️⃣ Accounting Meaning

| Stage | Ledger Impact |
|-------|--------------|
| Return Initiated | Debit: Returns Pending (Asset), Credit: Purchase Returns |
| Refund Received | Debit: Bank/Cash, Credit: Returns Pending |
| Write-Off | Debit: Loss, Credit: Returns Pending |

## 3️⃣ Plain English Meaning

Purchase Return = "We're sending goods back to vendor and expect money back"

**Scenarios:**
1. **Damaged Goods:** Vendor sent faulty material, we return for full refund
2. **Wrong Order:** Vendor sent wrong item, we return and get replacement or refund
3. **Excess Material:** Project ended with surplus, negotiate partial refund

## 4️⃣ How to Use — Step-by-Step

### Creating a Purchase Return

```
Step 1: Finance → Purchase Returns
Step 2: Click "New Return"
Step 3: Fill details:
        - Original Invoice: Select the purchase invoice
        - Return Reason: "Damaged" / "Wrong Item" / "Excess"
        - Items Returned: Describe what's being returned
        - Return Value: ₹10,000 (full value of returned goods)
        - Expected Refund: ₹8,000 (what vendor agreed to refund)
Step 4: Save → Status becomes "Initiated"
```

### Tracking Return Status

```
Return Lifecycle:
1. Initiated → You've logged the return
2. Vendor Accepted → Vendor confirmed they'll process return
3. Goods Shipped → You've sent items back
4. Refund Pending → Waiting for money
5. Settled → Refund received
6. Closed with Loss → Partial refund, remaining written off
```

### Recording Refund Settlement

```
Step 1: Find return in list
Step 2: Click "Record Settlement"
Step 3: Enter refund received: ₹8,000
Step 4: Select which account received money
Step 5: If partial:
        - Refund: ₹8,000
        - Write-off: ₹2,000 (loss)
Step 6: Save
Step 7: System creates Cashbook inflow + adjusts project cost
```

## 5️⃣ Scenario Example

**Complete Return Scenario:**

**Situation:** Ordered 100 sheets plywood @ ₹500 each = ₹50,000
- 10 sheets were damaged during delivery
- Return Value: ₹5,000 (10 sheets)
- Vendor agrees to refund ₹3,000 (damage was in transit, shared loss)
- Write-off: ₹2,000 (our loss)

**Recording:**
```
Day 1: Create Purchase Return
        - Invoice: ABC Plywood - INV-2024-001
        - Return Value: ₹5,000
        - Reason: Transit Damage
        - Status: Initiated

Day 3: Update Status → Vendor Accepted

Day 5: Update Status → Goods Returned to Vendor

Day 10: Record Settlement
        - Refund Received: ₹3,000
        - Account: HDFC Current
        - Write-off: ₹2,000
        - Status: Closed with Loss
```

**Impact:**
- Original Purchase: ₹50,000
- Refund: -₹3,000
- Net Cost: ₹47,000
- Loss Written Off: ₹2,000
- Effective Cost: ₹47,000 + ₹2,000 = ₹49,000

## 6️⃣ Reflection Mapping

| Return Action | Cashbook | Project Finance | P&L |
|---------------|----------|-----------------|-----|
| Return Created | ❌ | ❌ | ❌ |
| Refund Received | ✅ Inflow | ✅ Cost reduced | ✅ Expense reduced |
| Loss Written Off | ❌ | ❌ | ✅ Loss recorded |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Recorded return but project cost not reduced"
✅ **Resolution:** Cost only reduces after refund is received and recorded. Pending returns don't affect cost.

❌ **Mistake:** "Where to see total loss from returns?"
✅ **Answer:** Finance Overview → Look for "Purchase Return Losses" in summary or reports.

❌ **Mistake:** "Vendor gave replacement instead of refund"
✅ **Handling:** Close return as "Settled - Replacement Received". No cash impact but inventory adjusted.

---

# Salary Management

## 1️⃣ Purpose

Salary Management handles all employee compensation — monthly salaries, deductions, and net payout calculations.

**Business Problem Solved:** Calculating salaries manually leads to errors. This module ensures accurate, trackable salary processing.

## 2️⃣ Accounting Meaning

| Component | Ledger Treatment |
|-----------|------------------|
| Gross Salary | Debit: Salary Expense, Credit: Salary Payable |
| Deductions | Debit: Salary Payable, Credit: Various (PF, ESI, Advance Recovery) |
| Net Payout | Debit: Salary Payable, Credit: Bank/Cash |

## 3️⃣ Plain English Meaning

Salary = What employee earns
Deductions = What gets cut (PF, ESI, loan recovery, advance adjustment)
Net Salary = What employee actually receives in bank

**Formula:** Net Salary = Gross Salary - All Deductions

## 4️⃣ How to Use — Step-by-Step

### Monthly Salary Processing

```
Step 1: Finance → Salaries
Step 2: Select Month & Year (e.g., February 2026)
Step 3: System shows all active employees
Step 4: For each employee, verify:
        - Base Salary: ₹35,000
        - Deductions: PF ₹4,200, ESI ₹1,050, Advance ₹5,000
        - Additions: Overtime ₹2,000
        - Net Payable: ₹26,750
Step 5: Click "Approve" for correct entries
Step 6: Once all approved, click "Process Payroll"
Step 7: System generates bank payment file
```

### Recording Advance Against Salary

```
Step 1: Finance → Salaries → Advances
Step 2: Click "New Advance"
Step 3: Fill:
        - Employee: Select name
        - Amount: ₹10,000
        - Reason: "Personal emergency"
        - Recovery: "₹5,000 per month for 2 months"
Step 4: Approve advance
Step 5: System auto-deducts from next salaries
```

### Viewing Salary History

```
Step 1: Finance → Salaries → Click employee name
Step 2: See month-by-month history:
        - Jan: ₹35,000 gross → ₹28,000 net
        - Feb: ₹35,000 gross → ₹26,750 net (advance deducted)
        - etc.
```

## 5️⃣ Scenario Example

**Employee: Rajesh Kumar (Designer)**

**Monthly Salary Calculation:**
| Component | Amount |
|-----------|--------|
| Basic Salary | ₹30,000 |
| HRA | ₹5,000 |
| **Gross Salary** | **₹35,000** |
| (-) PF Deduction (12%) | -₹3,600 |
| (-) ESI (1.75%) | -₹612 |
| (-) Advance Recovery | -₹5,000 |
| **Net Payable** | **₹25,788** |

**Processing:**
1. February payroll initiated
2. System calculates all deductions
3. Manager approves
4. Finance processes payment
5. ₹25,788 transferred to Rajesh's bank
6. Advance balance reduced from ₹10,000 to ₹5,000
7. Next month, another ₹5,000 will be deducted

## 6️⃣ Reflection Mapping

| Salary Action | Cashbook | P&L | Employee Record |
|---------------|----------|-----|-----------------|
| Salary Approved | ❌ | ✅ Expense recorded | ✅ Updated |
| Salary Paid | ✅ Outflow | ❌ (already recorded) | ✅ Marked Paid |
| Advance Given | ✅ Outflow | ❌ (Asset, not expense) | ✅ Advance balance |
| Advance Recovered | ❌ (deducted from salary) | ❌ | ✅ Balance reduced |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Salary expense showing double"
✅ **Explanation:** Check if both salary approval AND payment were recorded as separate expenses. Only one should impact P&L.

❌ **Mistake:** "Employee net salary is wrong"
✅ **Resolution:** Check all deduction settings. Verify advance balance. Confirm PF/ESI rates.

❌ **Mistake:** "Advance not getting deducted"
✅ **Resolution:** Check if recovery schedule is set. Ensure advance is "Approved" status.

---

# Incentives

## 1️⃣ Purpose

Incentives module handles performance-based bonuses for employees — project completion bonuses, sales targets, etc.

**Business Problem Solved:** Tracking who earned what incentive and ensuring timely, accurate payment.

## 2️⃣ Accounting Meaning

| Stage | Ledger Treatment |
|-------|------------------|
| Incentive Created (Draft) | No ledger impact |
| Incentive Approved | Debit: Incentive Expense, Credit: Payable |
| Incentive Paid | Debit: Payable, Credit: Bank/Cash |

## 3️⃣ Plain English Meaning

Incentive = Bonus for good performance
- Designer completes project on time → Gets project completion bonus
- Sales person hits target → Gets sales incentive
- Team meets deadline → Gets team bonus

## 4️⃣ How to Use — Step-by-Step

### Creating an Incentive

```
Step 1: Finance → Incentives
Step 2: Click "New Incentive"
Step 3: Fill details:
        - Employee: Select name
        - Type: "Project Completion" / "Sales Target" / "Performance"
        - Project: Link to project (if applicable)
        - Amount: ₹15,000
        - Reason: "Completed Sharma project under budget"
Step 4: Save as Draft
```

### Approval Workflow

```
Draft → Submitted for Approval → Approved → Paid

Step 1: Manager reviews incentive
Step 2: Clicks "Approve" or "Reject"
Step 3: If Approved, Finance can process payment
Step 4: Finance clicks "Mark as Paid"
Step 5: Links to Cashbook entry
```

## 5️⃣ Scenario Example

**Project Completion Incentive:**

**Situation:** Designer Priya completed Modern Kitchen project 5 days early, saving ₹20,000 in costs.

**Incentive Creation:**
- Employee: Priya Sharma
- Type: Project Completion Bonus
- Project: Modern Kitchen (Mehta)
- Amount: ₹10,000 (5% of cost saved)
- Reason: "Early completion + cost savings"

**Workflow:**
1. Design Manager creates draft
2. Submits for approval
3. Finance Manager approves
4. Finance pays with salary or separately
5. Priya receives ₹10,000

## 6️⃣ Reflection Mapping

| Incentive Status | Expense | Cashbook | Payable |
|------------------|---------|----------|---------|
| Draft | ❌ | ❌ | ❌ |
| Approved | ✅ | ❌ | ✅ |
| Paid | ❌ (already recorded) | ✅ | ❌ (cleared) |

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Incentive approved but not showing in expense"
✅ **Explanation:** Check approval status. Only "Approved" incentives affect P&L.

❌ **Mistake:** "How to pay with salary vs separately?"
✅ **Answer:** When processing salary, add approved incentives to payout. Or process as separate Cashbook entry.

---

# Commissions

## 1️⃣ Purpose

Commissions handles sales-based earnings — percentage of revenue paid to sales staff for deals they close.

**Business Problem Solved:** Sales people earn based on what they sell. This tracks and calculates commissions fairly.

## 2️⃣ Accounting Meaning

| Stage | Ledger Treatment |
|-------|------------------|
| Commission Calculated | Debit: Commission Expense, Credit: Commission Payable |
| Commission Paid | Debit: Commission Payable, Credit: Bank/Cash |

## 3️⃣ Plain English Meaning

Commission = Percentage of deal value paid to sales person

**Example:** Sales person closes ₹10,00,000 project. Commission rate is 2%. Commission earned = ₹20,000.

## 4️⃣ How to Use — Step-by-Step

### Recording a Commission

```
Step 1: Finance → Commissions
Step 2: Click "New Commission"
Step 3: Fill details:
        - Employee: Sales person name
        - Project: Link to project
        - Project Value: ₹10,00,000
        - Commission Rate: 2%
        - Commission Amount: ₹20,000 (auto-calculated)
        - Trigger: "On Booking" / "On Sign-off" / "On Collection"
Step 4: Save as Draft
Step 5: Submit for approval when trigger condition met
```

### Commission Payment

```
Step 1: Approved commissions appear in "Pending Payment"
Step 2: Select commissions to pay
Step 3: Process payment (with salary or separately)
Step 4: Mark as paid
```

## 5️⃣ Scenario Example

**Sales Commission Structure:**

| Trigger Point | Rate |
|---------------|------|
| On Booking | 0.5% |
| On Design Sign-off | 0.5% |
| On Full Collection | 1% |
| **Total** | **2%** |

**Project: ₹8,00,000**
- Booking commission: ₹4,000 (paid when booking received)
- Sign-off commission: ₹4,000 (paid when design approved)
- Collection commission: ₹8,000 (paid when full amount collected)
- **Total Commission: ₹16,000**

## 6️⃣ Reflection Mapping

Same as Incentives — follows Draft → Approved → Paid workflow.

## 7️⃣ Common Mistakes & Confusions

❌ **Mistake:** "Commission calculated on wrong project value"
✅ **Resolution:** Commission should be on Sign-off Value (locked), not presales budget.

❌ **Mistake:** "Partial collection commission calculation"
✅ **Explanation:** If trigger is "On Full Collection", commission only becomes payable after 100% received.

---

# Account Management

## 1️⃣ Purpose

Account Management maintains your bank and cash accounts — tracking balances, managing multiple accounts.

**Business Problem Solved:** Companies have multiple bank accounts and cash boxes. This centralizes all account management.

## 2️⃣ Plain English Meaning

Accounts = Where your money sits
- Current Account (daily operations)
- Savings Account (reserves)
- Petty Cash (small daily expenses)
- Credit Card Account (for tracking CC spending)

## 4️⃣ How to Use — Step-by-Step

### Adding a New Account

```
Step 1: Finance → Accounts
Step 2: Click "Add Account"
Step 3: Fill details:
        - Account Name: "HDFC Current A/C"
        - Account Type: "Bank" / "Cash" / "Credit Card"
        - Account Number: XXXX-XXXX-1234
        - Opening Balance: ₹5,00,000
        - As of Date: Account start date
Step 4: Save
```

### Reconciliation

```
Step 1: Select account
Step 2: Compare system balance with bank statement
Step 3: If mismatch:
        - Check for missing entries
        - Check for incorrect amounts
        - Record adjustment if needed
```

## 5️⃣ Scenario Example

**Monthly Bank Reconciliation:**

| Source | Balance |
|--------|---------|
| System shows | ₹4,52,000 |
| Bank statement | ₹4,50,000 |
| **Difference** | **₹2,000** |

**Investigation:**
1. Found: Bank charge ₹1,500 not recorded
2. Found: Interest credit ₹500 not recorded (₹500 was given by bank)
3. Net difference: ₹1,500 - ₹500 = ₹1,000... still ₹1,000 missing
4. Found: Cheque issued but not yet cleared by bank

**Resolution:** 
- Record bank charges as expense
- Record interest as income
- Cheque is timing difference (will clear next statement)

---

# Permission & Role Governance

## Who Should Access What

| Role | Can View | Can Create | Can Edit | Can Approve | Can Delete |
|------|----------|------------|----------|-------------|------------|
| Junior Accountant | All Finance | Entries only | Own entries | ❌ | ❌ |
| Senior Accountant | All Finance | All entries | All entries | ❌ | ❌ |
| Finance Manager | All Finance | All entries | All entries | ✅ | Own team entries |
| Admin | Everything | Everything | Everything | ✅ | ✅ |
| Founder | Everything | Everything | Override any | ✅ | ✅ |

## Best Practices

### Daily Operations
- **Junior Accountant:** Enter daily transactions, don't approve own entries
- **Senior Accountant:** Review junior's entries, enter complex transactions
- **Finance Manager:** Approve all entries, review dashboards daily

### Monthly Close
- **Week 1:** Collect all pending invoices
- **Week 2:** Process payments, clear liabilities
- **Week 3:** Reconcile all accounts
- **Week 4:** Generate reports, review with management

### Audit Trail
Every action is logged with:
- Who did it
- When it was done
- What was changed (before/after)

**NEVER share login credentials.** Each user must have own account for proper audit trail.

---

# Diagnostics & Audit Guide

## Daily Health Checks

### 1. Cash Position Check
```
Go to: Finance → Overview
Check: Bank Balance + Cash Balance
Compare: With expected based on yesterday's position + today's transactions
Flag: Any unexpected variance > ₹10,000
```

### 2. Pending Liability Review
```
Go to: Finance → Purchase Invoice (Pending tab)
Check: Total pending amount
Compare: With available cash
Action: Prioritize payments by due date
```

### 3. Collection Follow-up
```
Go to: Finance → Project Finance
Filter: Projects with Balance Pending > ₹1,00,000
Action: Generate collection reminder list
```

## Weekly Audits

### 1. Expense vs Budget
```
Go to: Finance → Project Finance → Each active project
Check: Planned vs Actual by category
Flag: Any category > 10% over budget
Action: Investigate and document reason
```

### 2. Vendor Payment Status
```
Go to: Finance → Purchase Invoice
Check: Any invoice past due date
Action: Either pay immediately or document delay reason
```

### 3. Salary & Commission Review
```
Go to: Finance → Salaries / Incentives / Commissions
Check: Any approved but unpaid entries
Action: Process pending payments
```

## Monthly Reconciliation

### 1. Bank Reconciliation
```
For each bank account:
1. Download bank statement
2. Compare with system balance
3. Identify differences
4. Record missing entries
5. Document timing differences
6. Sign-off reconciliation
```

### 2. Project Profit Review
```
Go to: Finance → Project Finance
For each completed project:
1. Verify all expenses recorded
2. Verify all payments received
3. Calculate final profit
4. Compare with projected profit
5. Document variance reasons
```

### 3. Liability Verification
```
Go to: Finance → Overview → Liabilities
Compare: System liability with vendor statements
Resolve: Any mismatches
```

## Quarterly Deep Audit

### 1. Cost Leakage Analysis
```
For each project:
1. Export all expenses
2. Categorize by type
3. Compare with budget
4. Identify unbudgeted expenses
5. Calculate leakage percentage
6. Report to management
```

### 2. Collection Efficiency
```
Calculate:
- Total invoiced vs Total collected
- Average collection days
- Overdue percentage
Flag: Projects with > 30 days overdue
```

### 3. Profitability Trend
```
Compare quarter-over-quarter:
- Revenue growth
- Expense ratio
- Profit margin
- Collection efficiency
```

---

# Quick Reference Tables

## Entry Types & Their Impact

| Entry Type | Cashbook | Daybook | Liability | Project Cost | Profit |
|------------|----------|---------|-----------|--------------|--------|
| Client Payment | ✅ Inflow | ✅ | ❌ | ❌ | ✅ Revenue |
| Cash Purchase | ✅ Outflow | ✅ | ❌ | ✅ | ✅ Expense |
| Credit Purchase | ❌ | ✅ | ✅ Increase | ❌ | ❌ |
| Liability Settlement | ✅ Outflow | ✅ | ✅ Decrease | ✅ | ✅ Expense |
| Salary Payment | ✅ Outflow | ✅ | ❌ | ❌* | ✅ Expense |
| Purchase Return (Refund) | ✅ Inflow | ✅ | ❌ | ✅ Decrease | ✅ Income |
| Internal Transfer | ✅ Both | ❌ | ❌ | ❌ | ❌ |

*Salary doesn't affect project cost unless specifically linked

## Status Meanings

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| Draft | Entry created, not finalized | Complete and submit |
| Pending Approval | Waiting for manager review | Manager to approve/reject |
| Approved | Cleared for processing | Finance to process |
| Paid | Money has been transferred | None - complete |
| Rejected | Not approved | Review feedback, revise if needed |
| Cancelled | Voided entry | None - archived |

## Common Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Entry | Ctrl + N |
| Save | Ctrl + S |
| Search | Ctrl + F |
| Refresh | F5 |
| Print | Ctrl + P |

---

# Troubleshooting Guide

## Problem: Balance Mismatch Between Reports

**Symptoms:** Bank balance in Overview differs from Account details

**Possible Causes:**
1. Pending transactions not refreshed
2. Date filter mismatch
3. Transactions in wrong account

**Resolution:**
1. Refresh both pages
2. Ensure same date range
3. Check transaction account assignments

---

## Problem: Profit Showing Negative Despite Collections

**Symptoms:** Project shows loss but we've collected more than spent

**Possible Causes:**
1. Sign-off value not locked
2. Expenses from other projects mixed
3. Credit purchases included prematurely

**Resolution:**
1. Verify Sign-off is locked (Design Approval complete)
2. Audit expense project assignments
3. Check is_cashbook_entry flags

---

## Problem: Liability Not Reducing After Payment

**Symptoms:** Paid vendor but Purchase Invoice still shows pending

**Possible Causes:**
1. Paid via Cashbook without linking invoice
2. Invoice marked as different vendor
3. Partial payment not recorded correctly

**Resolution:**
1. Use "Settle" option from Purchase Invoice
2. Verify vendor name matches
3. Record exact payment amount against invoice

---

## Problem: Salary Deductions Not Applying

**Symptoms:** Employee getting full salary despite advance outstanding

**Possible Causes:**
1. Advance not approved
2. Recovery schedule not set
3. Advance marked as "Written Off"

**Resolution:**
1. Check advance status
2. Verify recovery settings
3. Reinstate advance if incorrectly written off

---

## Problem: Commission/Incentive Not Showing in Payable

**Symptoms:** Approved incentive but not appearing in payment list

**Possible Causes:**
1. Still in "Approved" not "Ready for Payment"
2. Linked to future period
3. Duplicate entry deleted

**Resolution:**
1. Check workflow status
2. Verify effective date
3. Check audit log for deletions

---

## Emergency Contacts

For system issues:
- Technical Support: [Internal IT contact]
- Finance Module Owner: [Finance Manager name]
- Escalation: [Admin contact]

For process questions:
- Refer to this manual first
- Consult Finance Manager
- Document any process gaps for improvement

---

# Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Feb 2026 | Initial comprehensive guide | System |

---

**END OF FINANCE MODULE USER MANUAL**
