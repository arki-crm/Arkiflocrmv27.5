"""
Test General Ledger Module
Tests for:
- GET /api/finance/general-ledger - Main ledger data endpoint
- GET /api/finance/general-ledger/accounts - Accounts list endpoint
- GET /api/finance/general-ledger/export - Export endpoint
- Permission checks (finance.general_ledger.view, finance.general_ledger.export)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"


class TestGeneralLedgerAuth:
    """Authentication and permission tests for General Ledger"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_token(self, session):
        """Get authentication token via local admin login"""
        # First get the login page to establish session
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token") or data.get("token")
        
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_general_ledger_requires_auth(self, session):
        """Test that general ledger endpoint requires authentication"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id=petty_cash")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_accounts_endpoint_requires_auth(self, session):
        """Test that accounts endpoint requires authentication"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_export_endpoint_requires_auth(self, session):
        """Test that export endpoint requires authentication"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/export?account_id=petty_cash")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestGeneralLedgerAccounts:
    """Tests for GET /api/finance/general-ledger/accounts endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = s.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return s
    
    def test_get_accounts_returns_200(self, session):
        """Test accounts endpoint returns 200 for authenticated user"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_accounts_response_structure(self, session):
        """Test accounts endpoint returns correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        
        data = response.json()
        assert "accounts" in data, "Response should have 'accounts' field"
        assert "categories" in data, "Response should have 'categories' field"
        assert isinstance(data["accounts"], list), "accounts should be a list"
        assert isinstance(data["categories"], list), "categories should be a list"
    
    def test_accounts_have_required_fields(self, session):
        """Test each account has required fields"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        
        data = response.json()
        if data["accounts"]:
            account = data["accounts"][0]
            assert "id" in account, "Account should have 'id'"
            assert "name" in account, "Account should have 'name'"
            assert "type" in account, "Account should have 'type'"
            assert "group" in account, "Account should have 'group'"
    
    def test_categories_have_required_fields(self, session):
        """Test each category has required fields"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        assert response.status_code == 200
        
        data = response.json()
        if data["categories"]:
            category = data["categories"][0]
            assert "id" in category, "Category should have 'id'"
            assert "name" in category, "Category should have 'name'"


class TestGeneralLedgerMain:
    """Tests for GET /api/finance/general-ledger endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = s.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return s
    
    @pytest.fixture(scope="class")
    def test_account_id(self, session):
        """Get a valid account ID for testing"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        if response.status_code == 200:
            data = response.json()
            if data["accounts"]:
                return data["accounts"][0]["id"]
        return "petty_cash"  # Fallback to known account
    
    def test_account_id_required(self, session):
        """Test that account_id is required"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger")
        # FastAPI returns 422 for missing required query params, 400 for explicit validation
        assert response.status_code in [400, 422], f"Expected 400/422 for missing account_id, got {response.status_code}"
    
    def test_ledger_returns_200_with_valid_account(self, session, test_account_id):
        """Test ledger endpoint returns 200 with valid account"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_ledger_response_structure(self, session, test_account_id):
        """Test ledger response has correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level fields
        assert "account_id" in data, "Response should have 'account_id'"
        assert "account_name" in data, "Response should have 'account_name'"
        assert "account_type" in data, "Response should have 'account_type'"
        assert "period" in data, "Response should have 'period'"
        assert "period_label" in data, "Response should have 'period_label'"
        assert "start_date" in data, "Response should have 'start_date'"
        assert "end_date" in data, "Response should have 'end_date'"
        assert "generated_at" in data, "Response should have 'generated_at'"
        assert "summary" in data, "Response should have 'summary'"
        assert "entries" in data, "Response should have 'entries'"
        assert "entry_count" in data, "Response should have 'entry_count'"
    
    def test_summary_has_required_fields(self, session, test_account_id):
        """Test summary section has all required fields"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        assert "opening_balance" in summary, "Summary should have 'opening_balance'"
        assert "total_debit" in summary, "Summary should have 'total_debit'"
        assert "total_credit" in summary, "Summary should have 'total_credit'"
        assert "closing_balance" in summary, "Summary should have 'closing_balance'"
        assert "net_movement" in summary, "Summary should have 'net_movement'"
    
    def test_closing_balance_formula(self, session, test_account_id):
        """Test Closing Balance = Opening + Credit - Debit"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        expected_closing = summary["opening_balance"] + summary["total_credit"] - summary["total_debit"]
        actual_closing = summary["closing_balance"]
        
        assert abs(expected_closing - actual_closing) < 0.01, \
            f"Closing balance mismatch: expected {expected_closing}, got {actual_closing}"
    
    def test_entries_have_required_fields(self, session, test_account_id):
        """Test each entry has required fields"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}")
        assert response.status_code == 200
        
        data = response.json()
        if data["entries"]:
            entry = data["entries"][0]
            assert "date" in entry, "Entry should have 'date'"
            assert "reference" in entry, "Entry should have 'reference'"
            assert "source_module" in entry, "Entry should have 'source_module'"
            assert "narration" in entry, "Entry should have 'narration'"
            assert "debit" in entry, "Entry should have 'debit'"
            assert "credit" in entry, "Entry should have 'credit'"
            assert "running_balance" in entry, "Entry should have 'running_balance'"
    
    def test_period_filter_month(self, session, test_account_id):
        """Test period filter 'month' works"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}&period=month")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "month"
    
    def test_period_filter_quarter(self, session, test_account_id):
        """Test period filter 'quarter' works"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}&period=quarter")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "quarter"
    
    def test_period_filter_fy(self, session, test_account_id):
        """Test period filter 'fy' (financial year) works"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}&period=fy")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "fy"
    
    def test_period_filter_custom(self, session, test_account_id):
        """Test custom date range filter works"""
        response = session.get(
            f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}&period=custom&start_date=2024-01-01&end_date=2024-12-31"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "custom"
        assert data["start_date"] == "2024-01-01"
        assert data["end_date"] == "2024-12-31"
    
    def test_invalid_account_returns_404(self, session):
        """Test invalid account ID returns 404"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id=invalid_account_xyz")
        assert response.status_code == 404, f"Expected 404 for invalid account, got {response.status_code}"


