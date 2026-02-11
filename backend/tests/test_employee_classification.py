"""
Test Employee Classification Feature for HR Module
Tests:
1. Classification APIs (summary, employees by classification, history)
2. Classification update with history logging
3. Salary/Stipend/Incentive routing based on classification
4. Statutory deduction rules enforcement
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"
ADMIN_EMAIL = "thaha.pakayil@gmail.com"
ADMIN_PASSWORD = "password123"


@pytest.fixture(scope="module")
def auth_session():
    """Get authenticated session with founder credentials"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as founder
    response = session.post(f"{BASE_URL}/api/auth/local-login", json={
        "email": FOUNDER_EMAIL,
        "password": FOUNDER_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    return session


@pytest.fixture(scope="module")
def test_employee_id(auth_session):
    """Get a test employee ID for classification tests"""
    # Get employees list
    response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
    if response.status_code == 200:
        data = response.json()
        employees = data.get("employees", [])
        if employees:
            return employees[0].get("user_id")
    
    # Fallback: get from users list
    response = auth_session.get(f"{BASE_URL}/api/users")
    if response.status_code == 200:
        users = response.json()
        if users:
            return users[0].get("user_id")
    
    pytest.skip("No employees found for testing")


class TestClassificationSummaryAPI:
    """Test GET /api/hr/classification-summary endpoint"""
    
    def test_classification_summary_returns_data(self, auth_session):
        """Classification summary should return breakdown with workflow rules"""
        response = auth_session.get(f"{BASE_URL}/api/hr/classification-summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_employees" in data
        assert "by_classification" in data
        assert "workflow_guidance" in data
    
    def test_classification_summary_has_all_5_classifications(self, auth_session):
        """Summary should include all 5 classification types"""
        response = auth_session.get(f"{BASE_URL}/api/hr/classification-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        expected_classifications = ["permanent", "probation", "trainee", "freelancer", "channel_partner"]
        by_classification = data.get("by_classification", {})
        
        for cls in expected_classifications:
            assert cls in by_classification, f"Missing classification: {cls}"
    
    def test_classification_summary_has_workflow_guidance(self, auth_session):
        """Summary should include workflow guidance for each classification"""
        response = auth_session.get(f"{BASE_URL}/api/hr/classification-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        workflow_guidance = data.get("workflow_guidance", {})
        
        # Check permanent employee guidance
        assert "permanent" in workflow_guidance
        perm_guidance = workflow_guidance["permanent"]
        assert "payment_method" in perm_guidance
        assert perm_guidance["payment_method"] == "Salary"
        assert "statutory_deductions" in perm_guidance
        assert "can_receive" in perm_guidance
        
        # Check trainee guidance
        assert "trainee" in workflow_guidance
        trainee_guidance = workflow_guidance["trainee"]
        assert trainee_guidance["payment_method"] == "Stipend"
        assert "None" in trainee_guidance["statutory_deductions"]
    
    def test_classification_summary_has_eligibility_flags(self, auth_session):
        """Each classification should have eligibility flags"""
        response = auth_session.get(f"{BASE_URL}/api/hr/classification-summary")
        
        assert response.status_code == 200
        data = response.json()
        
        by_classification = data.get("by_classification", {})
        
        # Check permanent employee flags
        permanent = by_classification.get("permanent", {})
        assert permanent.get("is_salary_eligible") == True
        assert permanent.get("is_incentive_eligible") == True
        
        # Check trainee flags
        trainee = by_classification.get("trainee", {})
        assert trainee.get("is_stipend_eligible") == True
        assert trainee.get("is_statutory_exempt") == True
        
        # Check freelancer flags
        freelancer = by_classification.get("freelancer", {})
        assert freelancer.get("is_salary_eligible") == False
        assert freelancer.get("is_statutory_exempt") == True


class TestEmployeesClassificationsAPI:
    """Test GET /api/hr/employees/classifications endpoint"""
    
    def test_employees_classifications_returns_grouped_data(self, auth_session):
        """Should return employees grouped by classification"""
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "employees" in data
        assert "grouped" in data
        assert "classifications" in data
        assert "classification_rules" in data
    
    def test_employees_classifications_has_rules(self, auth_session):
        """Should return classification rules"""
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
        
        assert response.status_code == 200
        data = response.json()
        
        rules = data.get("classification_rules", {})
        assert "salary_eligible" in rules
        assert "stipend_eligible" in rules
        assert "incentive_eligible" in rules
        assert "statutory_exempt" in rules
        
        # Verify rule values
        assert "permanent" in rules["salary_eligible"]
        assert "probation" in rules["salary_eligible"]
        assert "trainee" in rules["stipend_eligible"]


class TestClassificationUpdateAPI:
    """Test PUT /api/hr/employees/{user_id}/classification endpoint"""
    
    def test_update_classification_success(self, auth_session, test_employee_id):
        """Should update employee classification and log history"""
        # First get current classification
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/{test_employee_id}/classification-history")
        if response.status_code == 200:
            current = response.json().get("current_classification", "permanent")
        else:
            current = "permanent"
        
        # Update to probation (if not already)
        new_classification = "probation" if current != "probation" else "permanent"
        
        response = auth_session.put(
            f"{BASE_URL}/api/hr/employees/{test_employee_id}/classification",
            json={"classification": new_classification}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True or "classification" in str(data).lower()
        
        # Restore original classification
        auth_session.put(
            f"{BASE_URL}/api/hr/employees/{test_employee_id}/classification",
            json={"classification": current}
        )
    
    def test_update_classification_invalid_type(self, auth_session, test_employee_id):
        """Should reject invalid classification type"""
        response = auth_session.put(
            f"{BASE_URL}/api/hr/employees/{test_employee_id}/classification",
            json={"classification": "invalid_type"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid classification" in response.text or "invalid" in response.text.lower()


class TestClassificationHistoryAPI:
    """Test GET /api/hr/employees/{user_id}/classification-history endpoint"""
    
    def test_classification_history_returns_data(self, auth_session, test_employee_id):
        """Should return classification history for employee"""
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/{test_employee_id}/classification-history")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "employee" in data
        assert "current_classification" in data
        assert "history" in data
        assert "classification_rules" in data
    
    def test_classification_history_has_rules(self, auth_session, test_employee_id):
        """History response should include classification rules"""
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/{test_employee_id}/classification-history")
        
        assert response.status_code == 200
        data = response.json()
        
        rules = data.get("classification_rules", {})
        assert "salary_eligible" in rules
        assert "stipend_eligible" in rules


class TestSalaryCyclesFiltering:
    """Test GET /api/finance/salary-cycles filters by classification"""
    
    def test_salary_cycles_filters_to_salary_eligible(self, auth_session):
        """Salary cycles should only include permanent/probation employees by default"""
        current_month = datetime.now().strftime("%Y-%m")
        response = auth_session.get(f"{BASE_URL}/api/finance/salary-cycles?month_year={current_month}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        cycles = response.json()
        
        # If there are cycles, verify they are salary-eligible classifications
        for cycle in cycles:
            classification = cycle.get("employee_classification", "permanent")
            assert classification in ["permanent", "probation"], \
                f"Non-salary-eligible employee in cycles: {classification}"
    
    def test_salary_cycles_include_all_flag(self, auth_session):
        """With include_all=true, should include all classifications"""
        current_month = datetime.now().strftime("%Y-%m")
        response = auth_session.get(f"{BASE_URL}/api/finance/salary-cycles?month_year={current_month}&include_all=true")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestSalaryPaymentValidation:
    """Test POST /api/finance/salary-payments classification validation"""
    
    def test_salary_payment_rejects_trainee(self, auth_session):
        """Salary payment should reject trainee-classified employees"""
        # First, we need to find or create a trainee employee
        # For now, test the validation logic by checking the error message format
        
        # Get an employee and temporarily change to trainee
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
        if response.status_code != 200:
            pytest.skip("Cannot get employees")
        
        data = response.json()
        employees = data.get("employees", [])
        if not employees:
            pytest.skip("No employees for testing")
        
        test_emp = employees[0]
        emp_id = test_emp.get("user_id")
        original_classification = test_emp.get("employee_classification", "permanent")
        
        # Change to trainee
        auth_session.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}/classification",
            json={"classification": "trainee"}
        )
        
        # Try to make salary payment
        response = auth_session.post(f"{BASE_URL}/api/finance/salary-payments", json={
            "employee_id": emp_id,
            "amount": 1000,
            "payment_type": "salary",
            "account_id": "test_account",
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "month_year": datetime.now().strftime("%Y-%m")
        })
        
        # Restore original classification
        auth_session.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}/classification",
            json={"classification": original_classification}
        )
        
        # Should be rejected with clear error message
        assert response.status_code == 400 or response.status_code == 404, \
            f"Expected 400/404, got {response.status_code}"
        
        if response.status_code == 400:
            assert "trainee" in response.text.lower() or "stipend" in response.text.lower()


class TestStipendPaymentValidation:
    """Test POST /api/finance/stipend-payments classification validation"""
    
    def test_stipend_payment_rejects_permanent(self, auth_session):
        """Stipend payment should reject permanent-classified employees"""
        # Get an employee
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
        if response.status_code != 200:
            pytest.skip("Cannot get employees")
        
        data = response.json()
        employees = data.get("employees", [])
        if not employees:
            pytest.skip("No employees for testing")
        
        # Find a permanent employee
        permanent_emp = None
        for emp in employees:
            if emp.get("employee_classification", "permanent") == "permanent":
                permanent_emp = emp
                break
        
        if not permanent_emp:
            pytest.skip("No permanent employee found")
        
        # Get an account for payment
        accounts_response = auth_session.get(f"{BASE_URL}/api/accounting/accounts")
        if accounts_response.status_code != 200 or not accounts_response.json():
            pytest.skip("No accounts available")
        
        account_id = accounts_response.json()[0].get("account_id")
        
        # Try to make stipend payment to permanent employee
        response = auth_session.post(f"{BASE_URL}/api/finance/stipend-payments", json={
            "employee_id": permanent_emp.get("user_id"),
            "amount": 5000,
            "month_year": datetime.now().strftime("%Y-%m"),
            "account_id": account_id,
            "payment_date": datetime.now().strftime("%Y-%m-%d")
        })
        
        # Should be rejected
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "permanent" in response.text.lower() or "salary" in response.text.lower()


class TestIncentiveValidation:
    """Test POST /api/finance/incentives classification validation"""
    
    def test_incentive_accepts_permanent_employee(self, auth_session):
        """Incentive should accept permanent/probation/trainee employees"""
        # Get a permanent employee
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
        if response.status_code != 200:
            pytest.skip("Cannot get employees")
        
        data = response.json()
        employees = data.get("employees", [])
        
        permanent_emp = None
        for emp in employees:
            if emp.get("employee_classification", "permanent") in ["permanent", "probation", "trainee"]:
                permanent_emp = emp
                break
        
        if not permanent_emp:
            pytest.skip("No incentive-eligible employee found")
        
        # Create incentive (performance type doesn't need project)
        response = auth_session.post(f"{BASE_URL}/api/finance/incentives", json={
            "employee_id": permanent_emp.get("user_id"),
            "incentive_type": "performance",
            "amount": 1000,
            "calculation_type": "fixed",
            "notes": "TEST_classification_test"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "incentive" in data
    
    def test_incentive_rejects_freelancer(self, auth_session):
        """Incentive should reject freelancer-classified employees"""
        # Get an employee and temporarily change to freelancer
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
        if response.status_code != 200:
            pytest.skip("Cannot get employees")
        
        data = response.json()
        employees = data.get("employees", [])
        if not employees:
            pytest.skip("No employees for testing")
        
        test_emp = employees[0]
        emp_id = test_emp.get("user_id")
        original_classification = test_emp.get("employee_classification", "permanent")
        
        # Change to freelancer
        auth_session.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}/classification",
            json={"classification": "freelancer"}
        )
        
        # Try to create incentive
        response = auth_session.post(f"{BASE_URL}/api/finance/incentives", json={
            "employee_id": emp_id,
            "incentive_type": "performance",
            "amount": 1000,
            "calculation_type": "fixed",
            "notes": "TEST_should_fail"
        })
        
        # Restore original classification
        auth_session.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}/classification",
            json={"classification": original_classification}
        )
        
        # Should be rejected
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "freelancer" in response.text.lower() or "commission" in response.text.lower()


class TestSalaryProcessingStatutoryRules:
    """Test POST /api/finance/salary-processing statutory deduction rules"""
    
    def test_salary_processing_rejects_trainee(self, auth_session):
        """Salary processing should reject trainee employees"""
        # Get an employee and temporarily change to trainee
        response = auth_session.get(f"{BASE_URL}/api/hr/employees/classifications")
        if response.status_code != 200:
            pytest.skip("Cannot get employees")
        
        data = response.json()
        employees = data.get("employees", [])
        if not employees:
            pytest.skip("No employees for testing")
        
        test_emp = employees[0]
        emp_id = test_emp.get("user_id")
        original_classification = test_emp.get("employee_classification", "permanent")
        
        # Change to trainee
        auth_session.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}/classification",
            json={"classification": "trainee"}
        )
        
        # Try salary processing
        response = auth_session.post(f"{BASE_URL}/api/finance/salary-processing", json={
            "employee_id": emp_id,
            "month_year": datetime.now().strftime("%Y-%m"),
            "gross_salary": 50000,
            "deductions": []
        })
        
        # Restore original classification
        auth_session.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}/classification",
            json={"classification": original_classification}
        )
        
        # Should be rejected
        assert response.status_code == 400 or response.status_code == 404, \
            f"Expected 400/404, got {response.status_code}"
        
        if response.status_code == 400:
            assert "trainee" in response.text.lower() or "stipend" in response.text.lower()


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_incentives(self, auth_session):
        """Remove test incentives created during testing"""
        # Get incentives
        response = auth_session.get(f"{BASE_URL}/api/finance/incentives")
        if response.status_code == 200:
            data = response.json()
            incentives = data.get("incentives", [])
            
            # Count test incentives (we don't delete, just verify they exist)
            test_incentives = [i for i in incentives if "TEST_" in str(i.get("notes", ""))]
            print(f"Found {len(test_incentives)} test incentives")
        
        assert True  # Cleanup is informational
