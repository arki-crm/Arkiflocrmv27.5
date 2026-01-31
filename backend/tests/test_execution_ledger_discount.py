"""
Test Execution Ledger Invoice-Level Vendor Discount Feature
Tests:
1. Create invoice with flat discount
2. Create invoice with percentage discount
3. Verify gross_total, discount_amount, net_payable calculations
4. Update invoice discount
5. Record payment against net_payable (not gross)
6. Verify amount_remaining calculated from net_payable
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', '')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    session.cookies.set("session_token", SESSION_TOKEN)
    return session

@pytest.fixture(scope="module")
def test_project_id():
    """Use existing test project"""
    return "proj_0a79eb51"

@pytest.fixture(scope="module")
def test_account(api_client):
    """Get or create a test account for payments"""
    # Get existing accounts
    res = api_client.get(f"{BASE_URL}/api/finance/accounts")
    if res.status_code == 200:
        accounts = res.json().get("accounts", [])
        if accounts:
            return accounts[0]
    
    # Create test account if none exists
    account_data = {
        "name": "Test Cash Account",
        "account_type": "cash",
        "opening_balance": 100000,
        "opening_date": datetime.now().strftime("%Y-%m-%d")
    }
    res = api_client.post(f"{BASE_URL}/api/finance/accounts", json=account_data)
    if res.status_code in [200, 201]:
        return res.json().get("account", {})
    return None


class TestAuthVerification:
    """Verify authentication is working"""
    
    def test_auth_me(self, api_client):
        """Verify session is valid"""
        res = api_client.get(f"{BASE_URL}/api/auth/me")
        assert res.status_code == 200, f"Auth failed: {res.text}"
        data = res.json()
        assert "user_id" in data
        assert data.get("role") in ["Admin", "Founder", "ProjectManager"]
        print(f"✓ Authenticated as {data.get('name')} ({data.get('role')})")


class TestExecutionLedgerDiscountCreate:
    """Test creating invoices with discounts"""
    
    def test_create_invoice_with_flat_discount(self, api_client, test_project_id):
        """Create invoice with flat discount - verify calculations"""
        unique_id = uuid.uuid4().hex[:6]
        invoice_data = {
            "project_id": test_project_id,
            "vendor_name": f"Flat Discount Vendor {unique_id}",
            "invoice_no": f"INV-FLAT-{unique_id}",
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "purchase_type": "credit",
            "items": [
                {
                    "category": "Plywood",
                    "material_name": "BWP Plywood 18mm",
                    "quantity": 10,
                    "unit": "sqft",
                    "rate": 150
                },
                {
                    "category": "Hardware",
                    "material_name": "Soft Close Hinges",
                    "quantity": 20,
                    "unit": "pcs",
                    "rate": 250
                }
            ],
            "discount_type": "flat",
            "discount_value": 500
        }
        
        res = api_client.post(f"{BASE_URL}/api/finance/execution-ledger", json=invoice_data)
        assert res.status_code == 200, f"Create failed: {res.text}"
        
        data = res.json()
        assert data.get("success") is True
        entry = data.get("entry", {})
        
        # Verify calculations
        # Gross = (10 * 150) + (20 * 250) = 1500 + 5000 = 6500
        expected_gross = 6500
        expected_discount = 500  # Flat discount
        expected_net = expected_gross - expected_discount  # 6000
        
        assert entry.get("gross_total") == expected_gross, f"Gross total mismatch: {entry.get('gross_total')} != {expected_gross}"
        assert entry.get("discount_type") == "flat"
        assert entry.get("discount_value") == 500
        assert entry.get("discount_amount") == expected_discount, f"Discount amount mismatch: {entry.get('discount_amount')} != {expected_discount}"
        assert entry.get("net_payable") == expected_net, f"Net payable mismatch: {entry.get('net_payable')} != {expected_net}"
        assert entry.get("total_value") == expected_net  # backward compat
        assert entry.get("amount_remaining") == expected_net
        assert entry.get("payment_status") == "unpaid"
        
        print(f"✓ Flat discount invoice created: Gross={expected_gross}, Discount={expected_discount}, Net={expected_net}")
        
        # Store for later tests
        pytest.flat_discount_entry_id = entry.get("execution_id")
        pytest.flat_discount_net = expected_net
    
    def test_create_invoice_with_percentage_discount(self, api_client, test_project_id):
        """Create invoice with percentage discount - verify calculations"""
        unique_id = uuid.uuid4().hex[:6]
        invoice_data = {
            "project_id": test_project_id,
            "vendor_name": f"Percent Discount Vendor {unique_id}",
            "invoice_no": f"INV-PCT-{unique_id}",
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "purchase_type": "credit",
            "items": [
                {
                    "category": "Laminate",
                    "material_name": "Merino Laminate",
                    "quantity": 50,
                    "unit": "sqft",
                    "rate": 100
                },
                {
                    "category": "Edge Band",
                    "material_name": "PVC Edge Band 2mm",
                    "quantity": 100,
                    "unit": "meter",
                    "rate": 25
                }
            ],
            "discount_type": "percentage",
            "discount_value": 10  # 10% discount
        }
        
        res = api_client.post(f"{BASE_URL}/api/finance/execution-ledger", json=invoice_data)
        assert res.status_code == 200, f"Create failed: {res.text}"
        
        data = res.json()
        assert data.get("success") is True
        entry = data.get("entry", {})
        
        # Verify calculations
        # Gross = (50 * 100) + (100 * 25) = 5000 + 2500 = 7500
        expected_gross = 7500
        expected_discount = expected_gross * 0.10  # 10% = 750
        expected_net = expected_gross - expected_discount  # 6750
        
        assert entry.get("gross_total") == expected_gross, f"Gross total mismatch: {entry.get('gross_total')} != {expected_gross}"
        assert entry.get("discount_type") == "percentage"
        assert entry.get("discount_value") == 10
        assert entry.get("discount_amount") == expected_discount, f"Discount amount mismatch: {entry.get('discount_amount')} != {expected_discount}"
        assert entry.get("net_payable") == expected_net, f"Net payable mismatch: {entry.get('net_payable')} != {expected_net}"
        assert entry.get("total_value") == expected_net
        assert entry.get("amount_remaining") == expected_net
        
        print(f"✓ Percentage discount invoice created: Gross={expected_gross}, Discount={expected_discount} (10%), Net={expected_net}")
        
        pytest.pct_discount_entry_id = entry.get("execution_id")
        pytest.pct_discount_net = expected_net
    
    def test_create_invoice_without_discount(self, api_client, test_project_id):
        """Create invoice without discount - verify gross equals net"""
        unique_id = uuid.uuid4().hex[:6]
        invoice_data = {
            "project_id": test_project_id,
            "vendor_name": f"No Discount Vendor {unique_id}",
            "invoice_no": f"INV-NODSC-{unique_id}",
            "execution_date": datetime.now().strftime("%Y-%m-%d"),
            "purchase_type": "credit",
            "items": [
                {
                    "category": "Glass",
                    "material_name": "Toughened Glass 8mm",
                    "quantity": 20,
                    "unit": "sqft",
                    "rate": 200
                }
            ]
            # No discount_type or discount_value
        }
        
        res = api_client.post(f"{BASE_URL}/api/finance/execution-ledger", json=invoice_data)
        assert res.status_code == 200, f"Create failed: {res.text}"
        
        data = res.json()
        entry = data.get("entry", {})
        
        # Gross = 20 * 200 = 4000
        expected_gross = 4000
        
        assert entry.get("gross_total") == expected_gross
        assert entry.get("discount_amount") == 0 or entry.get("discount_amount") is None or entry.get("discount_amount") == 0
        assert entry.get("net_payable") == expected_gross  # No discount, net = gross
        assert entry.get("total_value") == expected_gross
        
        print(f"✓ No discount invoice: Gross={expected_gross}, Net={expected_gross}")
        
        pytest.no_discount_entry_id = entry.get("execution_id")


class TestExecutionLedgerDiscountUpdate:
    """Test updating invoice discounts"""
    
    def test_update_discount_type_and_value(self, api_client):
        """Update discount from flat to percentage"""
        if not hasattr(pytest, 'flat_discount_entry_id'):
            pytest.skip("No flat discount entry created")
        
        entry_id = pytest.flat_discount_entry_id
        
        # First get current entry
        res = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        assert res.status_code == 200
        original = res.json()
        original_gross = original.get("gross_total")
        
        # Update to 5% discount
        update_data = {
            "discount_type": "percentage",
            "discount_value": 5
        }
        
        res = api_client.put(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}", json=update_data)
        assert res.status_code == 200, f"Update failed: {res.text}"
        
        data = res.json()
        entry = data.get("entry", {})
        
        # Verify new calculations
        expected_discount = original_gross * 0.05  # 5% of 6500 = 325
        expected_net = original_gross - expected_discount  # 6175
        
        assert entry.get("discount_type") == "percentage"
        assert entry.get("discount_value") == 5
        assert entry.get("discount_amount") == expected_discount, f"Discount mismatch: {entry.get('discount_amount')} != {expected_discount}"
        assert entry.get("net_payable") == expected_net, f"Net mismatch: {entry.get('net_payable')} != {expected_net}"
        
        # Verify edit history recorded
        assert len(entry.get("edit_history", [])) > 0
        
        print(f"✓ Discount updated: 5% of {original_gross} = {expected_discount}, Net = {expected_net}")


class TestExecutionLedgerPaymentAgainstNetPayable:
    """Test that payments are recorded against net_payable, not gross"""
    
    def test_record_payment_against_net_payable(self, api_client, test_account):
        """Record payment - verify remaining calculated from net_payable"""
        if not hasattr(pytest, 'pct_discount_entry_id'):
            pytest.skip("No percentage discount entry created")
        
        if not test_account:
            pytest.skip("No test account available")
        
        entry_id = pytest.pct_discount_entry_id
        net_payable = pytest.pct_discount_net  # 6750
        
        # Record partial payment
        payment_amount = 3000
        payment_data = {
            "amount": payment_amount,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_mode": "bank_transfer",
            "account_id": test_account.get("account_id"),
            "remarks": "Test partial payment"
        }
        
        res = api_client.post(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}/record-payment", json=payment_data)
        assert res.status_code == 200, f"Payment failed: {res.text}"
        
        # Verify entry updated
        res = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        assert res.status_code == 200
        entry = res.json()
        
        expected_remaining = net_payable - payment_amount  # 6750 - 3000 = 3750
        
        assert entry.get("total_paid") == payment_amount
        assert entry.get("amount_remaining") == expected_remaining, f"Remaining mismatch: {entry.get('amount_remaining')} != {expected_remaining}"
        assert entry.get("payment_status") == "partial"
        assert len(entry.get("payments", [])) == 1
        
        print(f"✓ Payment recorded: Paid={payment_amount}, Remaining={expected_remaining} (from net_payable={net_payable})")
    
    def test_payment_cannot_exceed_remaining(self, api_client, test_account):
        """Verify payment cannot exceed remaining balance"""
        if not hasattr(pytest, 'pct_discount_entry_id'):
            pytest.skip("No percentage discount entry created")
        
        if not test_account:
            pytest.skip("No test account available")
        
        entry_id = pytest.pct_discount_entry_id
        
        # Get current remaining
        res = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        entry = res.json()
        remaining = entry.get("amount_remaining", 0)
        
        # Try to pay more than remaining
        payment_data = {
            "amount": remaining + 1000,  # Exceeds remaining
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "payment_mode": "bank_transfer",
            "account_id": test_account.get("account_id")
        }
        
        res = api_client.post(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}/record-payment", json=payment_data)
        assert res.status_code == 400, f"Should reject overpayment: {res.text}"
        
        print(f"✓ Overpayment correctly rejected (tried {remaining + 1000}, remaining was {remaining})")


class TestExecutionLedgerListView:
    """Test list view shows discount info correctly"""
    
    def test_list_shows_discount_fields(self, api_client, test_project_id):
        """Verify list endpoint returns discount fields"""
        res = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/project/{test_project_id}")
        assert res.status_code == 200, f"List failed: {res.text}"
        
        data = res.json()
        entries = data.get("entries", [])
        
        # Find entries with discounts
        discounted_entries = [e for e in entries if e.get("discount_amount", 0) > 0]
        
        if discounted_entries:
            entry = discounted_entries[0]
            # Verify all discount fields present
            assert "gross_total" in entry
            assert "discount_type" in entry
            assert "discount_value" in entry
            assert "discount_amount" in entry
            assert "net_payable" in entry
            
            print(f"✓ List view includes discount fields: gross={entry.get('gross_total')}, discount={entry.get('discount_amount')}, net={entry.get('net_payable')}")
        else:
            print("⚠ No discounted entries found in list")


class TestExistingTestInvoices:
    """Verify the existing test invoices mentioned in context"""
    
    def test_verify_existing_5pct_discount_invoice(self, api_client):
        """Verify exec_07f38e72eff1 - 5% discount invoice"""
        entry_id = "exec_07f38e72eff1"
        
        res = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        if res.status_code == 404:
            pytest.skip("Test invoice exec_07f38e72eff1 not found")
        
        assert res.status_code == 200
        entry = res.json()
        
        # Expected: Gross ₹17,250, 5% discount, Net ₹16,387.50
        assert entry.get("discount_type") == "percentage"
        assert entry.get("discount_value") == 5
        
        gross = entry.get("gross_total", 0)
        discount = entry.get("discount_amount", 0)
        net = entry.get("net_payable", 0)
        
        # Verify discount calculation
        expected_discount = gross * 0.05
        assert abs(discount - expected_discount) < 1, f"Discount mismatch: {discount} != {expected_discount}"
        assert abs(net - (gross - discount)) < 1, f"Net mismatch: {net} != {gross - discount}"
        
        print(f"✓ Existing 5% discount invoice verified: Gross={gross}, Discount={discount}, Net={net}")
    
    def test_verify_existing_flat_discount_invoice(self, api_client):
        """Verify exec_d812dc9c57c8 - flat ₹2,000 discount invoice"""
        entry_id = "exec_d812dc9c57c8"
        
        res = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        if res.status_code == 404:
            pytest.skip("Test invoice exec_d812dc9c57c8 not found")
        
        assert res.status_code == 200
        entry = res.json()
        
        # Expected: Gross ₹25,000, Flat ₹2,000 discount, Net ₹23,000
        assert entry.get("discount_type") == "flat"
        assert entry.get("discount_value") == 2000
        assert entry.get("discount_amount") == 2000
        
        gross = entry.get("gross_total", 0)
        net = entry.get("net_payable", 0)
        
        assert net == gross - 2000, f"Net mismatch: {net} != {gross - 2000}"
        
        print(f"✓ Existing flat discount invoice verified: Gross={gross}, Discount=2000, Net={net}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
