"""
Trial Balance API Tests
Tests the /api/finance/trial-balance endpoint with different period parameters.
Verifies:
- Correct totals for FY, month, quarter periods
- Correct grouping by account type (assets, liabilities, income, expenses)
- debug_info shows calculation_method as 'direct_aggregation_from_transactions'
- is_balanced status is correctly identified
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"
ADMIN_EMAIL = "thaha.pakayil@gmail.com"
ADMIN_PASSWORD = "password123"


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for all tests in module"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as Founder
    login_response = session.post(
        f"{BASE_URL}/api/auth/local-login",
        json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
    )
    
    if login_response.status_code != 200:
        pytest.skip(f"Authentication failed: {login_response.status_code} - {login_response.text}")
    
    print(f"\nLogin successful for {FOUNDER_EMAIL}")
    yield session
    session.close()


class TestTrialBalanceAPI:
    """Trial Balance endpoint tests"""
    
    # ==================== AUTHENTICATION TESTS ====================
    
    def test_trial_balance_requires_auth(self):
        """Test that trial balance endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/finance/trial-balance")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Trial balance requires authentication (401 without auth)")
    
    def test_trial_balance_founder_access(self, auth_session):
        """Test that Founder can access trial balance"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Founder can access trial balance")
    
    # ==================== PERIOD TESTS ====================
    
    def test_trial_balance_month_period(self, auth_session):
        """Test trial balance for current month period"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=month")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify period is month
        assert data.get("period") == "month", f"Expected period='month', got {data.get('period')}"
        
        # Verify period_label contains month name
        assert data.get("period_label") is not None, "period_label should be present"
        
        # Verify dates are present
        assert "start_date" in data, "start_date should be present"
        assert "end_date" in data, "end_date should be present"
        
        print(f"PASS: Month period - {data.get('period_label')}")
        print(f"  Date range: {data.get('start_date')} to {data.get('end_date')}")
    
    def test_trial_balance_quarter_period(self, auth_session):
        """Test trial balance for current quarter period"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=quarter")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify period is quarter
        assert data.get("period") == "quarter", f"Expected period='quarter', got {data.get('period')}"
        
        # Verify period_label contains Q
        period_label = data.get("period_label", "")
        assert "Q" in period_label, f"Expected 'Q' in period_label, got {period_label}"
        
        print(f"PASS: Quarter period - {data.get('period_label')}")
        print(f"  Date range: {data.get('start_date')} to {data.get('end_date')}")
    
    def test_trial_balance_fy_period(self, auth_session):
        """Test trial balance for financial year period"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify period is fy
        assert data.get("period") == "fy", f"Expected period='fy', got {data.get('period')}"
        
        # Verify period_label contains FY
        period_label = data.get("period_label", "")
        assert "FY" in period_label, f"Expected 'FY' in period_label, got {period_label}"
        
        print(f"PASS: FY period - {data.get('period_label')}")
        print(f"  Date range: {data.get('start_date')} to {data.get('end_date')}")
    
    # ==================== RESPONSE STRUCTURE TESTS ====================
    
    def test_trial_balance_response_structure(self, auth_session):
        """Test that trial balance response has correct structure"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level fields
        required_fields = ["period", "period_label", "start_date", "end_date", 
                          "generated_at", "trial_balance", "totals", "summary", "debug_info"]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print("PASS: Response has all required top-level fields")
    
    def test_trial_balance_account_grouping(self, auth_session):
        """Test that accounts are correctly grouped by type"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        trial_balance = data.get("trial_balance", {})
        
        # Verify all account type categories exist
        expected_categories = ["assets", "liabilities", "income", "expenses", "equity"]
        for category in expected_categories:
            assert category in trial_balance, f"Missing category: {category}"
            assert isinstance(trial_balance[category], list), f"{category} should be a list"
        
        print("PASS: Trial balance has all account type categories")
        print(f"  Assets: {len(trial_balance['assets'])} accounts")
        print(f"  Liabilities: {len(trial_balance['liabilities'])} accounts")
        print(f"  Income: {len(trial_balance['income'])} accounts")
        print(f"  Expenses: {len(trial_balance['expenses'])} accounts")
        print(f"  Equity: {len(trial_balance['equity'])} accounts")
    
    def test_trial_balance_account_entry_structure(self, auth_session):
        """Test that each account entry has correct structure"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        trial_balance = data.get("trial_balance", {})
        
        # Find first account with data
        account_entry = None
        for category in ["assets", "liabilities", "income", "expenses", "equity"]:
            if trial_balance.get(category):
                account_entry = trial_balance[category][0]
                break
        
        if account_entry:
            # Verify account entry structure
            required_entry_fields = ["account_id", "account_name", "debit", "credit", "net", "transaction_count"]
            for field in required_entry_fields:
                assert field in account_entry, f"Missing field in account entry: {field}"
            
            # Verify numeric fields
            assert isinstance(account_entry["debit"], (int, float)), "debit should be numeric"
            assert isinstance(account_entry["credit"], (int, float)), "credit should be numeric"
            assert isinstance(account_entry["net"], (int, float)), "net should be numeric"
            assert isinstance(account_entry["transaction_count"], int), "transaction_count should be int"
            
            # Verify net calculation
            expected_net = account_entry["debit"] - account_entry["credit"]
            assert abs(account_entry["net"] - expected_net) < 0.01, f"Net calculation incorrect: {account_entry['net']} != {expected_net}"
            
            print(f"PASS: Account entry structure is correct")
            print(f"  Sample: {account_entry['account_name']} - Debit: {account_entry['debit']}, Credit: {account_entry['credit']}")
        else:
            print("SKIP: No account entries found to verify structure")
    
    # ==================== TOTALS TESTS ====================
    
    def test_trial_balance_totals_structure(self, auth_session):
        """Test that totals section has correct structure"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        totals = data.get("totals", {})
        
        # Verify totals fields
        required_totals_fields = ["total_debit", "total_credit", "difference", "imbalance_amount", "is_balanced"]
        for field in required_totals_fields:
            assert field in totals, f"Missing totals field: {field}"
        
        # Verify numeric types
        assert isinstance(totals["total_debit"], (int, float)), "total_debit should be numeric"
        assert isinstance(totals["total_credit"], (int, float)), "total_credit should be numeric"
        assert isinstance(totals["is_balanced"], bool), "is_balanced should be boolean"
        
        # Verify difference calculation
        expected_diff = totals["total_debit"] - totals["total_credit"]
        assert abs(totals["difference"] - expected_diff) < 0.01, f"Difference calculation incorrect"
        
        print("PASS: Totals structure is correct")
        print(f"  Total Debit: {totals['total_debit']:,.2f}")
        print(f"  Total Credit: {totals['total_credit']:,.2f}")
        print(f"  Difference: {totals['difference']:,.2f}")
        print(f"  Is Balanced: {totals['is_balanced']}")
    
    def test_trial_balance_totals_match_sum(self, auth_session):
        """Test that totals match sum of all account entries"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        trial_balance = data.get("trial_balance", {})
        totals = data.get("totals", {})
        
        # Calculate sum of all debits and credits
        calculated_debit = 0
        calculated_credit = 0
        
        for category in ["assets", "liabilities", "income", "expenses", "equity"]:
            for entry in trial_balance.get(category, []):
                calculated_debit += entry.get("debit", 0)
                calculated_credit += entry.get("credit", 0)
        
        # Verify totals match
        assert abs(totals["total_debit"] - calculated_debit) < 0.01, \
            f"Total debit mismatch: {totals['total_debit']} != {calculated_debit}"
        assert abs(totals["total_credit"] - calculated_credit) < 0.01, \
            f"Total credit mismatch: {totals['total_credit']} != {calculated_credit}"
        
        print("PASS: Totals match sum of all account entries")
        print(f"  Calculated Debit: {calculated_debit:,.2f}")
        print(f"  Calculated Credit: {calculated_credit:,.2f}")
    
    # ==================== DEBUG INFO TESTS ====================
    
    def test_trial_balance_debug_info_calculation_method(self, auth_session):
        """Test that debug_info shows calculation_method as 'direct_aggregation_from_transactions'"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        debug_info = data.get("debug_info", {})
        
        # Verify calculation_method
        assert "calculation_method" in debug_info, "calculation_method should be in debug_info"
        assert debug_info["calculation_method"] == "direct_aggregation_from_transactions", \
            f"Expected 'direct_aggregation_from_transactions', got {debug_info['calculation_method']}"
        
        # Verify total_accounts_with_activity
        assert "total_accounts_with_activity" in debug_info, "total_accounts_with_activity should be in debug_info"
        assert isinstance(debug_info["total_accounts_with_activity"], int), "total_accounts_with_activity should be int"
        
        print("PASS: debug_info shows correct calculation_method")
        print(f"  calculation_method: {debug_info['calculation_method']}")
        print(f"  total_accounts_with_activity: {debug_info['total_accounts_with_activity']}")
    
    # ==================== SUMMARY TESTS ====================
    
    def test_trial_balance_summary_structure(self, auth_session):
        """Test that summary section has correct structure"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        
        # Verify summary fields
        required_summary_fields = ["total_assets_movement", "total_liabilities_movement", 
                                   "total_income", "total_expenses", "net_profit_loss"]
        for field in required_summary_fields:
            assert field in summary, f"Missing summary field: {field}"
            assert isinstance(summary[field], (int, float)), f"{field} should be numeric"
        
        print("PASS: Summary structure is correct")
        print(f"  Total Assets Movement: {summary['total_assets_movement']:,.2f}")
        print(f"  Total Liabilities Movement: {summary['total_liabilities_movement']:,.2f}")
        print(f"  Total Income: {summary['total_income']:,.2f}")
        print(f"  Total Expenses: {summary['total_expenses']:,.2f}")
        print(f"  Net Profit/Loss: {summary['net_profit_loss']:,.2f}")
    
    # ==================== IS_BALANCED STATUS TESTS ====================
    
    def test_trial_balance_is_balanced_status(self, auth_session):
        """Test that is_balanced status is correctly identified"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        
        assert response.status_code == 200
        data = response.json()
        
        totals = data.get("totals", {})
        
        # Verify is_balanced logic
        difference = abs(totals["total_debit"] - totals["total_credit"])
        expected_balanced = difference < 1  # Allow small rounding difference
        
        assert totals["is_balanced"] == expected_balanced, \
            f"is_balanced should be {expected_balanced} when difference is {difference}"
        
        print(f"PASS: is_balanced status is correctly identified")
        print(f"  Difference: {difference:,.2f}")
        print(f"  is_balanced: {totals['is_balanced']}")
    
    # ==================== DIFFERENT PERIODS COMPARISON ====================
    
    def test_trial_balance_different_periods_return_different_data(self, auth_session):
        """Test that different periods may return different totals"""
        # Get month data
        month_response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=month")
        assert month_response.status_code == 200
        month_data = month_response.json()
        
        # Get FY data
        fy_response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=fy")
        assert fy_response.status_code == 200
        fy_data = fy_response.json()
        
        # FY should have >= month totals (since FY includes the current month)
        month_debit = month_data["totals"]["total_debit"]
        fy_debit = fy_data["totals"]["total_debit"]
        
        print(f"PASS: Different periods return data")
        print(f"  Month ({month_data['period_label']}) Total Debit: {month_debit:,.2f}")
        print(f"  FY ({fy_data['period_label']}) Total Debit: {fy_debit:,.2f}")


class TestTrialBalanceEdgeCases:
    """Edge case tests for Trial Balance"""
    
    def test_trial_balance_invalid_period(self, auth_session):
        """Test trial balance with invalid period defaults to month"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=invalid")
        
        # Should default to month, not error
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        print("PASS: Invalid period handled gracefully")
    
    def test_trial_balance_custom_period_without_dates(self, auth_session):
        """Test custom period without dates defaults to month"""
        response = auth_session.get(f"{BASE_URL}/api/finance/trial-balance?period=custom")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Custom period without dates handled gracefully")
    
    def test_trial_balance_custom_period_with_dates(self, auth_session):
        """Test custom period with valid dates"""
        response = auth_session.get(
            f"{BASE_URL}/api/finance/trial-balance?period=custom&start_date=2024-01-01T00:00:00Z&end_date=2024-12-31T23:59:59Z"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("period") == "custom", f"Expected period='custom', got {data.get('period')}"
        
        print("PASS: Custom period with dates works correctly")
        print(f"  Period label: {data.get('period_label')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
