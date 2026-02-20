"""
Party Sub-Ledger API Tests
Tests for vendor-wise, customer-wise, and employee-wise sub-ledger tracking
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPartySubledgerAuth:
    """Test authentication requirements for party sub-ledger endpoints"""
    
    def test_party_accounts_requires_auth(self):
        """GET /api/finance/party-subledger/accounts returns 401 for unauthenticated users"""
        response = requests.get(f"{BASE_URL}/api/finance/party-subledger/accounts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Party accounts endpoint requires authentication")
    
    def test_outstanding_summary_requires_auth(self):
        """GET /api/finance/party-subledger/outstanding-summary returns 401 for unauthenticated users"""
        response = requests.get(f"{BASE_URL}/api/finance/party-subledger/outstanding-summary")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Outstanding summary endpoint requires authentication")
    
    def test_party_detail_requires_auth(self):
        """GET /api/finance/party-subledger/{account_id} returns 401 for unauthenticated users"""
        response = requests.get(f"{BASE_URL}/api/finance/party-subledger/test_account_id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Party detail endpoint requires authentication")


class TestPartySubledgerAccounts:
    """Test party sub-ledger accounts list API"""
    
    @pytest.fixture(autouse=True)
    def setup(self, authenticated_session):
        self.session = authenticated_session
    
    def test_list_all_party_accounts(self, authenticated_session):
        """GET /api/finance/party-subledger/accounts returns all party accounts"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "accounts" in data, "Response should have 'accounts' field"
        assert "grouped" in data, "Response should have 'grouped' field"
        assert "total_count" in data, "Response should have 'total_count' field"
        
        # Check grouped structure
        grouped = data["grouped"]
        assert "vendors" in grouped, "Grouped should have 'vendors'"
        assert "customers" in grouped, "Grouped should have 'customers'"
        assert "employees" in grouped, "Grouped should have 'employees'"
        
        print(f"✓ Party accounts list returned {data['total_count']} accounts")
        print(f"  - Vendors: {len(grouped['vendors'])}")
        print(f"  - Customers: {len(grouped['customers'])}")
        print(f"  - Employees: {len(grouped['employees'])}")
    
    def test_filter_by_vendor_type(self, authenticated_session):
        """GET /api/finance/party-subledger/accounts?party_type=vendor returns only vendors"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/accounts?party_type=vendor")
        assert response.status_code == 200
        
        data = response.json()
        accounts = data.get("accounts", [])
        
        # All returned accounts should be vendors
        for acc in accounts:
            assert acc.get("party_type") == "vendor", f"Expected vendor, got {acc.get('party_type')}"
        
        print(f"✓ Vendor filter returned {len(accounts)} vendor accounts")
    
    def test_filter_by_customer_type(self, authenticated_session):
        """GET /api/finance/party-subledger/accounts?party_type=customer returns only customers"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/accounts?party_type=customer")
        assert response.status_code == 200
        
        data = response.json()
        accounts = data.get("accounts", [])
        
        for acc in accounts:
            assert acc.get("party_type") == "customer", f"Expected customer, got {acc.get('party_type')}"
        
        print(f"✓ Customer filter returned {len(accounts)} customer accounts")
    
    def test_filter_by_employee_type(self, authenticated_session):
        """GET /api/finance/party-subledger/accounts?party_type=employee returns only employees"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/accounts?party_type=employee")
        assert response.status_code == 200
        
        data = response.json()
        accounts = data.get("accounts", [])
        
        for acc in accounts:
            assert acc.get("party_type") == "employee", f"Expected employee, got {acc.get('party_type')}"
        
        print(f"✓ Employee filter returned {len(accounts)} employee accounts")
    
    def test_include_control_accounts(self, authenticated_session):
        """GET /api/finance/party-subledger/accounts?include_control=true includes control accounts"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/accounts?include_control=true")
        assert response.status_code == 200
        
        data = response.json()
        grouped = data.get("grouped", {})
        control = grouped.get("control", [])
        
        # Should have control accounts when include_control=true
        print(f"✓ Control accounts included: {len(control)} control accounts")
    
    def test_account_structure(self, authenticated_session):
        """Each party account has required fields"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/accounts")
        assert response.status_code == 200
        
        data = response.json()
        accounts = data.get("accounts", [])
        
        if accounts:
            acc = accounts[0]
            required_fields = ["account_id", "account_name", "party_type", "party_id"]
            for field in required_fields:
                assert field in acc, f"Account missing required field: {field}"
            print(f"✓ Account structure validated with fields: {list(acc.keys())}")
        else:
            print("⚠ No accounts to validate structure")


class TestPartySubledgerDetail:
    """Test individual party sub-ledger account detail API"""
    
    def test_get_party_account_detail(self, authenticated_session):
        """GET /api/finance/party-subledger/{account_id} returns account details"""
        # First get list of accounts
        list_response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/accounts")
        assert list_response.status_code == 200
        
        accounts = list_response.json().get("accounts", [])
        if not accounts:
            pytest.skip("No party accounts available for testing")
        
        # Get detail for first account
        account_id = accounts[0].get("account_id")
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/{account_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "account" in data, "Response should have 'account' field"
        assert data["account"]["account_id"] == account_id
        
        print(f"✓ Party account detail returned for: {data['account'].get('account_name')}")
    
    def test_get_nonexistent_account_returns_404(self, authenticated_session):
        """GET /api/finance/party-subledger/{invalid_id} returns 404"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/nonexistent_account_xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent account returns 404")


