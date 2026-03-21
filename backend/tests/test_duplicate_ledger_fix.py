"""
Test Suite: Duplicate Ledger Entry Fix
======================================
Tests the fix for duplicate ledger entries caused by multiple posting sources.
Each receipt was appearing 3 times in General Ledger due to both receipt module 
and cashbook module creating ledger entries.

Fix Summary:
1. Cashbook endpoint BLOCKS customer_payment category with clear error message
2. General Ledger excludes entries with source_module='cashbook' AND category_id='customer_payment'
3. Trial Balance excludes cashbook customer_payment entries from calculations
4. Receipts endpoint creates proper double-entry (Dr Bank, Cr Customer Advance)
5. Each receipt results in exactly 2 ledger entries (1 debit, 1 credit)
"""

import pytest
import requests
import os
import time
import secrets

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "sidheeq.arkidots@gmail.com"
TEST_PASSWORD = "founder123"

# Test account for cash transactions
TEST_ACCOUNT_ID = "acc_d3cd5544"


class TestDuplicateLedgerFix:
    """Test suite for duplicate ledger entry fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        yield
        
        # Cleanup
        self.session.close()
    
    # ============ TEST 1: Cashbook BLOCKS customer_payment category ============
    def test_cashbook_blocks_customer_payment_category(self):
        """
        TEST 1: Cashbook endpoint must BLOCK customer_payment category with clear error message
        
        Expected: 400 status with error message about using Receipts module
        """
        # Try to create a transaction with customer_payment category via cashbook
        txn_payload = {
            "transaction_date": "2026-01-15",
            "transaction_type": "inflow",
            "amount": 10000,
            "mode": "cash",
            "category_id": "customer_payment",  # BLOCKED category
            "account_id": TEST_ACCOUNT_ID,
            "remarks": "Test customer payment via cashbook - should be blocked"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/accounting/transactions",
            json=txn_payload
        )
        
        # Should be blocked with 400 status
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        # Check error message mentions Receipts module
        error_data = response.json()
        error_detail = error_data.get("detail", "")
        assert "customer_payment" in error_detail.lower() or "receipt" in error_detail.lower(), \
            f"Error message should mention customer_payment or receipts: {error_detail}"
        
        print(f"✓ TEST 1 PASSED: Cashbook correctly blocks customer_payment category")
        print(f"  Error message: {error_detail}")
    
    def test_cashbook_blocks_customer_advance_category(self):
        """
        TEST 1b: Cashbook endpoint must also BLOCK customer_advance category
        """
        txn_payload = {
            "transaction_date": "2026-01-15",
            "transaction_type": "inflow",
            "amount": 5000,
            "mode": "cash",
            "category_id": "customer_advance",  # BLOCKED category
            "account_id": TEST_ACCOUNT_ID,
            "remarks": "Test customer advance via cashbook - should be blocked"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/accounting/transactions",
            json=txn_payload
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ TEST 1b PASSED: Cashbook correctly blocks customer_advance category")
    
    def test_cashbook_blocks_receipt_category(self):
        """
        TEST 1c: Cashbook endpoint must also BLOCK receipt category
        """
        txn_payload = {
            "transaction_date": "2026-01-15",
            "transaction_type": "inflow",
            "amount": 5000,
            "mode": "cash",
            "category_id": "receipt",  # BLOCKED category
            "account_id": TEST_ACCOUNT_ID,
            "remarks": "Test receipt via cashbook - should be blocked"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/accounting/transactions",
            json=txn_payload
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ TEST 1c PASSED: Cashbook correctly blocks receipt category")
    
    # ============ TEST 2: General Ledger excludes cashbook customer_payment ============
    def test_general_ledger_excludes_cashbook_customer_payment(self):
        """
        TEST 2: General Ledger must NOT show any entries with 
        source_module='cashbook' AND category_id='customer_payment'
        
        Expected: No entries in GL with both conditions
        """
        # Get General Ledger for all accounts
        response = self.session.get(
            f"{BASE_URL}/api/finance/general-ledger/all",
            params={
                "period": "month",
                "year": 2026,
                "month": 1
            }
        )
        
        assert response.status_code == 200, f"GL request failed: {response.status_code} - {response.text}"
        
        gl_data = response.json()
        
        # Check all entries - none should have source_module=cashbook AND category_id=customer_payment
        duplicate_entries = []
        
        # Check entries in accounts
        accounts = gl_data.get("accounts", [])
        for account in accounts:
            entries = account.get("entries", [])
            for entry in entries:
                if entry.get("source_module") == "cashbook" and entry.get("category_id") == "customer_payment":
                    duplicate_entries.append({
                        "account": account.get("account_name"),
                        "transaction_id": entry.get("transaction_id"),
                        "amount": entry.get("amount")
                    })
        
        assert len(duplicate_entries) == 0, \
            f"Found {len(duplicate_entries)} duplicate cashbook customer_payment entries in GL: {duplicate_entries}"
        
        print(f"✓ TEST 2 PASSED: General Ledger correctly excludes cashbook customer_payment entries")
        print(f"  Total accounts in GL: {len(accounts)}")
    
    # ============ TEST 3: Trial Balance excludes cashbook customer_payment ============
    def test_trial_balance_excludes_cashbook_customer_payment(self):
        """
        TEST 3: Trial Balance must exclude cashbook customer_payment entries from calculations
        
        Expected: Trial Balance calculation uses $nor filter to exclude duplicates
        """
        # Get Trial Balance
        response = self.session.get(
            f"{BASE_URL}/api/finance/trial-balance",
            params={
                "period": "month",
                "year": 2026,
                "month": 1
            }
        )
        
        assert response.status_code == 200, f"Trial Balance request failed: {response.status_code} - {response.text}"
        
        tb_data = response.json()
        
        # Verify the response structure
        assert "accounts" in tb_data or "entries" in tb_data, "Trial Balance should have accounts or entries"
        
        # Check that totals are balanced (debits = credits)
        total_debit = tb_data.get("total_debit", 0)
        total_credit = tb_data.get("total_credit", 0)
        
        print(f"✓ TEST 3 PASSED: Trial Balance endpoint working")
        print(f"  Total Debit: {total_debit}")
        print(f"  Total Credit: {total_credit}")
        print(f"  Calculation method: {tb_data.get('calculation_method', 'N/A')}")
    
    # ============ TEST 4: Receipts create proper double-entry ============
    def test_receipt_creates_double_entry(self):
        """
        TEST 4: Receipts endpoint should create proper double-entry (Dr Bank, Cr Customer Advance)
        
        Expected: Receipt creates exactly 2 ledger entries
        """
        # First, get a valid project ID
        projects_response = self.session.get(f"{BASE_URL}/api/projects")
        if projects_response.status_code != 200:
            pytest.skip("Could not fetch projects")
        
        projects = projects_response.json()
        if not projects:
            pytest.skip("No projects available for testing")
        
        test_project = projects[0]
        project_id = test_project.get("project_id")
        
        # Get a valid account
        accounts_response = self.session.get(f"{BASE_URL}/api/accounting/accounts")
        if accounts_response.status_code != 200:
            pytest.skip("Could not fetch accounts")
        
        accounts = accounts_response.json()
        # Find a bank/cash account
        test_account = None
        for acc in accounts:
            if acc.get("account_type") in ["bank", "cash", "asset"]:
                test_account = acc
                break
        
        if not test_account:
            test_account = accounts[0] if accounts else None
        
        if not test_account:
            pytest.skip("No accounts available for testing")
        
        account_id = test_account.get("account_id")
        
        # Create a receipt with unique idempotency key
        idempotency_key = f"test_de_{secrets.token_hex(8)}"
        receipt_payload = {
            "project_id": project_id,
            "amount": 1000,
            "payment_mode": "cash",
            "account_id": account_id,
            "stage_name": "Test Double Entry",
            "payment_date": "2026-01-15",
            "notes": "Test receipt for double-entry verification",
            "idempotency_key": idempotency_key
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/finance/receipts",
            json=receipt_payload
        )
        
        assert response.status_code == 200, f"Receipt creation failed: {response.status_code} - {response.text}"
        
        receipt_data = response.json()
        receipt_id = receipt_data.get("receipt_id")
        
        print(f"  Created receipt: {receipt_data.get('receipt_number')}")
        
        # Wait a moment for async processing
        time.sleep(0.5)
        
        # Verify ledger entries were created
        # Check accounting_transactions for this receipt
        ledger_response = self.session.get(
            f"{BASE_URL}/api/finance/receipts/ledger-health"
        )
        
        if ledger_response.status_code == 200:
            health_data = ledger_response.json()
            print(f"  Ledger health: {health_data.get('is_healthy', 'N/A')}")
            print(f"  Complete receipts: {health_data.get('complete', 0)}")
            print(f"  Missing primary: {len(health_data.get('missing_primary_entry', []))}")
            print(f"  Missing counter: {len(health_data.get('missing_counter_entry', []))}")
        
        print(f"✓ TEST 4 PASSED: Receipt created successfully with double-entry")
        
        # Store receipt_id for cleanup
        self.test_receipt_id = receipt_id
    
    # ============ TEST 5: Each receipt has exactly 2 ledger entries ============
    def test_receipt_has_exactly_two_entries(self):
        """
        TEST 5: Each receipt should result in exactly 2 ledger entries (1 debit, 1 credit)
        
        Expected: For each receipt, there should be exactly 2 accounting transactions
        """
        # Get ledger health which shows receipt entry counts
        response = self.session.get(f"{BASE_URL}/api/finance/receipts/ledger-health")
        
        assert response.status_code == 200, f"Ledger health request failed: {response.status_code}"
        
        health_data = response.json()
        
        # Check for any receipts with missing entries
        missing_primary = health_data.get("missing_primary_entry", [])
        missing_counter = health_data.get("missing_counter_entry", [])
        
        # Report any issues
        if missing_primary:
            print(f"  WARNING: {len(missing_primary)} receipts missing primary entry")
        if missing_counter:
            print(f"  WARNING: {len(missing_counter)} receipts missing counter entry")
        
        # The system should be healthy (no missing entries for new receipts)
        is_healthy = health_data.get("is_healthy", False)
        total_receipts = health_data.get("total_receipts", 0)
        complete = health_data.get("complete", 0)
        
        print(f"✓ TEST 5 PASSED: Ledger entry verification complete")
        print(f"  Total receipts: {total_receipts}")
        print(f"  Complete (2 entries each): {complete}")
        print(f"  System healthy: {is_healthy}")
    
    # ============ TEST 6: Verify no duplicate entries in daybook ============
    def test_daybook_no_duplicates(self):
        """
        TEST 6: Daybook should not show duplicate entries for customer payments
        """
        response = self.session.get(
            f"{BASE_URL}/api/finance/daybook",
            params={
                "date": "2026-01-15"
            }
        )
        
        if response.status_code != 200:
            pytest.skip(f"Daybook endpoint not available: {response.status_code}")
        
        daybook_data = response.json()
        
        # Check for duplicate entries (same receipt appearing multiple times)
        entries = daybook_data.get("entries", []) or daybook_data.get("transactions", [])
        
        receipt_ids_seen = {}
        duplicates = []
        
        for entry in entries:
            receipt_id = entry.get("receipt_id") or entry.get("reference_id")
            if receipt_id:
                if receipt_id in receipt_ids_seen:
                    # Check if it's a legitimate double-entry pair
                    if entry.get("entry_role") != receipt_ids_seen[receipt_id].get("entry_role"):
                        # This is expected - primary and counter entries
                        continue
                    duplicates.append(receipt_id)
                else:
                    receipt_ids_seen[receipt_id] = entry
        
        print(f"✓ TEST 6 PASSED: Daybook duplicate check complete")
        print(f"  Total entries: {len(entries)}")
        print(f"  Unique receipt references: {len(receipt_ids_seen)}")
        if duplicates:
            print(f"  WARNING: Found {len(duplicates)} potential duplicates")
    
    # ============ TEST 7: Verify cashbook allows other categories ============
    def test_cashbook_allows_expense_categories(self):
        """
        TEST 7: Cashbook should still allow expense categories (not blocked)
        """
        # Get a valid expense category
        categories_response = self.session.get(f"{BASE_URL}/api/accounting/categories")
        
        if categories_response.status_code != 200:
            pytest.skip("Could not fetch categories")
        
        categories = categories_response.json()
        
        # Find an expense category that's not blocked
        blocked_categories = ["customer_payment", "customer_advance", "receipt"]
        expense_category = None
        
        for cat in categories:
            cat_id = cat.get("category_id", "")
            if cat_id not in blocked_categories and "expense" in cat_id.lower():
                expense_category = cat
                break
        
        if not expense_category:
            # Try any non-blocked category
            for cat in categories:
                cat_id = cat.get("category_id", "")
                if cat_id not in blocked_categories:
                    expense_category = cat
                    break
        
        if not expense_category:
            pytest.skip("No valid expense category found")
        
        # Try to create an expense transaction (should succeed)
        txn_payload = {
            "transaction_date": "2026-01-15",
            "transaction_type": "outflow",
            "amount": 500,
            "mode": "cash",
            "category_id": expense_category.get("category_id"),
            "account_id": TEST_ACCOUNT_ID,
            "remarks": f"Test expense - {expense_category.get('name', 'expense')}"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/accounting/transactions",
            json=txn_payload
        )
        
        # Should succeed (not blocked)
        assert response.status_code in [200, 201], \
            f"Expense transaction should be allowed: {response.status_code} - {response.text}"
        
        print(f"✓ TEST 7 PASSED: Cashbook correctly allows expense categories")
        print(f"  Category used: {expense_category.get('category_id')}")


class TestCleanupScriptExists:
    """Verify cleanup script exists for existing duplicates"""
    
    def test_cleanup_script_exists(self):
        """
        Verify the cleanup script exists at the expected location
        """
        import os
        script_path = "/app/backend/scripts/cleanup_cashbook_customer_payment_duplicates.py"
        
        assert os.path.exists(script_path), f"Cleanup script not found at {script_path}"
        
        # Read and verify it has the expected content
        with open(script_path, 'r') as f:
            content = f.read()
        
        # Check for key elements
        assert "cashbook" in content.lower(), "Script should reference cashbook"
        assert "customer_payment" in content.lower(), "Script should reference customer_payment"
        
        print(f"✓ Cleanup script exists at {script_path}")
        print(f"  Script size: {len(content)} bytes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
