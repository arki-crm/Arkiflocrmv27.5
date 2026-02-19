"""
Trial Balance API Tests
Tests the /api/finance/trial-balance endpoint for the Trial Balance Report feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    
    # Login
    login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
        "email": FOUNDER_EMAIL,
        "password": FOUNDER_PASSWORD
    })
    
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    # Get session token from cookies
    session_token = login_response.cookies.get("session_token")
    if session_token:
        s.cookies.set("session_token", session_token)
    
    return s


class TestTrialBalanceAPI:
    """Trial Balance API endpoint tests"""
    
    def test_trial_balance_month_period(self, session):
        """Test Trial Balance with 'month' period filter"""
        response = session.get(f"{BASE_URL}/api/finance/trial-balance?period=month")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert data["period"] == "month"
        assert "period_label" in data
        assert "start_date" in data
        assert "end_date" in data
        assert "generated_at" in data
        
        # Verify trial_balance structure
        assert "trial_balance" in data
        tb = data["trial_balance"]
        assert "assets" in tb
        assert "liabilities" in tb
        assert "income" in tb
        assert "expenses" in tb
        assert "equity" in tb
        
        # Verify totals structure
        assert "totals" in data
        totals = data["totals"]
        assert "total_debit" in totals
        assert "total_credit" in totals
        assert "difference" in totals
        assert "is_balanced" in totals
        
        # Verify summary structure
        assert "summary" in data
        summary = data["summary"]
        assert "total_income" in summary
        assert "total_expenses" in summary
        assert "net_profit_loss" in summary
        
        print(f"✓ Month period: {data['period_label']}")
        print(f"  Total Debit: {totals['total_debit']}")
        print(f"  Total Credit: {totals['total_credit']}")
        print(f"  Balanced: {totals['is_balanced']}")
    
    def test_trial_balance_quarter_period(self, session):
        """Test Trial Balance with 'quarter' period filter"""
        response = session.get(f"{BASE_URL}/api/finance/trial-balance?period=quarter")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert data["period"] == "quarter"
        assert "Q" in data["period_label"]  # Should be like "Q1 2026"
        
        print(f"✓ Quarter period: {data['period_label']}")
    
    def test_trial_balance_financial_year_period(self, session):
        """Test Trial Balance with 'fy' (Financial Year) period filter"""
        response = session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert data["period"] == "fy"
        assert "FY" in data["period_label"]  # Should be like "FY 2025-2026"
        
        print(f"✓ Financial Year period: {data['period_label']}")
    
    def test_trial_balance_custom_period(self, session):
        """Test Trial Balance with custom date range"""
        response = session.get(
            f"{BASE_URL}/api/finance/trial-balance?period=custom&start_date=2026-01-01&end_date=2026-02-28"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert data["period"] == "custom"
        assert "2026-01-01" in data["period_label"]
        assert "2026-02-28" in data["period_label"]
        
        print(f"✓ Custom period: {data['period_label']}")
    
    def test_trial_balance_account_groups_structure(self, session):
        """Test that account groups have correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/trial-balance?period=month")
        
        assert response.status_code == 200
        
        data = response.json()
        tb = data["trial_balance"]
        
        # Check each group's items have required fields
        for group_name in ["assets", "liabilities", "income", "expenses", "equity"]:
            items = tb[group_name]
            for item in items:
                assert "account_name" in item, f"Missing account_name in {group_name}"
                assert "debit" in item, f"Missing debit in {group_name}"
                assert "credit" in item, f"Missing credit in {group_name}"
                
                # Verify debit and credit are numbers
                assert isinstance(item["debit"], (int, float)), f"Debit should be numeric in {group_name}"
                assert isinstance(item["credit"], (int, float)), f"Credit should be numeric in {group_name}"
        
        print(f"✓ All account groups have correct structure")
        print(f"  Assets: {len(tb['assets'])} accounts")
        print(f"  Liabilities: {len(tb['liabilities'])} accounts")
        print(f"  Income: {len(tb['income'])} accounts")
        print(f"  Expenses: {len(tb['expenses'])} accounts")
        print(f"  Equity: {len(tb['equity'])} accounts")
    
    def test_trial_balance_totals_calculation(self, session):
        """Test that totals are calculated correctly"""
        response = session.get(f"{BASE_URL}/api/finance/trial-balance?period=month")
        
        assert response.status_code == 200
        
        data = response.json()
        tb = data["trial_balance"]
        totals = data["totals"]
        
        # Calculate expected totals from items
        calculated_debit = 0
        calculated_credit = 0
        
        for group_name in ["assets", "liabilities", "income", "expenses", "equity"]:
            for item in tb[group_name]:
                calculated_debit += item.get("debit", 0)
                calculated_credit += item.get("credit", 0)
        
        # Allow small rounding difference
        assert abs(calculated_debit - totals["total_debit"]) < 1, \
            f"Debit mismatch: calculated={calculated_debit}, reported={totals['total_debit']}"
        assert abs(calculated_credit - totals["total_credit"]) < 1, \
            f"Credit mismatch: calculated={calculated_credit}, reported={totals['total_credit']}"
        
        # Verify difference calculation
        expected_diff = totals["total_debit"] - totals["total_credit"]
        assert abs(totals["difference"] - expected_diff) < 1, \
            f"Difference mismatch: expected={expected_diff}, reported={totals['difference']}"
        
        print(f"✓ Totals calculation verified")
        print(f"  Calculated Debit: {calculated_debit}")
        print(f"  Calculated Credit: {calculated_credit}")
    
    def test_trial_balance_summary_values(self, session):
        """Test that summary values are present and numeric"""
        response = session.get(f"{BASE_URL}/api/finance/trial-balance?period=month")
        
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        # Verify all summary fields are numeric
        assert isinstance(summary["total_income"], (int, float))
        assert isinstance(summary["total_expenses"], (int, float))
        assert isinstance(summary["net_profit_loss"], (int, float))
        
        # Verify net profit/loss calculation
        expected_net = summary["total_income"] - summary["total_expenses"]
        assert abs(summary["net_profit_loss"] - expected_net) < 1, \
            f"Net P/L mismatch: expected={expected_net}, reported={summary['net_profit_loss']}"
        
        print(f"✓ Summary values verified")
        print(f"  Total Income: {summary['total_income']}")
        print(f"  Total Expenses: {summary['total_expenses']}")
        print(f"  Net Profit/Loss: {summary['net_profit_loss']}")
    
    def test_trial_balance_unauthenticated(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/finance/trial-balance?period=month")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ Unauthenticated request correctly rejected")
    
    def test_trial_balance_default_period(self, session):
        """Test that default period is used when not specified"""
        response = session.get(f"{BASE_URL}/api/finance/trial-balance")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Default should be 'month'
        assert data["period"] == "month"
        
        print(f"✓ Default period is 'month': {data['period_label']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
