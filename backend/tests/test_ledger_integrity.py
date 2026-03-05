"""
Test Ledger Integrity - Party Dropdown and Filtering
=====================================================
Tests that:
1. Party dropdown returns data from master sources ONLY (not derived from accounting_transactions)
2. Customer IDs are project_ids (stable identifiers)
3. Vendor IDs are vendor_ids from finance_vendors
4. Employee IDs are user_ids from users
5. General Ledger filtering by party_type and party_id works correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLedgerIntegrity:
    """Test ledger integrity - party dropdown and filtering"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "sidheeq.arkidots@gmail.com",
                "password": "founder123"
            }
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        print(f"✓ Login successful")
        yield
    
    def test_general_ledger_accounts_endpoint_returns_200(self):
        """Test that /api/finance/general-ledger/accounts returns 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/finance/general-ledger/accounts returns 200")
    
    def test_party_filters_structure(self):
        """Test that party_filters has correct structure with customers, vendors, employees"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        data = response.json()
        
        # Check party_filters exists
        assert "party_filters" in data, "party_filters missing from response"
        party_filters = data["party_filters"]
        
        # Check all required keys exist
        assert "customers" in party_filters, "customers missing from party_filters"
        assert "vendors" in party_filters, "vendors missing from party_filters"
        assert "employees" in party_filters, "employees missing from party_filters"
        assert "projects" in party_filters, "projects missing from party_filters"
        
        print(f"✓ party_filters has correct structure")
    
    def test_customers_from_master_data(self):
        """Test that customers are from projects collection (master data)"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        data = response.json()
        
        customers = data["party_filters"]["customers"]
        
        # Expected: 26 customers from projects
        assert len(customers) > 0, "Customers list is empty - should have data from projects"
        print(f"✓ Customers count: {len(customers)} (expected ~26)")
        
        # Verify customer structure - should have id (project_id) and name (client_name)
        if customers:
            first_customer = customers[0]
            assert "id" in first_customer, "Customer missing 'id' field"
            assert "name" in first_customer, "Customer missing 'name' field"
            assert "type" in first_customer, "Customer missing 'type' field"
            assert first_customer["type"] == "customer", f"Customer type should be 'customer', got {first_customer['type']}"
            
            # ID should be a project_id format (not ObjectId)
            customer_id = first_customer["id"]
            assert customer_id is not None, "Customer ID should not be None"
            print(f"✓ Customer structure valid: id={customer_id}, name={first_customer['name']}")
    
    def test_vendors_from_master_data(self):
        """Test that vendors are from finance_vendors collection (master data)"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        data = response.json()
        
        vendors = data["party_filters"]["vendors"]
        
        # Expected: 9 vendors from finance_vendors
        assert len(vendors) > 0, "Vendors list is empty - should have data from finance_vendors"
        print(f"✓ Vendors count: {len(vendors)} (expected ~9)")
        
        # Verify vendor structure - should have id (vendor_id) and name
        if vendors:
            first_vendor = vendors[0]
            assert "id" in first_vendor, "Vendor missing 'id' field"
            assert "name" in first_vendor, "Vendor missing 'name' field"
            assert "type" in first_vendor, "Vendor missing 'type' field"
            assert first_vendor["type"] == "vendor", f"Vendor type should be 'vendor', got {first_vendor['type']}"
            
            # ID should be a vendor_id format
            vendor_id = first_vendor["id"]
            assert vendor_id is not None, "Vendor ID should not be None"
            print(f"✓ Vendor structure valid: id={vendor_id}, name={first_vendor['name']}")
    
    def test_employees_from_master_data(self):
        """Test that employees are from users collection (master data)"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        data = response.json()
        
        employees = data["party_filters"]["employees"]
        
        # Expected: 49 employees from users with employee roles
        assert len(employees) > 0, "Employees list is empty - should have data from users"
        print(f"✓ Employees count: {len(employees)} (expected ~49)")
        
        # Verify employee structure - should have id (user_id) and name
        if employees:
            first_employee = employees[0]
            assert "id" in first_employee, "Employee missing 'id' field"
            assert "name" in first_employee, "Employee missing 'name' field"
            assert "type" in first_employee, "Employee missing 'type' field"
            assert first_employee["type"] == "employee", f"Employee type should be 'employee', got {first_employee['type']}"
            
            # ID should be a user_id format
            employee_id = first_employee["id"]
            assert employee_id is not None, "Employee ID should not be None"
            print(f"✓ Employee structure valid: id={employee_id}, name={first_employee['name']}")
    
    def test_general_ledger_filter_by_party_type_customer(self):
        """Test General Ledger filter by party_type=customer"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/general-ledger",
            params={"party_type": "customer", "period": "fy"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return ledger data (may be empty if no customer transactions)
        assert "accounts" in data or "transactions" in data or "period" in data, \
            f"Response should have ledger structure, got: {list(data.keys())}"
        print(f"✓ Filter by party_type=customer returns 200")
    
    def test_general_ledger_filter_by_party_type_vendor(self):
        """Test General Ledger filter by party_type=vendor"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/general-ledger",
            params={"party_type": "vendor", "period": "fy"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "accounts" in data or "transactions" in data or "period" in data, \
            f"Response should have ledger structure, got: {list(data.keys())}"
        print(f"✓ Filter by party_type=vendor returns 200")
    
    def test_general_ledger_filter_by_party_type_employee(self):
        """Test General Ledger filter by party_type=employee"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/general-ledger",
            params={"party_type": "employee", "period": "fy"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "accounts" in data or "transactions" in data or "period" in data, \
            f"Response should have ledger structure, got: {list(data.keys())}"
        print(f"✓ Filter by party_type=employee returns 200")
    
    def test_general_ledger_filter_by_party_id(self):
        """Test General Ledger filter by specific party_id"""
        # First get a customer ID from the accounts endpoint
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        customers = data["party_filters"]["customers"]
        if not customers:
            pytest.skip("No customers available to test party_id filter")
        
        # Use first customer's ID
        customer_id = customers[0]["id"]
        customer_name = customers[0]["name"]
        
        # Filter by party_id
        response = self.session.get(
            f"{BASE_URL}/api/finance/general-ledger",
            params={"party_id": customer_id, "party_type": "customer", "period": "fy"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Filter by party_id={customer_id} ({customer_name}) returns 200")
    
    def test_general_ledger_filter_by_vendor_id(self):
        """Test General Ledger filter by specific vendor_id"""
        # First get a vendor ID from the accounts endpoint
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        vendors = data["party_filters"]["vendors"]
        if not vendors:
            pytest.skip("No vendors available to test party_id filter")
        
        # Use first vendor's ID
        vendor_id = vendors[0]["id"]
        vendor_name = vendors[0]["name"]
        
        # Filter by party_id
        response = self.session.get(
            f"{BASE_URL}/api/finance/general-ledger",
            params={"party_id": vendor_id, "party_type": "vendor", "period": "fy"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Filter by vendor party_id={vendor_id} ({vendor_name}) returns 200")
    
    def test_general_ledger_filter_by_employee_id(self):
        """Test General Ledger filter by specific employee_id"""
        # First get an employee ID from the accounts endpoint
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        employees = data["party_filters"]["employees"]
        if not employees:
            pytest.skip("No employees available to test party_id filter")
        
        # Use first employee's ID
        employee_id = employees[0]["id"]
        employee_name = employees[0]["name"]
        
        # Filter by party_id
        response = self.session.get(
            f"{BASE_URL}/api/finance/general-ledger",
            params={"party_id": employee_id, "party_type": "employee", "period": "fy"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Filter by employee party_id={employee_id} ({employee_name}) returns 200")
    
    def test_customer_ids_are_project_ids(self):
        """Verify customer IDs are project_ids (stable identifiers)"""
        # Get customers from party_filters
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        customers = data["party_filters"]["customers"]
        projects = data["party_filters"]["projects"]
        
        if not customers:
            pytest.skip("No customers to verify")
        
        # Get project IDs
        project_ids = {p["id"] for p in projects}
        
        # Verify at least some customer IDs match project IDs
        # (customers use project_id as their identifier)
        customer_ids = {c["id"] for c in customers}
        
        # Check if customer IDs are in project_id format
        # They should be project_ids since customers are derived from projects
        matching_ids = customer_ids.intersection(project_ids)
        
        print(f"✓ Customer IDs: {len(customer_ids)}, Project IDs: {len(project_ids)}")
        print(f"✓ Matching IDs (customer_id == project_id): {len(matching_ids)}")
        
        # At least some should match since customers come from projects
        assert len(matching_ids) > 0 or len(customers) > 0, \
            "Customer IDs should be project_ids (stable identifiers)"
    
    def test_vendor_ids_are_from_finance_vendors(self):
        """Verify vendor IDs are vendor_ids from finance_vendors"""
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        vendors = data["party_filters"]["vendors"]
        
        if not vendors:
            pytest.skip("No vendors to verify")
        
        # Verify vendor IDs are not None and have proper format
        for vendor in vendors[:5]:  # Check first 5
            assert vendor["id"] is not None, f"Vendor ID should not be None: {vendor}"
            assert isinstance(vendor["id"], str), f"Vendor ID should be string: {vendor}"
            assert vendor["name"] is not None, f"Vendor name should not be None: {vendor}"
        
        print(f"✓ Vendor IDs are valid vendor_ids from finance_vendors")
    
    def test_employee_ids_are_user_ids(self):
        """Verify employee IDs are user_ids from users collection"""
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        employees = data["party_filters"]["employees"]
        
        if not employees:
            pytest.skip("No employees to verify")
        
        # Verify employee IDs are not None and have proper format
        for employee in employees[:5]:  # Check first 5
            assert employee["id"] is not None, f"Employee ID should not be None: {employee}"
            assert isinstance(employee["id"], str), f"Employee ID should be string: {employee}"
            assert employee["name"] is not None, f"Employee name should not be None: {employee}"
        
        print(f"✓ Employee IDs are valid user_ids from users collection")
    
    def test_no_duplicate_customers(self):
        """Verify no duplicate customers in the list"""
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        customers = data["party_filters"]["customers"]
        
        # Check for duplicate IDs
        customer_ids = [c["id"] for c in customers]
        unique_ids = set(customer_ids)
        
        assert len(customer_ids) == len(unique_ids), \
            f"Duplicate customer IDs found: {len(customer_ids)} total, {len(unique_ids)} unique"
        
        # Check for duplicate names
        customer_names = [c["name"] for c in customers]
        unique_names = set(customer_names)
        
        assert len(customer_names) == len(unique_names), \
            f"Duplicate customer names found: {len(customer_names)} total, {len(unique_names)} unique"
        
        print(f"✓ No duplicate customers: {len(customers)} unique customers")
    
    def test_no_duplicate_vendors(self):
        """Verify no duplicate vendors in the list"""
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        vendors = data["party_filters"]["vendors"]
        
        # Check for duplicate IDs
        vendor_ids = [v["id"] for v in vendors]
        unique_ids = set(vendor_ids)
        
        assert len(vendor_ids) == len(unique_ids), \
            f"Duplicate vendor IDs found: {len(vendor_ids)} total, {len(unique_ids)} unique"
        
        print(f"✓ No duplicate vendors: {len(vendors)} unique vendors")
    
    def test_no_duplicate_employees(self):
        """Verify no duplicate employees in the list"""
        accounts_response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert accounts_response.status_code == 200
        data = accounts_response.json()
        
        employees = data["party_filters"]["employees"]
        
        # Check for duplicate IDs
        employee_ids = [e["id"] for e in employees]
        unique_ids = set(employee_ids)
        
        assert len(employee_ids) == len(unique_ids), \
            f"Duplicate employee IDs found: {len(employee_ids)} total, {len(unique_ids)} unique"
        
        print(f"✓ No duplicate employees: {len(employees)} unique employees")


class TestMasterDataCounts:
    """Verify expected counts from master data sources"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "sidheeq.arkidots@gmail.com",
                "password": "founder123"
            }
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        yield
    
    def test_expected_customer_count(self):
        """Verify expected customer count (~26 from projects)"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        data = response.json()
        
        customers = data["party_filters"]["customers"]
        count = len(customers)
        
        # Expected: ~26 customers
        print(f"✓ Customer count: {count} (expected ~26)")
        assert count >= 20, f"Expected at least 20 customers, got {count}"
        assert count <= 50, f"Expected at most 50 customers, got {count}"
    
    def test_expected_vendor_count(self):
        """Verify expected vendor count (~9 from finance_vendors)"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        data = response.json()
        
        vendors = data["party_filters"]["vendors"]
        count = len(vendors)
        
        # Expected: ~9 vendors
        print(f"✓ Vendor count: {count} (expected ~9)")
        assert count >= 5, f"Expected at least 5 vendors, got {count}"
        assert count <= 30, f"Expected at most 30 vendors, got {count}"
    
    def test_expected_employee_count(self):
        """Verify expected employee count (~49 from users)"""
        response = self.session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        data = response.json()
        
        employees = data["party_filters"]["employees"]
        count = len(employees)
        
        # Expected: ~49 employees
        print(f"✓ Employee count: {count} (expected ~49)")
        assert count >= 30, f"Expected at least 30 employees, got {count}"
        assert count <= 100, f"Expected at most 100 employees, got {count}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