class TestGeneralLedgerExport:
    """Tests for GET /api/finance/general-ledger/export endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = s.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return s
    
    @pytest.fixture(scope="class")
    def test_account_id(self, session):
        """Get a valid account ID for testing"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        if response.status_code == 200:
            data = response.json()
            if data["accounts"]:
                return data["accounts"][0]["id"]
        return "petty_cash"
    
    def test_export_returns_200(self, session, test_account_id):
        """Test export endpoint returns 200"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/export?account_id={test_account_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_export_response_structure(self, session, test_account_id):
        """Test export response has correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/export?account_id={test_account_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "account_id" in data, "Export should have 'account_id'"
        assert "account_name" in data, "Export should have 'account_name'"
        assert "period_label" in data, "Export should have 'period_label'"
        assert "start_date" in data, "Export should have 'start_date'"
        assert "end_date" in data, "Export should have 'end_date'"
        assert "rows" in data, "Export should have 'rows'"
    
    def test_export_rows_structure(self, session, test_account_id):
        """Test export rows have correct structure"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/export?account_id={test_account_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["rows"]) >= 2, "Export should have at least opening and closing rows"
        
        # Check first row (opening balance)
        first_row = data["rows"][0]
        assert first_row["narration"] == "Opening Balance", "First row should be Opening Balance"
        
        # Check last row (totals/closing)
        last_row = data["rows"][-1]
        assert last_row["narration"] == "TOTALS / CLOSING", "Last row should be TOTALS / CLOSING"
    
    def test_export_with_period_filter(self, session, test_account_id):
        """Test export with period filter"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/export?account_id={test_account_id}&period=fy")
        assert response.status_code == 200
        
        data = response.json()
        assert "FY" in data["period_label"], "Period label should contain 'FY'"
    
    def test_export_invalid_account_returns_404(self, session):
        """Test export with invalid account returns 404"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/export?account_id=invalid_xyz")
        assert response.status_code == 404


class TestGeneralLedgerRunningBalance:
    """Tests for running balance calculation"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = s.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return s
    
    @pytest.fixture(scope="class")
    def test_account_id(self, session):
        """Get a valid account ID for testing"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger/accounts")
        if response.status_code == 200:
            data = response.json()
            if data["accounts"]:
                return data["accounts"][0]["id"]
        return "petty_cash"
    
    def test_running_balance_calculation(self, session, test_account_id):
        """Test running balance is calculated correctly in order"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}&period=fy")
        assert response.status_code == 200
        
        data = response.json()
        entries = data["entries"]
        
        if len(entries) < 2:
            pytest.skip("Not enough entries to test running balance")
        
        # Verify running balance calculation
        opening = data["summary"]["opening_balance"]
        running = opening
        
        for entry in entries:
            running = running + entry["credit"] - entry["debit"]
            assert abs(running - entry["running_balance"]) < 0.01, \
                f"Running balance mismatch at {entry['date']}: expected {running}, got {entry['running_balance']}"
    
    def test_last_running_balance_equals_closing(self, session, test_account_id):
        """Test last entry's running balance equals closing balance"""
        response = session.get(f"{BASE_URL}/api/finance/general-ledger?account_id={test_account_id}&period=fy")
        assert response.status_code == 200
        
        data = response.json()
        entries = data["entries"]
        
        if entries:
            last_running = entries[-1]["running_balance"]
            closing = data["summary"]["closing_balance"]
            assert abs(last_running - closing) < 0.01, \
                f"Last running balance ({last_running}) should equal closing balance ({closing})"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
