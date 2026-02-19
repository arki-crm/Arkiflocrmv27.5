"""
Test Daily Closing Snapshot (Founder Liquidity View) Feature
Tests the /api/finance/daily-snapshot endpoint and related functionality
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDailyClosingSnapshotAPI:
    """Tests for Daily Closing Snapshot API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with founder credentials"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as founder
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "sidheeq.arkidots@gmail.com",
                "password": "founder123"
            }
        )
        
        if login_response.status_code == 200:
            # Extract session token from cookies
            self.session_token = login_response.cookies.get('session_token')
            if self.session_token:
                self.session.cookies.set('session_token', self.session_token)
        else:
            pytest.skip(f"Founder login failed: {login_response.status_code} - {login_response.text}")
    
    def test_daily_snapshot_endpoint_exists(self):
        """Test that the daily-snapshot endpoint exists and returns 200"""
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Daily snapshot endpoint exists and returns 200")
    
    def test_daily_snapshot_returns_correct_structure(self):
        """Test that the response has the correct structure"""
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required top-level fields
        assert "date" in data, "Missing 'date' field"
        assert "date_display" in data, "Missing 'date_display' field"
        assert "is_today" in data, "Missing 'is_today' field"
        assert "generated_at" in data, "Missing 'generated_at' field"
        assert "accounts" in data, "Missing 'accounts' field"
        assert "summary" in data, "Missing 'summary' field"
        assert "by_type" in data, "Missing 'by_type' field"
        assert "account_count" in data, "Missing 'account_count' field"
        
        # Check summary structure
        summary = data["summary"]
        assert "total_cash" in summary, "Missing 'total_cash' in summary"
        assert "total_bank" in summary, "Missing 'total_bank' in summary"
        assert "total_upi_wallet" in summary, "Missing 'total_upi_wallet' in summary"
        assert "total_other" in summary, "Missing 'total_other' in summary"
        assert "grand_total" in summary, "Missing 'grand_total' in summary"
        
        print("✓ Daily snapshot returns correct structure")
        print(f"  - Date: {data['date']}")
        print(f"  - Account count: {data['account_count']}")
        print(f"  - Grand total: {data['summary']['grand_total']}")
    
    def test_daily_snapshot_default_date_is_today(self):
        """Test that default date is today when no date param provided"""
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200
        
        data = response.json()
        today = datetime.now().strftime("%Y-%m-%d")
        
        assert data["date"] == today, f"Expected date {today}, got {data['date']}"
        assert data["is_today"] == True, "Expected is_today to be True"
        
        print(f"✓ Default date is today: {today}")
    
    def test_daily_snapshot_with_specific_date(self):
        """Test that date parameter works correctly"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot?date={yesterday}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["date"] == yesterday, f"Expected date {yesterday}, got {data['date']}"
        assert data["is_today"] == False, "Expected is_today to be False for yesterday"
        
        print(f"✓ Date parameter works: {yesterday}")
    
    def test_daily_snapshot_invalid_date_format(self):
        """Test that invalid date format returns 400"""
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot?date=invalid-date")
        assert response.status_code == 400, f"Expected 400 for invalid date, got {response.status_code}"
        
        print("✓ Invalid date format returns 400")
    
    def test_daily_snapshot_summary_totals_calculation(self):
        """Test that summary totals are calculated correctly"""
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        # Grand total should equal sum of all type totals
        expected_grand_total = (
            summary["total_cash"] + 
            summary["total_bank"] + 
            summary["total_upi_wallet"] + 
            summary["total_other"]
        )
        
        assert summary["grand_total"] == expected_grand_total, \
            f"Grand total mismatch: {summary['grand_total']} != {expected_grand_total}"
        
        print(f"✓ Summary totals calculated correctly")
        print(f"  - Cash: {summary['total_cash']}")
        print(f"  - Bank: {summary['total_bank']}")
        print(f"  - UPI/Wallet: {summary['total_upi_wallet']}")
        print(f"  - Other: {summary['total_other']}")
        print(f"  - Grand Total: {summary['grand_total']}")
    
    def test_daily_snapshot_by_type_structure(self):
        """Test that by_type grouping has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200
        
        data = response.json()
        by_type = data["by_type"]
        
        # by_type should be a dict (can be empty if no accounts)
        assert isinstance(by_type, dict), "by_type should be a dictionary"
        
        # If there are accounts, check structure of each type
        for type_key, type_data in by_type.items():
            assert "type" in type_data, f"Missing 'type' in {type_key}"
            assert "type_display" in type_data, f"Missing 'type_display' in {type_key}"
            assert "accounts" in type_data, f"Missing 'accounts' in {type_key}"
            assert "total" in type_data, f"Missing 'total' in {type_key}"
            assert isinstance(type_data["accounts"], list), f"accounts should be a list in {type_key}"
        
        print(f"✓ by_type structure is correct with {len(by_type)} types")


class TestDailyClosingSnapshotPermissions:
    """Tests for permission restrictions on Daily Closing Snapshot"""
    
    def test_unauthenticated_request_returns_401(self):
        """Test that unauthenticated requests return 401"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ Unauthenticated request returns 401")
    
    def test_founder_role_has_access(self):
        """Test that Founder role can access the endpoint"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as founder
        login_response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "sidheeq.arkidots@gmail.com",
                "password": "founder123"
            }
        )
        
        if login_response.status_code != 200:
            pytest.skip("Founder login failed")
        
        response = session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200, f"Founder should have access, got {response.status_code}"
        
        print("✓ Founder role has access")
    
    def test_admin_role_has_access(self):
        """Test that Admin role can access the endpoint"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "thaha.pakayil@gmail.com",
                "password": "password123"
            }
        )
        
        if login_response.status_code != 200:
            pytest.skip("Admin login failed")
        
        response = session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200, f"Admin should have access, got {response.status_code}"
        
        print("✓ Admin role has access")


class TestDailyClosingSnapshotEmptyState:
    """Tests for empty state handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with founder credentials"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as founder
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "sidheeq.arkidots@gmail.com",
                "password": "founder123"
            }
        )
        
        if login_response.status_code != 200:
            pytest.skip("Founder login failed")
    
    def test_empty_accounts_returns_zero_totals(self):
        """Test that when no accounts exist, totals are zero"""
        response = self.session.get(f"{BASE_URL}/api/finance/daily-snapshot")
        assert response.status_code == 200
        
        data = response.json()
        
        # If no accounts, all totals should be 0
        if data["account_count"] == 0:
            assert data["summary"]["total_cash"] == 0
            assert data["summary"]["total_bank"] == 0
            assert data["summary"]["total_upi_wallet"] == 0
            assert data["summary"]["total_other"] == 0
            assert data["summary"]["grand_total"] == 0
            print("✓ Empty accounts returns zero totals")
        else:
            print(f"✓ Found {data['account_count']} accounts - skipping empty state test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
