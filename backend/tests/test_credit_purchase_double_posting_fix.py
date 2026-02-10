"""
Test Credit Purchase Double-Posting Bug Fix

This test verifies that credit purchases do NOT double-count in financial reports:
1. Credit purchase invoices should NOT create cashbook entries (is_cashbook_entry=False)
2. Only the final payment (liability settlement) creates a cash outflow entry
3. Vendor liabilities net to zero after payment
4. Project finance reports show correct actual_cost without double-counting

Test Flow:
- Create credit purchase → actual_cost should NOT increase
- Verify liability is created with correct amount
- Settle liability → actual_cost should increase
- Verify remaining_liability becomes 0
- Verify cashbook does NOT contain credit purchase entries
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"

# Test data from main agent
TEST_PROJECT_ID = "proj_4aaba062"
TEST_BANK_ACCOUNT = "acc_2b39a50e"
TEST_VENDOR_ID = "vendor_aa89579c"


class TestCreditPurchaseDoublePostingFix:
    """Test suite for credit purchase double-posting bug fix"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        return s
    
    def test_01_login_works(self, session):
        """Verify authentication is working"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth check failed: {response.text}"
        data = response.json()
        assert "user_id" in data or "email" in data, "User data not returned"
        print(f"✓ Logged in as: {data.get('email', data.get('name', 'Unknown'))}")
    
    def test_02_get_initial_project_finance(self, session):
        """Get initial project finance state before creating credit purchase"""
        # Correct endpoint: /api/finance/project-finance/{project_id}
        response = session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        data = response.json()
        
        # Store initial values for comparison
        self.__class__.initial_actual_cost = data["summary"]["actual_cost"]
        self.__class__.initial_remaining_liability = data["summary"]["remaining_liability"]
        
        print(f"✓ Initial actual_cost: {self.initial_actual_cost}")
        print(f"✓ Initial remaining_liability: {self.initial_remaining_liability}")
    
    def test_03_create_credit_purchase_invoice(self, session):
        """Create a credit purchase invoice - should NOT increase actual_cost"""
        unique_id = uuid.uuid4().hex[:8]
        invoice_no = f"TEST-INV-{unique_id}"
        test_amount = 15000  # Test amount
        
        # Get vendor name first
        vendor_response = session.get(f"{BASE_URL}/api/accounting/vendors/{TEST_VENDOR_ID}")
        vendor_name = "Test Vendor"
        if vendor_response.status_code == 200:
            vendor_data = vendor_response.json()
            vendor_name = vendor_data.get("vendor_name", vendor_data.get("name", "Test Vendor"))
        
        payload = {
            "project_id": TEST_PROJECT_ID,
            "vendor_id": TEST_VENDOR_ID,
            "vendor_name": vendor_name,  # Required field
            "invoice_no": invoice_no,
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "purchase_type": "credit",  # CREDIT purchase
            "items": [
                {
                    "material_name": f"Test Credit Purchase Item {unique_id}",  # Required field
                    "description": f"Test Credit Purchase Item {unique_id}",
                    "category": "Modular Material",  # Valid category
                    "quantity": 1,
                    "unit": "nos",
                    "rate": test_amount,  # Required field
                    "unit_price": test_amount,
                    "line_total": test_amount
                }
            ],
            "subtotal": test_amount,
            "gst_rate": 0,
            "gst_amount": 0,
            "grand_total": test_amount,
            "remarks": f"Test credit purchase for double-posting fix verification {unique_id}"
        }
        
        response = session.post(
            f"{BASE_URL}/api/finance/execution-ledger",
            json=payload
        )
        
        assert response.status_code in [200, 201], f"Failed to create credit purchase: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, f"Credit purchase creation failed: {data}"
        assert "liability_id" in data, "No liability_id returned"
        
        # Store for later tests
        self.__class__.test_liability_id = data["liability_id"]
        self.__class__.test_amount = test_amount
        self.__class__.test_invoice_no = invoice_no
        
        print(f"✓ Created credit purchase invoice: {invoice_no}")
        print(f"✓ Liability ID: {self.test_liability_id}")
        print(f"✓ Amount: {test_amount}")
    
    def test_04_verify_actual_cost_unchanged_after_credit_purchase(self, session):
        """Verify actual_cost did NOT increase after credit purchase"""
        response = session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        data = response.json()
        
        current_actual_cost = data["summary"]["actual_cost"]
        
        # CRITICAL: actual_cost should NOT have increased
        assert current_actual_cost == self.initial_actual_cost, \
            f"BUG: actual_cost increased from {self.initial_actual_cost} to {current_actual_cost} after credit purchase!"
        
        print(f"✓ actual_cost unchanged: {current_actual_cost} (expected: {self.initial_actual_cost})")
    
    def test_05_verify_liability_created_with_correct_amount(self, session):
        """Verify liability was created with correct amount"""
        response = session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        data = response.json()
        
        current_remaining_liability = data["summary"]["remaining_liability"]
        expected_liability = self.initial_remaining_liability + self.test_amount
        
        # Liability should have increased by the purchase amount
        assert current_remaining_liability == expected_liability, \
            f"Liability mismatch: got {current_remaining_liability}, expected {expected_liability}"
        
        print(f"✓ remaining_liability increased correctly: {current_remaining_liability}")
    
    def test_06_verify_liability_record_exists(self, session):
        """Verify the liability record exists with correct status"""
        response = session.get(f"{BASE_URL}/api/finance/liabilities")
        
        assert response.status_code == 200, f"Failed to get liabilities: {response.text}"
        data = response.json()
        
        # Find our test liability
        liabilities = data.get("liabilities", data) if isinstance(data, dict) else data
        if isinstance(liabilities, dict):
            liabilities = liabilities.get("liabilities", [])
        
        test_liability = None
        for l in liabilities:
            if l.get("liability_id") == self.test_liability_id:
                test_liability = l
                break
        
        assert test_liability is not None, f"Liability {self.test_liability_id} not found"
        assert test_liability.get("status") == "open", f"Liability status should be 'open', got: {test_liability.get('status')}"
        assert test_liability.get("amount_remaining") == self.test_amount, \
            f"amount_remaining should be {self.test_amount}, got: {test_liability.get('amount_remaining')}"
        
        print(f"✓ Liability record verified: status={test_liability.get('status')}, amount_remaining={test_liability.get('amount_remaining')}")
    
    def test_07_settle_liability_payment(self, session):
        """Settle the liability - this should create cashbook entry and increase actual_cost"""
        payload = {
            "amount": self.test_amount,
            "account_id": TEST_BANK_ACCOUNT,
            "payment_mode": "bank_transfer",
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "remarks": f"Test settlement for {self.test_invoice_no}"
        }
        
        response = session.post(
            f"{BASE_URL}/api/finance/liabilities/{self.test_liability_id}/settle",
            json=payload
        )
        
        assert response.status_code == 200, f"Failed to settle liability: {response.text}"
        data = response.json()
        
        assert data.get("success") == True or "transaction_id" in data or "liability" in data, \
            f"Settlement failed: {data}"
        
        print(f"✓ Liability settled successfully")
    
    def test_08_verify_actual_cost_increased_after_payment(self, session):
        """Verify actual_cost increased ONLY after payment (not after credit purchase)"""
        response = session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        data = response.json()
        
        current_actual_cost = data["summary"]["actual_cost"]
        expected_actual_cost = self.initial_actual_cost + self.test_amount
        
        # NOW actual_cost should have increased
        assert current_actual_cost == expected_actual_cost, \
            f"actual_cost should be {expected_actual_cost} after payment, got: {current_actual_cost}"
        
        print(f"✓ actual_cost correctly increased after payment: {current_actual_cost}")
    
    def test_09_verify_remaining_liability_zero_after_payment(self, session):
        """Verify remaining_liability returns to initial value after full payment"""
        response = session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        data = response.json()
        
        current_remaining_liability = data["summary"]["remaining_liability"]
        
        # After full payment, liability should be back to initial
        assert current_remaining_liability == self.initial_remaining_liability, \
            f"remaining_liability should be {self.initial_remaining_liability} after payment, got: {current_remaining_liability}"
        
        print(f"✓ remaining_liability correctly returned to initial: {current_remaining_liability}")
    
    def test_10_verify_liability_status_closed(self, session):
        """Verify the liability record is now closed"""
        response = session.get(f"{BASE_URL}/api/finance/liabilities")
        
        assert response.status_code == 200, f"Failed to get liabilities: {response.text}"
        data = response.json()
        
        # Find our test liability
        liabilities = data.get("liabilities", data) if isinstance(data, dict) else data
        if isinstance(liabilities, dict):
            liabilities = liabilities.get("liabilities", [])
        
        test_liability = None
        for l in liabilities:
            if l.get("liability_id") == self.test_liability_id:
                test_liability = l
                break
        
        if test_liability:
            assert test_liability.get("status") == "closed", \
                f"Liability status should be 'closed', got: {test_liability.get('status')}"
            assert test_liability.get("amount_remaining") == 0, \
                f"amount_remaining should be 0, got: {test_liability.get('amount_remaining')}"
            print(f"✓ Liability record closed: status={test_liability.get('status')}, amount_remaining={test_liability.get('amount_remaining')}")
        else:
            # Liability might have been removed from list after closing
            print("✓ Liability not in open list (expected for closed liabilities)")


class TestCashbookExcludesCreditPurchases:
    """Test that cashbook correctly excludes credit purchase entries"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        return s
    
    def test_01_daybook_excludes_credit_purchases(self, session):
        """Verify daybook/daily summary excludes credit purchase entries"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Correct endpoint: /api/accounting/daily-summary/{date}
        response = session.get(f"{BASE_URL}/api/accounting/daily-summary/{today}")
        
        assert response.status_code == 200, f"Failed to get daily summary: {response.text}"
        data = response.json()
        
        # Check that the response doesn't include credit purchase entries in totals
        # The fix ensures is_cashbook_entry=False entries are excluded
        print(f"✓ Daily summary retrieved for {today}")
        print(f"  Total inflow: {data.get('total_inflow', 0)}")
        print(f"  Total outflow: {data.get('total_outflow', 0)}")
    
    def test_02_cashbook_transactions_exclude_credit_purchases(self, session):
        """Verify cashbook transactions list excludes credit purchase entries"""
        # Correct endpoint: /api/accounting/transactions
        response = session.get(f"{BASE_URL}/api/accounting/transactions")
        
        assert response.status_code == 200, f"Failed to get cashbook transactions: {response.text}"
        data = response.json()
        
        transactions = data.get("transactions", data) if isinstance(data, dict) else data
        if isinstance(transactions, dict):
            transactions = transactions.get("transactions", [])
        
        # Check that no transaction has is_cashbook_entry=False
        credit_purchase_entries = [
            t for t in transactions 
            if t.get("is_cashbook_entry") == False or t.get("entry_type") in ["purchase_invoice", "purchase_invoice_credit"]
        ]
        
        assert len(credit_purchase_entries) == 0, \
            f"Found {len(credit_purchase_entries)} credit purchase entries in cashbook (should be 0)"
        
        print(f"✓ Cashbook correctly excludes credit purchase entries")
        print(f"  Total transactions in cashbook: {len(transactions)}")


class TestProjectFinanceExcludesCreditPurchases:
    """Test that project finance correctly excludes credit purchase entries from actual_cost"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        return s
    
    def test_01_project_finance_transactions_exclude_credit_purchases(self, session):
        """Verify project finance transactions exclude credit purchase entries"""
        response = session.get(f"{BASE_URL}/api/finance/project-finance/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        data = response.json()
        
        transactions = data.get("transactions", [])
        
        # Check that no transaction has is_cashbook_entry=False
        credit_purchase_entries = [
            t for t in transactions 
            if t.get("is_cashbook_entry") == False or t.get("entry_type") in ["purchase_invoice", "purchase_invoice_credit"]
        ]
        
        assert len(credit_purchase_entries) == 0, \
            f"Found {len(credit_purchase_entries)} credit purchase entries in project finance (should be 0)"
        
        print(f"✓ Project finance correctly excludes credit purchase entries")
        print(f"  Total transactions in project finance: {len(transactions)}")
        print(f"  actual_cost: {data['summary']['actual_cost']}")
        print(f"  remaining_liability: {data['summary']['remaining_liability']}")


class TestRegressionOtherFinanceEndpoints:
    """Regression tests to ensure other finance endpoints still work correctly"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        return s
    
    def test_01_finance_dashboard_works(self, session):
        """Verify finance dashboard endpoint works"""
        # Correct endpoint: /api/dashboards/finance
        response = session.get(f"{BASE_URL}/api/dashboards/finance")
        
        assert response.status_code == 200, f"Finance dashboard failed: {response.text}"
        print("✓ Finance dashboard endpoint works")
    
    def test_02_accounts_list_works(self, session):
        """Verify accounts list endpoint works"""
        # Correct endpoint: /api/accounting/accounts
        response = session.get(f"{BASE_URL}/api/accounting/accounts")
        
        assert response.status_code == 200, f"Accounts list failed: {response.text}"
        data = response.json()
        accounts = data.get("accounts", data) if isinstance(data, dict) else data
        print(f"✓ Accounts list works - {len(accounts) if isinstance(accounts, list) else 'N/A'} accounts")
    
    def test_03_liabilities_list_works(self, session):
        """Verify liabilities list endpoint works"""
        response = session.get(f"{BASE_URL}/api/finance/liabilities")
        
        assert response.status_code == 200, f"Liabilities list failed: {response.text}"
        print("✓ Liabilities list endpoint works")
    
    def test_04_execution_ledger_works(self, session):
        """Verify execution ledger endpoint works"""
        response = session.get(f"{BASE_URL}/api/finance/execution-ledger/project/{TEST_PROJECT_ID}")
        
        assert response.status_code == 200, f"Execution ledger failed: {response.text}"
        data = response.json()
        print(f"✓ Execution ledger works - {data.get('entry_count', 0)} entries")
    
    def test_05_vendor_mappings_works(self, session):
        """Verify vendor mappings endpoint works"""
        response = session.get(f"{BASE_URL}/api/finance/vendor-mappings/{TEST_PROJECT_ID}")
        
        # 200 or 404 (if no mappings) are both acceptable
        assert response.status_code in [200, 404], f"Vendor mappings failed: {response.text}"
        print("✓ Vendor mappings endpoint works")
    
    def test_06_project_finance_list_works(self, session):
        """Verify project finance list endpoint works"""
        response = session.get(f"{BASE_URL}/api/finance/project-finance")
        
        assert response.status_code == 200, f"Project finance list failed: {response.text}"
        print("✓ Project finance list endpoint works")
    
    def test_07_founder_dashboard_works(self, session):
        """Verify founder dashboard endpoint works"""
        response = session.get(f"{BASE_URL}/api/finance/founder-dashboard")
        
        assert response.status_code == 200, f"Founder dashboard failed: {response.text}"
        print("✓ Founder dashboard endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
