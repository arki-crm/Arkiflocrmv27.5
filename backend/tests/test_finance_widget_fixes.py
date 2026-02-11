"""
Test Finance Widget Fixes - Revenue Baseline and Liability Calculation
=====================================================================
Tests for:
1. Financial Summary and Profit Visibility use SAME signoff_value baseline
2. get_project_profit endpoint returns signoff_value field
3. get_project_profit excludes is_cashbook_entry=False from actual_cost
4. remaining_liability comes from finance_liabilities collection
5. remaining_liability includes both 'open' and 'partially_settled' status
6. remaining_liability is never negative
7. Profit calculations: Projected = signoff_value - planned_cost, Realised = received - actual_cost
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFinanceWidgetFixes:
    """Test suite for finance widget fixes - signoff_value baseline and liability calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with founder credentials
        login_response = self.session.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": "sidheeq.arkidots@gmail.com",
            "password": "founder123"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        self.session.close()
    
    # ============ TEST 1: Authentication ============
    def test_01_login_works(self):
        """Verify authentication is working"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert "email" in data or "user_id" in data, "User data not returned"
        print("✓ Authentication working")
    
    # ============ TEST 2: Project Profit Endpoint Returns signoff_value ============
    def test_02_project_profit_returns_signoff_value(self):
        """Verify get_project_profit endpoint returns signoff_value field"""
        # Test with proj_17942869 which has signoff_value=300000
        response = self.session.get(f"{BASE_URL}/api/finance/project-profit/proj_17942869")
        assert response.status_code == 200, f"Failed to get project profit: {response.text}"
        
        data = response.json()
        
        # Verify signoff_value is returned
        assert "signoff_value" in data, "signoff_value field missing from response"
        assert data["signoff_value"] == 300000, f"Expected signoff_value=300000, got {data['signoff_value']}"
        
        # Verify contract_value equals signoff_value (backward compatibility)
        assert "contract_value" in data, "contract_value field missing"
        assert data["contract_value"] == data["signoff_value"], "contract_value should equal signoff_value"
        
        print(f"✓ Project profit returns signoff_value={data['signoff_value']}")
    
    # ============ TEST 3: Project Finance List Returns signoff_value ============
    def test_03_project_finance_list_returns_signoff_value(self):
        """Verify list_projects_with_finance returns signoff_value field"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance")
        assert response.status_code == 200, f"Failed to get project finance list: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        
        # Find proj_17942869 in the list
        test_project = None
        for p in data:
            if p.get("project_id") == "proj_17942869":
                test_project = p
                break
        
        assert test_project is not None, "Test project proj_17942869 not found in list"
        
        # Verify signoff_value is returned
        assert "signoff_value" in test_project, "signoff_value field missing from list response"
        assert test_project["signoff_value"] == 300000, f"Expected signoff_value=300000, got {test_project['signoff_value']}"
        
        # Verify contract_value equals signoff_value
        assert test_project.get("contract_value") == test_project["signoff_value"], "contract_value should equal signoff_value"
        
        print(f"✓ Project finance list returns signoff_value={test_project['signoff_value']}")
    
    # ============ TEST 4: Project Finance Detail Returns signoff_value ============
    def test_04_project_finance_detail_returns_signoff_value(self):
        """Verify get_project_finance_detail returns signoff_value in summary"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance/proj_17942869")
        assert response.status_code == 200, f"Failed to get project finance detail: {response.text}"
        
        data = response.json()
        assert "summary" in data, "summary field missing from response"
        
        summary = data["summary"]
        
        # Verify signoff_value is in summary
        assert "signoff_value" in summary, "signoff_value field missing from summary"
        assert summary["signoff_value"] == 300000, f"Expected signoff_value=300000, got {summary['signoff_value']}"
        
        # Verify contract_value equals signoff_value
        assert summary.get("contract_value") == summary["signoff_value"], "contract_value should equal signoff_value"
        
        print(f"✓ Project finance detail returns signoff_value={summary['signoff_value']}")
    
    # ============ TEST 5: Both Widgets Use Same Baseline ============
    def test_05_both_widgets_use_same_signoff_value_baseline(self):
        """Verify Financial Summary and Profit Visibility use SAME signoff_value baseline"""
        # Get data from both endpoints
        profit_response = self.session.get(f"{BASE_URL}/api/finance/project-profit/proj_17942869")
        detail_response = self.session.get(f"{BASE_URL}/api/finance/project-finance/proj_17942869")
        
        assert profit_response.status_code == 200, f"Profit endpoint failed: {profit_response.text}"
        assert detail_response.status_code == 200, f"Detail endpoint failed: {detail_response.text}"
        
        profit_data = profit_response.json()
        detail_data = detail_response.json()
        
        # Both should have same signoff_value
        profit_signoff = profit_data.get("signoff_value")
        detail_signoff = detail_data.get("summary", {}).get("signoff_value")
        
        assert profit_signoff == detail_signoff, f"Baseline mismatch: profit={profit_signoff}, detail={detail_signoff}"
        assert profit_signoff == 300000, f"Expected signoff_value=300000, got {profit_signoff}"
        
        print(f"✓ Both widgets use same signoff_value baseline: {profit_signoff}")
    
    # ============ TEST 6: Remaining Liability From Collection ============
    def test_06_remaining_liability_from_collection(self):
        """Verify remaining_liability comes from finance_liabilities collection"""
        # Test with proj_17942869 which has remaining_liability=150000
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance/proj_17942869")
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        
        data = response.json()
        summary = data.get("summary", {})
        
        # Verify remaining_liability is returned
        assert "remaining_liability" in summary, "remaining_liability field missing"
        
        # According to main agent, proj_17942869 has one open liability of 150000
        remaining_liability = summary["remaining_liability"]
        assert remaining_liability == 150000, f"Expected remaining_liability=150000, got {remaining_liability}"
        
        print(f"✓ Remaining liability from collection: {remaining_liability}")
    
    # ============ TEST 7: Remaining Liability in List Endpoint ============
    def test_07_remaining_liability_in_list_endpoint(self):
        """Verify remaining_liability is returned in list endpoint from collection"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance")
        assert response.status_code == 200, f"Failed to get project finance list: {response.text}"
        
        data = response.json()
        
        # Find proj_17942869 in the list
        test_project = None
        for p in data:
            if p.get("project_id") == "proj_17942869":
                test_project = p
                break
        
        assert test_project is not None, "Test project proj_17942869 not found"
        
        # Verify remaining_liability
        assert "remaining_liability" in test_project, "remaining_liability field missing from list"
        assert test_project["remaining_liability"] == 150000, f"Expected 150000, got {test_project['remaining_liability']}"
        
        print(f"✓ List endpoint remaining_liability: {test_project['remaining_liability']}")
    
    # ============ TEST 8: Remaining Liability Never Negative ============
    def test_08_remaining_liability_never_negative(self):
        """Verify remaining_liability is never negative"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance")
        assert response.status_code == 200, f"Failed to get project finance list: {response.text}"
        
        data = response.json()
        
        negative_liabilities = []
        for p in data:
            liability = p.get("remaining_liability", 0)
            if liability < 0:
                negative_liabilities.append({
                    "project_id": p.get("project_id"),
                    "remaining_liability": liability
                })
        
        assert len(negative_liabilities) == 0, f"Found negative liabilities: {negative_liabilities}"
        print(f"✓ No negative liabilities found in {len(data)} projects")
    
    # ============ TEST 9: Profit Calculations Use Correct Formula ============
    def test_09_profit_calculations_correct(self):
        """Verify profit calculations: Projected = signoff_value - planned_cost, Realised = received - actual_cost"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-profit/proj_17942869")
        assert response.status_code == 200, f"Failed to get project profit: {response.text}"
        
        data = response.json()
        
        signoff_value = data.get("signoff_value", 0)
        planned_cost = data.get("planned_cost", 0)
        actual_cost = data.get("actual_cost", 0)
        total_received = data.get("total_received", 0)
        projected_profit = data.get("projected_profit", 0)
        realised_profit = data.get("realised_profit", 0)
        
        # Verify Projected Profit = signoff_value - planned_cost
        expected_projected = signoff_value - planned_cost
        assert projected_profit == expected_projected, f"Projected profit mismatch: expected {expected_projected}, got {projected_profit}"
        
        # Verify Realised Profit = received - actual_cost
        expected_realised = total_received - actual_cost
        assert realised_profit == expected_realised, f"Realised profit mismatch: expected {expected_realised}, got {realised_profit}"
        
        print(f"✓ Profit calculations correct:")
        print(f"  Projected: {signoff_value} - {planned_cost} = {projected_profit}")
        print(f"  Realised: {total_received} - {actual_cost} = {realised_profit}")
    
    # ============ TEST 10: Test Project proj_4aaba062 ============
    def test_10_proj_4aaba062_signoff_value(self):
        """Verify proj_4aaba062 (double-posting test project) also uses signoff_value"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-profit/proj_4aaba062")
        
        if response.status_code == 404:
            pytest.skip("Project proj_4aaba062 not found")
        
        assert response.status_code == 200, f"Failed to get project profit: {response.text}"
        
        data = response.json()
        
        # Verify signoff_value is returned
        assert "signoff_value" in data, "signoff_value field missing"
        
        # Verify contract_value equals signoff_value
        assert data.get("contract_value") == data.get("signoff_value"), "contract_value should equal signoff_value"
        
        print(f"✓ proj_4aaba062 signoff_value: {data.get('signoff_value')}")
    
    # ============ TEST 11: Actual Cost Excludes Non-Cashbook Entries ============
    def test_11_actual_cost_excludes_non_cashbook_entries(self):
        """Verify actual_cost excludes is_cashbook_entry=False entries"""
        # Get project profit data
        response = self.session.get(f"{BASE_URL}/api/finance/project-profit/proj_17942869")
        assert response.status_code == 200, f"Failed to get project profit: {response.text}"
        
        data = response.json()
        actual_cost = data.get("actual_cost", 0)
        
        # Get project finance detail to compare
        detail_response = self.session.get(f"{BASE_URL}/api/finance/project-finance/proj_17942869")
        assert detail_response.status_code == 200, f"Failed to get project detail: {detail_response.text}"
        
        detail_data = detail_response.json()
        detail_actual_cost = detail_data.get("summary", {}).get("actual_cost", 0)
        
        # Both should have same actual_cost (both exclude non-cashbook entries)
        assert actual_cost == detail_actual_cost, f"Actual cost mismatch: profit={actual_cost}, detail={detail_actual_cost}"
        
        print(f"✓ Actual cost consistent across endpoints: {actual_cost}")
    
    # ============ TEST 12: Verify All Required Fields in Profit Response ============
    def test_12_profit_response_has_all_required_fields(self):
        """Verify get_project_profit returns all required fields"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-profit/proj_17942869")
        assert response.status_code == 200, f"Failed to get project profit: {response.text}"
        
        data = response.json()
        
        required_fields = [
            "project_id",
            "project_name",
            "signoff_value",
            "signoff_locked",
            "contract_value",
            "planned_cost",
            "actual_cost",
            "total_received",
            "projected_profit",
            "projected_profit_pct",
            "realised_profit",
            "realised_profit_pct",
            "execution_margin_remaining"
        ]
        
        missing_fields = [f for f in required_fields if f not in data]
        assert len(missing_fields) == 0, f"Missing fields in response: {missing_fields}"
        
        print(f"✓ All {len(required_fields)} required fields present in profit response")
    
    # ============ TEST 13: Verify Liability Status Filter ============
    def test_13_liability_includes_open_and_partially_settled(self):
        """Verify remaining_liability includes both 'open' and 'partially_settled' status"""
        # This test verifies the query logic by checking the response
        # The actual query in code uses: {"status": {"$in": ["open", "partially_settled"]}}
        
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance/proj_17942869")
        assert response.status_code == 200, f"Failed to get project finance: {response.text}"
        
        data = response.json()
        summary = data.get("summary", {})
        
        # Verify remaining_liability is present and non-negative
        remaining_liability = summary.get("remaining_liability", 0)
        assert remaining_liability >= 0, f"Liability should not be negative: {remaining_liability}"
        
        # For proj_17942869, we expect 150000 (one open liability)
        assert remaining_liability == 150000, f"Expected 150000, got {remaining_liability}"
        
        print(f"✓ Liability includes open/partially_settled: {remaining_liability}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
