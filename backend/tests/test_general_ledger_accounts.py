"""
Test General Ledger Accounts API - Party Sub-ledger Filter Fix
Tests the /api/finance/general-ledger/accounts endpoint to verify:
1. Customers are returned from projects and accounting_transactions
2. Vendors are returned from finance_vendors (using 'name' field) and accounting_transactions
3. Employees are returned from users collection and accounting_transactions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Session-scoped fixture to avoid rate limiting
@pytest.fixture(scope="module")
def auth_session():
    """Login once and reuse session for all tests"""
    session = requests.Session()
    login_response = session.post(
        f"{BASE_URL}/api/auth/local-login",
        json={"email": "sidheeq.arkidots@gmail.com", "password": "founder123"}
    )
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    assert login_response.json().get("success") == True
    return session


@pytest.fixture(scope="module")
def accounts_data(auth_session):
    """Fetch accounts data once and reuse"""
    response = auth_session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
    assert response.status_code == 200
    return response.json()


class TestGeneralLedgerAccounts:
    """Test General Ledger accounts endpoint with party filters"""
    
    def test_endpoint_returns_200(self, auth_session):
        """Test that the endpoint returns 200 OK"""
        response = auth_session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_response_structure(self, accounts_data):
        """Test that response has all required fields"""
        data = accounts_data
        
        # Check main structure
        assert "accounts" in data, "Missing 'accounts' field"
        assert "categories" in data, "Missing 'categories' field"
        assert "control_accounts" in data, "Missing 'control_accounts' field"
        assert "party_filters" in data, "Missing 'party_filters' field"
        assert "all_accounts_option" in data, "Missing 'all_accounts_option' field"
        
        # Check party_filters structure
        pf = data["party_filters"]
        assert "customers" in pf, "Missing 'customers' in party_filters"
        assert "vendors" in pf, "Missing 'vendors' in party_filters"
        assert "employees" in pf, "Missing 'employees' in party_filters"
        assert "projects" in pf, "Missing 'projects' in party_filters"
    
    def test_customers_not_empty(self, accounts_data):
        """Test that customers list is NOT empty (was the bug)"""
        customers = accounts_data["party_filters"]["customers"]
        
        assert len(customers) > 0, "Customers list is empty - BUG NOT FIXED"
        print(f"✓ Found {len(customers)} customers")
        
        # Verify customer structure
        for c in customers[:3]:
            assert "id" in c, f"Customer missing 'id': {c}"
            assert "name" in c, f"Customer missing 'name': {c}"
            assert c["name"] is not None, f"Customer name is None: {c}"
    
    def test_vendors_not_empty(self, accounts_data):
        """Test that vendors list is NOT empty (was the bug)"""
        vendors = accounts_data["party_filters"]["vendors"]
        
        assert len(vendors) > 0, "Vendors list is empty - BUG NOT FIXED"
        print(f"✓ Found {len(vendors)} vendors")
        
        # Verify vendor structure
        for v in vendors[:3]:
            assert "id" in v, f"Vendor missing 'id': {v}"
            assert "name" in v, f"Vendor missing 'name': {v}"
            assert v["name"] is not None, f"Vendor name is None: {v}"
    
    def test_employees_not_empty(self, accounts_data):
        """Test that employees list is NOT empty (was the bug)"""
        employees = accounts_data["party_filters"]["employees"]
        
        assert len(employees) > 0, "Employees list is empty - BUG NOT FIXED"
        print(f"✓ Found {len(employees)} employees")
        
        # Verify employee structure
        for e in employees[:3]:
            assert "id" in e, f"Employee missing 'id': {e}"
            assert "name" in e, f"Employee missing 'name': {e}"
            assert e["name"] is not None, f"Employee name is None: {e}"
    
    def test_projects_not_empty(self, accounts_data):
        """Test that projects list is NOT empty"""
        projects = accounts_data["party_filters"]["projects"]
        
        assert len(projects) > 0, "Projects list is empty"
        print(f"✓ Found {len(projects)} projects")
    
    def test_expected_counts(self, accounts_data):
        """Test that counts match expected values from fix"""
        pf = accounts_data["party_filters"]
        
        # Expected counts from the fix
        assert len(pf["customers"]) >= 20, f"Expected at least 20 customers, got {len(pf['customers'])}"
        assert len(pf["vendors"]) >= 15, f"Expected at least 15 vendors, got {len(pf['vendors'])}"
        assert len(pf["employees"]) >= 40, f"Expected at least 40 employees, got {len(pf['employees'])}"
        assert len(pf["projects"]) >= 20, f"Expected at least 20 projects, got {len(pf['projects'])}"
        
        print(f"✓ Customers: {len(pf['customers'])} (expected ~26)")
        print(f"✓ Vendors: {len(pf['vendors'])} (expected ~19)")
        print(f"✓ Employees: {len(pf['employees'])} (expected ~53)")
        print(f"✓ Projects: {len(pf['projects'])} (expected ~28)")
    
    def test_accounts_have_valid_structure(self, accounts_data):
        """Test that accounts have proper structure"""
        # Check accounts structure
        for acc in accounts_data["accounts"][:3]:
            assert "id" in acc, f"Account missing 'id': {acc}"
            assert "name" in acc, f"Account missing 'name': {acc}"
            assert "type" in acc, f"Account missing 'type': {acc}"
            assert "group" in acc, f"Account missing 'group': {acc}"
    
    def test_control_accounts_exist(self, accounts_data):
        """Test that control accounts are returned"""
        assert len(accounts_data["control_accounts"]) > 0, "No control accounts found"
        print(f"✓ Found {len(accounts_data['control_accounts'])} control accounts")


class TestGeneralLedgerFiltering:
    """Test filtering by party in general ledger"""
    
    def test_filter_by_customer(self, auth_session, accounts_data):
        """Test filtering ledger by a specific customer"""
        customers = accounts_data["party_filters"]["customers"]
        
        if len(customers) > 0:
            customer = customers[0]
            customer_id = customer["id"]
            
            # Now filter ledger by this customer
            ledger_response = auth_session.get(
                f"{BASE_URL}/api/finance/general-ledger",
                params={"party_type": "customer", "party_id": customer_id}
            )
            
            # Should return 200 (even if no transactions)
            assert ledger_response.status_code == 200, f"Filter by customer failed: {ledger_response.text}"
            print(f"✓ Filter by customer '{customer['name']}' works")
    
    def test_filter_by_vendor(self, auth_session, accounts_data):
        """Test filtering ledger by a specific vendor"""
        vendors = accounts_data["party_filters"]["vendors"]
        
        if len(vendors) > 0:
            vendor = vendors[0]
            vendor_id = vendor["id"]
            
            # Now filter ledger by this vendor
            ledger_response = auth_session.get(
                f"{BASE_URL}/api/finance/general-ledger",
                params={"party_type": "vendor", "party_id": vendor_id}
            )
            
            # Should return 200 (even if no transactions)
            assert ledger_response.status_code == 200, f"Filter by vendor failed: {ledger_response.text}"
            print(f"✓ Filter by vendor '{vendor['name']}' works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
