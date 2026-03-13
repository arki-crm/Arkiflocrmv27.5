"""
Founder Dashboard API Tests
Tests all 8 sections of the comprehensive founder dashboard:
1. Cash Position - total cash + breakdown by bank/petty cash
2. Receivable Pipeline - pending customer payments + upcoming installments
3. Upcoming Payments - vendor payables, salaries, liabilities
4. Today's Financial Activity - daily receipts, expenses, net cash movement
5. Ongoing Projects - Progress %, Contract Value, Total Received, Actual Cost, Profit/Loss
6. Project Profitability Overview - profit/loss per project summary
7. Pending Approvals - expense requests, vendor payments
8. Sales Pipeline - new leads, ongoing deals, recently closed
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "sidheeq.arkidots@gmail.com"
TEST_PASSWORD = "founder123"


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for testing"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    login_response = session.post(
        f"{BASE_URL}/api/auth/local-login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if login_response.status_code != 200:
        pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    return session


class TestFounderDashboardAPI:
    """Test the /api/founder/dashboard endpoint"""
    
    def test_dashboard_endpoint_returns_200(self, auth_session):
        """Test that founder dashboard endpoint returns 200"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_dashboard_has_all_sections(self, auth_session):
        """Test that dashboard response contains all 8 required sections"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check all required sections exist
        required_sections = [
            "summary",
            "cash_position",
            "receivable_pipeline",
            "upcoming_payments",
            "todays_activity",
            "ongoing_projects",
            "profitability",
            "pending_approvals",
            "sales_pipeline"
        ]
        
        for section in required_sections:
            assert section in data, f"Missing section: {section}"
    
    def test_summary_section_structure(self, auth_session):
        """Test summary section has correct structure"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        summary = data.get("summary", {})
        required_fields = [
            "cash_available",
            "receivables",
            "payables",
            "net_position",
            "today_net",
            "active_projects",
            "pending_approvals"
        ]
        
        for field in required_fields:
            assert field in summary, f"Summary missing field: {field}"
    
    def test_cash_position_section(self, auth_session):
        """Test Section 1: Cash Position - total cash + breakdown by type"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        cash_position = data.get("cash_position", {})
        
        # Check total exists and is numeric
        assert "total" in cash_position, "Cash position missing 'total'"
        assert isinstance(cash_position["total"], (int, float)), "Total should be numeric"
        
        # Check accounts list exists
        assert "accounts" in cash_position, "Cash position missing 'accounts'"
        assert isinstance(cash_position["accounts"], list), "Accounts should be a list"
        
        # Check by_type breakdown
        assert "by_type" in cash_position, "Cash position missing 'by_type'"
        by_type = cash_position["by_type"]
        assert "cash" in by_type, "by_type missing 'cash'"
        assert "bank" in by_type, "by_type missing 'bank'"
        assert "digital" in by_type, "by_type missing 'digital'"
        
        # Verify account structure if accounts exist
        if cash_position["accounts"]:
            account = cash_position["accounts"][0]
            assert "account_name" in account, "Account missing 'account_name'"
            assert "account_type" in account, "Account missing 'account_type'"
            assert "balance" in account, "Account missing 'balance'"
    
    def test_receivable_pipeline_section(self, auth_session):
        """Test Section 2: Receivable Pipeline - pending customer payments"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        receivables = data.get("receivable_pipeline", {})
        
        # Check required fields
        assert "total_receivable" in receivables, "Missing 'total_receivable'"
        assert "projects_with_dues" in receivables, "Missing 'projects_with_dues'"
        assert "details" in receivables, "Missing 'details'"
        
        # Verify details structure if exists
        if receivables["details"]:
            detail = receivables["details"][0]
            required_detail_fields = ["project_id", "project_name", "client_name", "contract_value", "received", "balance_due"]
            for field in required_detail_fields:
                assert field in detail, f"Receivable detail missing '{field}'"
    
    def test_upcoming_payments_section(self, auth_session):
        """Test Section 3: Upcoming Payments - vendor payables, salaries, liabilities"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        payments = data.get("upcoming_payments", {})
        
        # Check required fields
        assert "total_payable" in payments, "Missing 'total_payable'"
        assert "expense_requests" in payments, "Missing 'expense_requests'"
        assert "vendor_payables" in payments, "Missing 'vendor_payables'"
        assert "salary_payable" in payments, "Missing 'salary_payable'"
        assert "other_liabilities" in payments, "Missing 'other_liabilities'"
        
        # Check expense_requests structure
        expense_req = payments["expense_requests"]
        assert "count" in expense_req, "expense_requests missing 'count'"
        assert "total" in expense_req, "expense_requests missing 'total'"
        
        # Check vendor_payables structure
        vendor_pay = payments["vendor_payables"]
        assert "count" in vendor_pay, "vendor_payables missing 'count'"
        assert "total" in vendor_pay, "vendor_payables missing 'total'"
    
    def test_todays_activity_section(self, auth_session):
        """Test Section 4: Today's Financial Activity"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        activity = data.get("todays_activity", {})
        
        # Check required fields
        required_fields = ["receipts", "expenses", "net_movement", "transaction_count"]
        for field in required_fields:
            assert field in activity, f"Today's activity missing '{field}'"
        
        # Verify net_movement calculation
        expected_net = activity["receipts"] - activity["expenses"]
        assert activity["net_movement"] == expected_net, "Net movement calculation incorrect"
    
    def test_ongoing_projects_section(self, auth_session):
        """Test Section 5: Ongoing Projects with financial status"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        projects = data.get("ongoing_projects", [])
        
        # Should be a list
        assert isinstance(projects, list), "ongoing_projects should be a list"
        
        # If projects exist, verify structure
        if projects:
            project = projects[0]
            required_fields = [
                "project_id", "project_name", "client_name", "status",
                "progress", "contract_value", "total_received", 
                "actual_cost", "profit_loss", "profit_margin"
            ]
            for field in required_fields:
                assert field in project, f"Project missing '{field}'"
    
    def test_profitability_section(self, auth_session):
        """Test Section 6: Project Profitability Overview"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        profitability = data.get("profitability", {})
        
        # Check required fields
        required_fields = [
            "total_projects", "profitable_projects", "loss_making_projects",
            "total_profit", "total_loss", "net_profit",
            "top_profitable", "top_loss_making"
        ]
        for field in required_fields:
            assert field in profitability, f"Profitability missing '{field}'"
        
        # Verify lists
        assert isinstance(profitability["top_profitable"], list), "top_profitable should be a list"
        assert isinstance(profitability["top_loss_making"], list), "top_loss_making should be a list"
    
    def test_pending_approvals_section(self, auth_session):
        """Test Section 7: Pending Approvals"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        approvals = data.get("pending_approvals", {})
        
        # Check required fields
        assert "total_count" in approvals, "Missing 'total_count'"
        assert "expense_requests" in approvals, "Missing 'expense_requests'"
        assert "vendor_payments" in approvals, "Missing 'vendor_payments'"
        
        # Check expense_requests structure
        expense_req = approvals["expense_requests"]
        assert "count" in expense_req, "expense_requests missing 'count'"
        assert "total_amount" in expense_req, "expense_requests missing 'total_amount'"
        assert "items" in expense_req, "expense_requests missing 'items'"
        
        # Check vendor_payments structure
        vendor_pay = approvals["vendor_payments"]
        assert "count" in vendor_pay, "vendor_payments missing 'count'"
        assert "total_amount" in vendor_pay, "vendor_payments missing 'total_amount'"
        assert "items" in vendor_pay, "vendor_payments missing 'items'"
    
    def test_sales_pipeline_section(self, auth_session):
        """Test Section 8: Sales Pipeline"""
        response = auth_session.get(f"{BASE_URL}/api/founder/dashboard")
        data = response.json()
        
        pipeline = data.get("sales_pipeline", {})
        
        # Check required fields
        required_fields = [
            "total_leads", "new_leads_30d", "hot_leads",
            "recent_conversions", "by_status"
        ]
        for field in required_fields:
            assert field in pipeline, f"Sales pipeline missing '{field}'"
        
        # by_status should be a dict
        assert isinstance(pipeline["by_status"], dict), "by_status should be a dict"


class TestFounderDashboardPermissions:
    """Test permission requirements for founder dashboard"""
    
    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated requests are denied"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/founder/dashboard")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestSupportingEndpoints:
    """Test supporting endpoints used by founder dashboard"""
    
    def test_safe_spend_endpoint(self, auth_session):
        """Test /api/finance/safe-spend endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/finance/safe-spend")
        assert response.status_code == 200, f"Safe spend failed: {response.status_code}"
        
        data = response.json()
        assert "can_spend_safely" in data or "daily_safe_spend" in data
    
    def test_alerts_endpoint(self, auth_session):
        """Test /api/finance/alerts endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/finance/alerts")
        assert response.status_code == 200, f"Alerts failed: {response.status_code}"
    
    def test_expense_stats_endpoint(self, auth_session):
        """Test /api/finance/expense-requests/stats/summary endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/finance/expense-requests/stats/summary")
        assert response.status_code == 200, f"Expense stats failed: {response.status_code}"
    
    def test_safe_use_summary_endpoint(self, auth_session):
        """Test /api/finance/safe-use-summary endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/finance/safe-use-summary")
        assert response.status_code == 200, f"Safe use summary failed: {response.status_code}"
    
    def test_liabilities_summary_endpoint(self, auth_session):
        """Test /api/finance/liabilities/summary endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/finance/liabilities/summary")
        assert response.status_code == 200, f"Liabilities summary failed: {response.status_code}"
    
    def test_revenue_reality_check_endpoint(self, auth_session):
        """Test /api/finance/revenue-reality-check endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/finance/revenue-reality-check?period=month")
        assert response.status_code == 200, f"Revenue reality check failed: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