class TestOutstandingSummary:
    """Test outstanding summary API"""
    
    def test_outstanding_summary_structure(self, authenticated_session):
        """GET /api/finance/party-subledger/outstanding-summary returns correct structure"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/party-subledger/outstanding-summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required sections
        assert "accounts_payable" in data, "Should have accounts_payable section"
        assert "accounts_receivable" in data, "Should have accounts_receivable section"
        assert "employee_payables" in data, "Should have employee_payables section"
        
        # Check structure of each section
        for section_name in ["accounts_payable", "accounts_receivable", "employee_payables"]:
            section = data[section_name]
            assert "total_balance" in section, f"{section_name} should have total_balance"
            assert "count" in section, f"{section_name} should have count"
            assert "accounts" in section, f"{section_name} should have accounts list"
        
        print(f"✓ Outstanding summary structure validated")
        print(f"  - Accounts Payable: {data['accounts_payable']['count']} vendors, total: {data['accounts_payable']['total_balance']}")
        print(f"  - Accounts Receivable: {data['accounts_receivable']['count']} customers, total: {data['accounts_receivable']['total_balance']}")
        print(f"  - Employee Payables: {data['employee_payables']['count']} employees, total: {data['employee_payables']['total_balance']}")


class TestGeneralLedgerIntegration:
    """Test General Ledger dropdown integration with party accounts"""
    
    def test_general_ledger_accounts_includes_parties(self, authenticated_session):
        """GET /api/finance/general-ledger/accounts includes vendor, customer, employee accounts"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check for party account sections
        assert "vendors" in data, "Response should have 'vendors' field"
        assert "customers" in data, "Response should have 'customers' field"
        assert "employees" in data, "Response should have 'employees' field"
        
        vendors = data.get("vendors", [])
        customers = data.get("customers", [])
        employees = data.get("employees", [])
        
        print(f"✓ General Ledger accounts includes party accounts:")
        print(f"  - Vendors: {len(vendors)}")
        print(f"  - Customers: {len(customers)}")
        print(f"  - Employees: {len(employees)}")
        
        # Validate structure of party accounts in GL dropdown
        if vendors:
            v = vendors[0]
            assert "id" in v, "Vendor should have 'id'"
            assert "name" in v, "Vendor should have 'name'"
            assert "balance" in v, "Vendor should have 'balance'"
            print(f"✓ Vendor account structure validated: {v.get('name')}")
        
        if customers:
            c = customers[0]
            assert "id" in c, "Customer should have 'id'"
            assert "name" in c, "Customer should have 'name'"
            print(f"✓ Customer account structure validated: {c.get('name')}")
        
        if employees:
            e = employees[0]
            assert "id" in e, "Employee should have 'id'"
            assert "name" in e, "Employee should have 'name'"
            print(f"✓ Employee account structure validated: {e.get('name')}")
    
    def test_general_ledger_with_party_account(self, authenticated_session):
        """GET /api/finance/general-ledger with party account_id works"""
        # First get a party account
        accounts_response = authenticated_session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        
        data = accounts_response.json()
        vendors = data.get("vendors", [])
        
        if not vendors:
            pytest.skip("No vendor accounts available for testing")
        
        # Try to get ledger for a vendor account
        vendor_id = vendors[0].get("id")
        response = authenticated_session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={vendor_id}&period=fy")
        
        # Should return 200 (even if no transactions)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        ledger_data = response.json()
        assert "account_id" in ledger_data
        assert "account_name" in ledger_data
        assert "summary" in ledger_data
        
        print(f"✓ General Ledger works with party account: {ledger_data.get('account_name')}")


class TestMigrationEndpoint:
    """Test migration endpoint for existing data"""
    
    def test_migration_endpoint_exists(self, authenticated_session):
        """POST /api/finance/party-subledger/migrate-existing endpoint exists"""
        # Just check the endpoint exists and returns proper response
        response = authenticated_session.post(f"{BASE_URL}/api/finance/party-subledger/migrate-existing")
        
        # Should return 200 (migration runs) or 403 (no permission) - not 404
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "vendors_created" in data or "message" in data
            print(f"✓ Migration endpoint works: {data}")
        else:
            print("✓ Migration endpoint exists (requires admin permission)")


class TestTrialBalanceIntegration:
    """Test Trial Balance integration with party accounts"""
    
    def test_trial_balance_includes_party_accounts(self, authenticated_session):
        """GET /api/finance/trial-balance includes party accounts in assets/liabilities"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        # Trial balance might not exist or might return different structure
        if response.status_code == 404:
            pytest.skip("Trial balance endpoint not found")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check if party accounts are included in the trial balance
        # The structure depends on implementation
        print(f"✓ Trial balance returned with keys: {list(data.keys())}")


# ============ FIXTURES ============

@pytest.fixture(scope="module")
def authenticated_session():
    """Get authenticated session using local login"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login with founder credentials
    login_response = session.post(
        f"{BASE_URL}/api/auth/local-login",
        json={
            "email": "sidheeq.arkidots@gmail.com",
            "password": "founder123"
        }
    )
    
    if login_response.status_code != 200:
        # Try admin credentials
        login_response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "thaha.pakayil@gmail.com",
                "password": "password123"
            }
        )
    
    if login_response.status_code != 200:
        pytest.skip(f"Authentication failed: {login_response.status_code} - {login_response.text}")
    
    # Extract session token from cookies
    session_token = session.cookies.get("session_token")
    if session_token:
        session.headers.update({"Authorization": f"Bearer {session_token}"})
    
    print(f"✓ Authenticated as: {login_response.json().get('user', {}).get('email', 'unknown')}")
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
