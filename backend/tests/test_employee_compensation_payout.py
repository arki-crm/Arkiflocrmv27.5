"""
Test Employee Compensation & Payout Architecture
Tests for salary deductions, incentives, commissions, and unified earnings visibility
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "sidheeq.arkidots@gmail.com"
TEST_PASSWORD = "founder123"


class TestDeductionTypes:
    """Test deduction types endpoint - 10 deduction types with ledger mapping"""
    
    def test_get_deduction_types_returns_all_10_types(self, authenticated_session):
        """GET /api/finance/deduction-types returns all 10 deduction types"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/deduction-types")
        assert response.status_code == 200
        
        data = response.json()
        assert "deduction_types" in data
        
        deduction_types = data["deduction_types"]
        expected_types = ["leave", "late_attendance", "loss_recovery", "advance_recovery", 
                         "penalty", "tds", "pf", "esi", "professional_tax", "custom"]
        
        for dtype in expected_types:
            assert dtype in deduction_types, f"Missing deduction type: {dtype}"
        
        assert len(deduction_types) == 10, f"Expected 10 deduction types, got {len(deduction_types)}"
    
    def test_deduction_types_have_ledger_mapping(self, authenticated_session):
        """Each deduction type has proper ledger_impact mapping"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/deduction-types")
        assert response.status_code == 200
        
        data = response.json()
        deduction_types = data["deduction_types"]
        
        for dtype, info in deduction_types.items():
            assert "ledger_impact" in info, f"Missing ledger_impact for {dtype}"
            assert "statutory" in info, f"Missing statutory flag for {dtype}"
            assert "name" in info, f"Missing name for {dtype}"
    
    def test_statutory_deductions_flagged_correctly(self, authenticated_session):
        """Statutory deductions (TDS, PF, ESI, PT) are flagged correctly"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/deduction-types")
        assert response.status_code == 200
        
        data = response.json()
        deduction_types = data["deduction_types"]
        
        statutory_types = ["tds", "pf", "esi", "professional_tax"]
        for dtype in statutory_types:
            assert deduction_types[dtype]["statutory"] == True, f"{dtype} should be statutory"
        
        non_statutory_types = ["leave", "late_attendance", "loss_recovery", "advance_recovery", "penalty", "custom"]
        for dtype in non_statutory_types:
            assert deduction_types[dtype]["statutory"] == False, f"{dtype} should not be statutory"
    
    def test_employee_classifications_returned(self, authenticated_session):
        """Employee classifications are returned with deduction types"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/deduction-types")
        assert response.status_code == 200
        
        data = response.json()
        assert "classifications" in data
        
        expected_classifications = ["permanent", "probation", "trainee", "freelancer", "channel_partner"]
        for cls in expected_classifications:
            assert cls in data["classifications"], f"Missing classification: {cls}"


class TestIncentiveTypes:
    """Test incentive and commission types endpoint"""
    
    def test_get_incentive_types(self, authenticated_session):
        """GET /api/finance/incentive-types returns incentive and commission types"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/incentive-types")
        assert response.status_code == 200
        
        data = response.json()
        assert "incentive_types" in data
        assert "commission_types" in data
    
    def test_incentive_types_have_project_linked_flag(self, authenticated_session):
        """Incentive types have project_linked flag"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/incentive-types")
        assert response.status_code == 200
        
        data = response.json()
        incentive_types = data["incentive_types"]
        
        # Project-linked incentives
        project_linked = ["booking", "execution_50_percent", "project_completion", "customer_review"]
        for itype in project_linked:
            assert incentive_types[itype]["project_linked"] == True, f"{itype} should be project-linked"
        
        # Non-project-linked
        assert incentive_types["performance"]["project_linked"] == False
    
    def test_commission_types_have_ledger_mapping(self, authenticated_session):
        """Commission types have ledger mapping"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/incentive-types")
        assert response.status_code == 200
        
        data = response.json()
        commission_types = data["commission_types"]
        
        expected_types = ["referral", "channel_partner", "project_linked"]
        for ctype in expected_types:
            assert ctype in commission_types, f"Missing commission type: {ctype}"
            assert "ledger" in commission_types[ctype], f"Missing ledger for {ctype}"


