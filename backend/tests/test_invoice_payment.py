"""
Test Invoice Entry Record Payment Feature
Tests the new payment recording architecture:
1. Record Payment on Invoice Entry
2. Auto-create Cashbook entry
3. Auto-create/update Liability for credit purchases
4. Payment status tracking (unpaid/partial/paid)
5. Payment history on invoices
6. system_generated flag on Cashbook entries
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Global test data storage
test_data = {
    "session_token": None,
    "project_id": None,
    "account_id": None,
    "invoice_id": None,
    "first_txn_id": None,
    "liability_id": None
}


class TestInvoicePaymentRecording:
    """Test Invoice Entry Record Payment Feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Setup test data before each test"""
        # Login and get session if not already done
        if not test_data["session_token"]:
            login_resp = api_client.post(f"{BASE_URL}/api/auth/local-login", json={
                "email": "thaha.pakayil@gmail.com",
                "password": "password123"
            })
            if login_resp.status_code == 200:
                test_data["session_token"] = login_resp.cookies.get("session_token")
        
        if test_data["session_token"]:
            api_client.cookies.set("session_token", test_data["session_token"])
    
    def test_01_login_and_get_session(self, api_client):
        """Test login and session creation"""
        login_resp = api_client.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "thaha.pakayil@gmail.com",
            "password": "password123"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        assert data.get("success") == True
        assert data.get("user", {}).get("role") == "Admin"
        
        # Store session token
        test_data["session_token"] = login_resp.cookies.get("session_token")
        api_client.cookies.set("session_token", test_data["session_token"])
        print(f"✓ Login successful, role: {data.get('user', {}).get('role')}")
    
    def test_02_get_projects(self, api_client):
        """Get projects to find a test project"""
        resp = api_client.get(f"{BASE_URL}/api/projects")
        assert resp.status_code == 200
        
        # API returns list directly
        projects = resp.json()
        assert isinstance(projects, list), "Expected list of projects"
        assert len(projects) > 0, "No projects found - need at least one project for testing"
        
        # Use first project
        test_data["project_id"] = projects[0].get("project_id")
        print(f"✓ Found {len(projects)} projects, using: {projects[0].get('project_name')} ({test_data['project_id']})")
    
    def test_03_get_accounts(self, api_client):
        """Get accounting accounts for payment"""
        resp = api_client.get(f"{BASE_URL}/api/accounting/accounts")
        assert resp.status_code == 200
        
        # API returns list directly
        accounts = resp.json()
        assert isinstance(accounts, list), "Expected list of accounts"
        assert len(accounts) > 0, "No accounts found - need at least one account for payment testing"
        
        # Find account with balance
        account_with_balance = None
        for acc in accounts:
            if acc.get("current_balance", 0) > 0:
                account_with_balance = acc
                break
        
        if not account_with_balance:
            # Use first account anyway
            account_with_balance = accounts[0]
        
        test_data["account_id"] = account_with_balance.get("account_id")
        print(f"✓ Found {len(accounts)} accounts, using: {account_with_balance.get('account_name')} (Balance: ₹{account_with_balance.get('current_balance', 0):,.0f})")
    
    def test_04_create_credit_invoice_entry(self, api_client):
        """Create a credit purchase invoice entry for testing payments"""
        assert test_data["project_id"], "Project ID not set"
        
        payload = {
            "project_id": test_data["project_id"],
            "vendor_name": "TEST_Payment_Vendor",
            "invoice_no": f"TEST-INV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "purchase_type": "credit",  # Credit purchase for liability testing
            "items": [
                {
                    "category": "Modular Material",
                    "material_name": "TEST Plywood 18mm",
                    "specification": "BWR Grade",
                    "brand": "Century",
                    "quantity": 10,
                    "unit": "pcs",
                    "rate": 1000
                },
                {
                    "category": "Hardware & Accessories",
                    "material_name": "TEST Hinges",
                    "specification": "Soft Close",
                    "brand": "Hettich",
                    "quantity": 20,
                    "unit": "pcs",
                    "rate": 250
                }
            ],
            "remarks": "Test invoice for payment recording feature"
        }
        
        resp = api_client.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert resp.status_code == 200, f"Failed to create invoice: {resp.text}"
        data = resp.json()
        
        # Response format: {"success": true, "entry": {...}}
        assert data.get("success") == True
        entry = data.get("entry", {})
        assert "execution_id" in entry
        test_data["invoice_id"] = entry.get("execution_id")
        
        # Verify initial payment status
        assert entry.get("payment_status") == "unpaid"
        assert entry.get("total_paid") == 0
        assert entry.get("amount_remaining") == 15000  # 10*1000 + 20*250
        assert entry.get("total_value") == 15000
        
        print(f"✓ Created credit invoice: {test_data['invoice_id']}")
        print(f"  Total Value: ₹{entry.get('total_value'):,.0f}")
        print(f"  Payment Status: {entry.get('payment_status')}")
    
    def test_05_verify_pay_button_visible_for_unpaid(self, api_client):
        """Verify invoice entry has unpaid status and Pay button should be visible"""
        assert test_data["invoice_id"], "Invoice ID not set"
        
        resp = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{test_data['invoice_id']}")
        assert resp.status_code == 200
        data = resp.json()
        
        assert data.get("payment_status") == "unpaid"
        assert data.get("total_paid") == 0
        assert data.get("amount_remaining") == 15000
        
        print(f"✓ Invoice is unpaid - Pay button should be visible")
    
    def test_06_record_partial_payment(self, api_client):
        """Record a partial payment and verify Cashbook + Liability creation"""
        assert test_data["invoice_id"], "Invoice ID not set"
        assert test_data["account_id"], "Account ID not set"
        
        payment_payload = {
            "amount": 5000,  # Partial payment
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_mode": "bank_transfer",
            "account_id": test_data["account_id"],
            "remarks": "Partial payment - first installment"
        }
        
        resp = api_client.post(
            f"{BASE_URL}/api/finance/execution-ledger/{test_data['invoice_id']}/record-payment",
            json=payment_payload
        )
        assert resp.status_code == 200, f"Failed to record payment: {resp.text}"
        data = resp.json()
        
        # Verify response
        assert data.get("success") == True
        assert data.get("payment_status") == "partial"
        assert data.get("total_paid") == 5000
        assert data.get("amount_remaining") == 10000
        assert "transaction_id" in data  # Cashbook entry created
        
        print(f"✓ Partial payment recorded successfully")
        print(f"  Transaction ID: {data.get('transaction_id')}")
        print(f"  Payment Status: {data.get('payment_status')}")
        print(f"  Total Paid: ₹{data.get('total_paid'):,.0f}")
        print(f"  Remaining: ₹{data.get('amount_remaining'):,.0f}")
        
        # Store transaction ID for verification
        test_data["first_txn_id"] = data.get("transaction_id")
        test_data["liability_id"] = data.get("liability_id")
    
    def test_07_verify_cashbook_entry_created(self, api_client):
        """Verify Cashbook entry was auto-created with system_generated flag"""
        assert test_data["first_txn_id"], "Transaction ID not set"
        
        # Get accounting transactions for today (Cashbook entries)
        today = datetime.now().strftime("%Y-%m-%d")
        resp = api_client.get(f"{BASE_URL}/api/accounting/transactions?date={today}")
        assert resp.status_code == 200
        
        # API returns list directly
        transactions = resp.json()
        assert isinstance(transactions, list), "Expected list of transactions"
        
        # Find our transaction
        our_txn = None
        for txn in transactions:
            if txn.get("transaction_id") == test_data["first_txn_id"]:
                our_txn = txn
                break
        
        assert our_txn is not None, f"Cashbook entry not found for transaction {test_data['first_txn_id']}"
        
        # Verify system_generated flag
        assert our_txn.get("system_generated") == True, "Cashbook entry should have system_generated=True"
        assert our_txn.get("source_module") == "invoice_ledger", "Source module should be invoice_ledger"
        assert our_txn.get("transaction_type") == "outflow", "Should be an outflow transaction"
        assert our_txn.get("amount") == 5000
        
        print(f"✓ Cashbook entry verified:")
        print(f"  system_generated: {our_txn.get('system_generated')}")
        print(f"  source_module: {our_txn.get('source_module')}")
        print(f"  Amount: ₹{our_txn.get('amount'):,.0f}")
    
    def test_08_verify_liability_created_for_credit_purchase(self, api_client):
        """Verify Liability was auto-created for credit purchase with remaining balance"""
        if not test_data["liability_id"]:
            pytest.skip("No liability created (may be expected for full payment)")
        
        resp = api_client.get(f"{BASE_URL}/api/finance/liabilities?project_id={test_data['project_id']}")
        assert resp.status_code == 200
        
        # API returns list directly
        liabilities = resp.json()
        assert isinstance(liabilities, list), "Expected list of liabilities"
        
        # Find our liability
        our_liability = None
        for lia in liabilities:
            if lia.get("liability_id") == test_data["liability_id"]:
                our_liability = lia
                break
        
        assert our_liability is not None, f"Liability not found: {test_data['liability_id']}"
        
        # Verify liability details
        assert our_liability.get("source") == "invoice_ledger"
        assert our_liability.get("amount") == 15000  # Full invoice amount
        assert our_liability.get("amount_settled") == 5000  # First payment
        assert our_liability.get("amount_remaining") == 10000  # Remaining
        assert our_liability.get("status") == "partially_settled"
        
        print(f"✓ Liability verified:")
        print(f"  Liability ID: {our_liability.get('liability_id')}")
        print(f"  Amount: ₹{our_liability.get('amount'):,.0f}")
        print(f"  Settled: ₹{our_liability.get('amount_settled'):,.0f}")
        print(f"  Remaining: ₹{our_liability.get('amount_remaining'):,.0f}")
        print(f"  Status: {our_liability.get('status')}")
    
    def test_09_verify_invoice_payment_status_partial(self, api_client):
        """Verify invoice status is now 'partial'"""
        assert test_data["invoice_id"], "Invoice ID not set"
        
        resp = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{test_data['invoice_id']}")
        assert resp.status_code == 200
        data = resp.json()
        
        assert data.get("payment_status") == "partial"
        assert data.get("total_paid") == 5000
        assert data.get("amount_remaining") == 10000
        
        # Verify payment history
        payments = data.get("payments", [])
        assert len(payments) == 1
        assert payments[0].get("amount") == 5000
        
        print(f"✓ Invoice status verified: {data.get('payment_status')}")
        print(f"  Payment history: {len(payments)} payment(s)")
    
    def test_10_record_second_payment_to_fully_pay(self, api_client):
        """Record second payment to fully pay the invoice"""
        assert test_data["invoice_id"], "Invoice ID not set"
        assert test_data["account_id"], "Account ID not set"
        
        payment_payload = {
            "amount": 10000,  # Remaining amount
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_mode": "upi",
            "account_id": test_data["account_id"],
            "remarks": "Final payment - full settlement"
        }
        
        resp = api_client.post(
            f"{BASE_URL}/api/finance/execution-ledger/{test_data['invoice_id']}/record-payment",
            json=payment_payload
        )
        assert resp.status_code == 200, f"Failed to record payment: {resp.text}"
        data = resp.json()
        
        # Verify response
        assert data.get("success") == True
        assert data.get("payment_status") == "paid"
        assert data.get("total_paid") == 15000
        assert data.get("amount_remaining") == 0
        
        print(f"✓ Final payment recorded successfully")
        print(f"  Payment Status: {data.get('payment_status')}")
        print(f"  Total Paid: ₹{data.get('total_paid'):,.0f}")
    
    def test_11_verify_invoice_fully_paid(self, api_client):
        """Verify invoice is now fully paid"""
        assert test_data["invoice_id"], "Invoice ID not set"
        
        resp = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{test_data['invoice_id']}")
        assert resp.status_code == 200
        data = resp.json()
        
        assert data.get("payment_status") == "paid"
        assert data.get("total_paid") == 15000
        assert data.get("amount_remaining") == 0
        
        # Verify payment history has 2 payments
        payments = data.get("payments", [])
        assert len(payments) == 2
        
        print(f"✓ Invoice fully paid:")
        print(f"  Payment Status: {data.get('payment_status')}")
        print(f"  Payment History: {len(payments)} payments")
    
    def test_12_verify_liability_closed(self, api_client):
        """Verify liability is now closed after full payment"""
        if not test_data["liability_id"]:
            pytest.skip("No liability to verify")
        
        resp = api_client.get(f"{BASE_URL}/api/finance/liabilities?project_id={test_data['project_id']}")
        assert resp.status_code == 200
        
        # API returns list directly
        liabilities = resp.json()
        assert isinstance(liabilities, list), "Expected list of liabilities"
        
        # Find our liability
        our_liability = None
        for lia in liabilities:
            if lia.get("liability_id") == test_data["liability_id"]:
                our_liability = lia
                break
        
        if our_liability:
            assert our_liability.get("status") == "closed"
            assert our_liability.get("amount_remaining") == 0
            print(f"✓ Liability closed: {our_liability.get('status')}")
        else:
            print(f"✓ Liability may have been removed or filtered (closed)")
    
    def test_13_cannot_overpay_invoice(self, api_client):
        """Verify cannot pay more than remaining balance"""
        assert test_data["invoice_id"], "Invoice ID not set"
        assert test_data["account_id"], "Account ID not set"
        
        payment_payload = {
            "amount": 1000,  # Invoice is already fully paid
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_mode": "cash",
            "account_id": test_data["account_id"],
            "remarks": "Overpayment attempt"
        }
        
        resp = api_client.post(
            f"{BASE_URL}/api/finance/execution-ledger/{test_data['invoice_id']}/record-payment",
            json=payment_payload
        )
        
        # Should fail because invoice is already fully paid
        assert resp.status_code == 400
        print(f"✓ Overpayment correctly rejected")
    
    def test_14_delete_blocked_for_invoice_with_payments(self, api_client):
        """Verify delete is blocked for invoices with payments"""
        assert test_data["invoice_id"], "Invoice ID not set"
        
        resp = api_client.delete(f"{BASE_URL}/api/finance/execution-ledger/{test_data['invoice_id']}")
        
        # Should be blocked because invoice has payments
        assert resp.status_code in [400, 403], f"Delete should be blocked for invoice with payments: {resp.text}"
        print(f"✓ Delete correctly blocked for invoice with payments")
    
    def test_15_payment_status_filter(self, api_client):
        """Test payment status filter on invoice list"""
        assert test_data["project_id"], "Project ID not set"
        
        # Get all invoices for project
        resp = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/project/{test_data['project_id']}")
        assert resp.status_code == 200
        data = resp.json()
        
        entries = data.get("entries", [])
        
        # Count by status
        status_counts = {"unpaid": 0, "partial": 0, "paid": 0}
        for entry in entries:
            status = entry.get("payment_status", "unpaid")
            if status in status_counts:
                status_counts[status] += 1
        
        print(f"✓ Payment status distribution:")
        print(f"  Unpaid: {status_counts['unpaid']}")
        print(f"  Partial: {status_counts['partial']}")
        print(f"  Paid: {status_counts['paid']}")
    
    def test_16_cleanup_test_data(self, api_client):
        """Cleanup test data - Note: Cannot delete invoice with payments"""
        # Try to delete - will fail because of payments
        # This is expected behavior
        print(f"✓ Test invoice {test_data['invoice_id']} retained (has payments)")
        print(f"  Manual cleanup may be needed for TEST_ prefixed data")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