class TestSalaryProcessing:
    """Test salary processing with deductions"""
    
    def test_salary_processing_with_deductions(self, authenticated_session, test_employee_id):
        """POST /api/finance/salary-processing accepts deductions and calculates net payable"""
        month_year = datetime.now().strftime("%Y-%m")
        
        payload = {
            "employee_id": test_employee_id,
            "month_year": month_year,
            "gross_salary": 10000,
            "deductions": [
                {"deduction_type": "leave", "amount": 500, "reason": "TEST_Leave deduction"},
                {"deduction_type": "pf", "amount": 1200, "reason": "TEST_PF deduction", "auto_calculated": True}
            ],
            "notes": "TEST_Salary processing test"
        }
        
        response = authenticated_session.post(f"{BASE_URL}/api/finance/salary-processing", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "cycle" in data
        assert "summary" in data
        
        # Verify calculations
        summary = data["summary"]
        assert summary["gross_salary"] == 10000
        assert summary["total_deductions"] == 1700  # 500 + 1200
        assert summary["statutory_deductions"] == 1200  # PF only
        assert summary["non_statutory_deductions"] == 500  # Leave only
        assert summary["net_payable"] == 8300  # 10000 - 1700
    
    def test_salary_processing_invalid_deduction_type(self, authenticated_session, test_employee_id):
        """Invalid deduction type returns 400"""
        payload = {
            "employee_id": test_employee_id,
            "month_year": "2026-02",
            "gross_salary": 10000,
            "deductions": [
                {"deduction_type": "invalid_type", "amount": 500}
            ]
        }
        
        response = authenticated_session.post(f"{BASE_URL}/api/finance/salary-processing", json=payload)
        assert response.status_code == 400
    
    def test_salary_processing_negative_net_payable_rejected(self, authenticated_session, test_employee_id):
        """Net payable cannot be negative"""
        payload = {
            "employee_id": test_employee_id,
            "month_year": "2026-03",
            "gross_salary": 1000,
            "deductions": [
                {"deduction_type": "leave", "amount": 2000}  # More than gross
            ]
        }
        
        response = authenticated_session.post(f"{BASE_URL}/api/finance/salary-processing", json=payload)
        assert response.status_code == 400


class TestIncentives:
    """Test incentive CRUD operations"""
    
    def test_create_incentive(self, authenticated_session, test_employee_id, test_project_id):
        """POST /api/finance/incentives creates new incentive record"""
        payload = {
            "employee_id": test_employee_id,
            "incentive_type": "booking",
            "project_id": test_project_id,
            "amount": 2500,
            "calculation_type": "fixed",
            "trigger_event": "booking",
            "notes": "TEST_Booking incentive"
        }
        
        response = authenticated_session.post(f"{BASE_URL}/api/finance/incentives", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "incentive" in data
        
        incentive = data["incentive"]
        assert incentive["employee_id"] == test_employee_id
        assert incentive["incentive_type"] == "booking"
        assert incentive["amount"] == 2500
        assert incentive["status"] == "pending"
        assert "incentive_id" in incentive
        
        return incentive["incentive_id"]
    
    def test_approve_incentive(self, authenticated_session, test_employee_id, test_project_id):
        """PUT /api/finance/incentives/{id}/approve approves pending incentive"""
        # First create an incentive
        create_payload = {
            "employee_id": test_employee_id,
            "incentive_type": "performance",
            "amount": 1500,
            "calculation_type": "fixed",
            "notes": "TEST_Performance incentive for approval"
        }
        
        create_response = authenticated_session.post(f"{BASE_URL}/api/finance/incentives", json=create_payload)
        assert create_response.status_code == 200
        incentive_id = create_response.json()["incentive"]["incentive_id"]
        
        # Approve the incentive
        approve_response = authenticated_session.put(f"{BASE_URL}/api/finance/incentives/{incentive_id}/approve")
        assert approve_response.status_code == 200
        
        data = approve_response.json()
        assert data["success"] == True
        assert data["message"] == "Incentive approved"
    
    def test_payout_incentive(self, authenticated_session, test_employee_id, test_account_id):
        """POST /api/finance/incentives/{id}/payout processes incentive payment"""
        # Create and approve an incentive
        create_payload = {
            "employee_id": test_employee_id,
            "incentive_type": "performance",
            "amount": 1000,
            "calculation_type": "fixed",
            "notes": "TEST_Performance incentive for payout"
        }
        
        create_response = authenticated_session.post(f"{BASE_URL}/api/finance/incentives", json=create_payload)
        assert create_response.status_code == 200
        incentive_id = create_response.json()["incentive"]["incentive_id"]
        
        # Approve
        authenticated_session.put(f"{BASE_URL}/api/finance/incentives/{incentive_id}/approve")
        
        # Payout
        payout_payload = {
            "incentive_id": incentive_id,
            "account_id": test_account_id,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "TEST_Incentive payout"
        }
        
        payout_response = authenticated_session.post(f"{BASE_URL}/api/finance/incentives/{incentive_id}/payout", json=payout_payload)
        assert payout_response.status_code == 200
        
        data = payout_response.json()
        assert data["success"] == True
        assert "payment_id" in data
        assert "transaction_id" in data
        assert data["amount"] == 1000
    
    def test_get_incentives(self, authenticated_session):
        """GET /api/finance/incentives returns incentives list with summary"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/incentives")
        assert response.status_code == 200
        
        data = response.json()
        assert "incentives" in data
        assert "summary" in data
        
        summary = data["summary"]
        assert "total_pending" in summary
        assert "total_approved" in summary
        assert "total_paid" in summary
        assert "total_count" in summary


class TestCommissions:
    """Test commission CRUD operations"""
    
    def test_create_commission(self, authenticated_session, test_project_id):
        """POST /api/finance/commissions creates new commission record"""
        payload = {
            "recipient_type": "referral",
            "recipient_name": "TEST_Referrer Name",
            "recipient_contact": "9876543210",
            "commission_type": "referral",
            "project_id": test_project_id,
            "amount": 2000,
            "calculation_type": "fixed",
            "notes": "TEST_Referral commission"
        }
        
        response = authenticated_session.post(f"{BASE_URL}/api/finance/commissions", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "commission" in data
        
        commission = data["commission"]
        assert commission["recipient_name"] == "TEST_Referrer Name"
        assert commission["commission_type"] == "referral"
        assert commission["amount"] == 2000
        assert commission["status"] == "pending"
        assert "commission_id" in commission
        
        return commission["commission_id"]
    
    def test_payout_commission(self, authenticated_session, test_project_id, test_account_id):
        """POST /api/finance/commissions/{id}/payout processes commission payment"""
        # Create a commission
        create_payload = {
            "recipient_type": "channel_partner",
            "recipient_name": "TEST_Channel Partner",
            "commission_type": "channel_partner",
            "project_id": test_project_id,
            "amount": 1500,
            "calculation_type": "fixed",
            "notes": "TEST_Channel partner commission"
        }
        
        create_response = authenticated_session.post(f"{BASE_URL}/api/finance/commissions", json=create_payload)
        assert create_response.status_code == 200
        commission_id = create_response.json()["commission"]["commission_id"]
        
        # Payout
        payout_payload = {
            "commission_id": commission_id,
            "account_id": test_account_id,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "TEST_Commission payout"
        }
        
        payout_response = authenticated_session.post(f"{BASE_URL}/api/finance/commissions/{commission_id}/payout", json=payout_payload)
        assert payout_response.status_code == 200
        
        data = payout_response.json()
        assert data["success"] == True
        assert "payment_id" in data
        assert "transaction_id" in data
        assert data["amount"] == 1500
    
    def test_get_commissions(self, authenticated_session):
        """GET /api/finance/commissions returns commissions list with summary"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/commissions")
        assert response.status_code == 200
        
        data = response.json()
        assert "commissions" in data
        assert "summary" in data
        
        summary = data["summary"]
        assert "total_pending" in summary
        assert "total_paid" in summary
        assert "total_count" in summary


class TestEmployeeEarnings:
    """Test unified employee earnings visibility"""
    
    def test_get_employee_earnings(self, authenticated_session, test_employee_id):
        """GET /api/finance/employee-earnings/{employee_id} returns unified earnings view"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/employee-earnings/{test_employee_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "employee" in data
        assert "classification" in data
        assert "earnings_summary" in data
        
        earnings = data["earnings_summary"]
        assert "total_gross_salary" in earnings
        assert "total_deductions" in earnings
        assert "total_net_paid" in earnings
        assert "total_stipends" in earnings
        assert "incentives_earned" in earnings
        assert "incentives_paid" in earnings
        assert "incentives_pending" in earnings
        assert "total_earnings" in earnings
    
    def test_employee_earnings_includes_salary_cycles(self, authenticated_session, test_employee_id):
        """Employee earnings includes salary cycles"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/employee-earnings/{test_employee_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "salary_cycles" in data
        assert isinstance(data["salary_cycles"], list)
    
    def test_employee_earnings_includes_incentives(self, authenticated_session, test_employee_id):
        """Employee earnings includes incentives"""
        response = authenticated_session.get(f"{BASE_URL}/api/finance/employee-earnings/{test_employee_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "incentives" in data
        assert isinstance(data["incentives"], list)


# ============ FIXTURES ============

@pytest.fixture(scope="session")
def authenticated_session():
    """Create authenticated session for all tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    login_response = session.post(f"{BASE_URL}/api/auth/local-login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if login_response.status_code != 200:
        pytest.skip(f"Authentication failed: {login_response.text}")
    
    return session


@pytest.fixture(scope="session")
def test_employee_id(authenticated_session):
    """Get a test employee ID"""
    response = authenticated_session.get(f"{BASE_URL}/api/finance/salaries")
    if response.status_code == 200:
        salaries = response.json()
        if salaries and len(salaries) > 0:
            return salaries[0]["employee_id"]
    
    pytest.skip("No employee found for testing")


@pytest.fixture(scope="session")
def test_project_id(authenticated_session):
    """Get a test project ID"""
    response = authenticated_session.get(f"{BASE_URL}/api/projects")
    if response.status_code == 200:
        projects = response.json()
        if projects and len(projects) > 0:
            return projects[0]["project_id"]
    
    pytest.skip("No project found for testing")


@pytest.fixture(scope="session")
def test_account_id(authenticated_session):
    """Get a test account ID"""
    response = authenticated_session.get(f"{BASE_URL}/api/accounting/accounts")
    if response.status_code == 200:
        accounts = response.json()
        if accounts and len(accounts) > 0:
            return accounts[0]["account_id"]
    
    pytest.skip("No account found for testing")


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data(authenticated_session):
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Note: In production, you would delete test data here
    # For now, we leave test data for manual inspection
    print("\nTest data cleanup: TEST_ prefixed records should be manually cleaned")
