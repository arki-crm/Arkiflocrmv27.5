"""
Test Daybook Detailed View API Endpoints
Tests the new GET /api/finance/daily-closing/{date}/transactions endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDaybookDetailedView:
    """Tests for Daybook detailed transaction view"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Store cookies for subsequent requests
        self.cookies = login_response.cookies
    
    def test_get_daily_transactions_success(self):
        """Test GET /api/finance/daily-closing/{date}/transactions returns enriched transaction list"""
        # Use date 2026-01-31 which has transactions
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing/2026-01-31/transactions",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "date" in data, "Response should contain 'date'"
        assert "transactions" in data, "Response should contain 'transactions'"
        assert "summary" in data, "Response should contain 'summary'"
        
        # Verify date
        assert data["date"] == "2026-01-31", f"Expected date 2026-01-31, got {data['date']}"
        
        # Verify summary structure
        summary = data["summary"]
        assert "count" in summary, "Summary should contain 'count'"
        assert "total_inflow" in summary, "Summary should contain 'total_inflow'"
        assert "total_outflow" in summary, "Summary should contain 'total_outflow'"
        assert "net" in summary, "Summary should contain 'net'"
        
        # Verify transactions exist
        assert len(data["transactions"]) > 0, "Should have at least one transaction"
        print(f"SUCCESS: Found {len(data['transactions'])} transactions for 2026-01-31")
    
    def test_transaction_fields_enriched(self):
        """Test that transactions contain all required enriched fields"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing/2026-01-31/transactions",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check first transaction has all required fields
        if len(data["transactions"]) > 0:
            txn = data["transactions"][0]
            
            required_fields = [
                "transaction_id", "time", "account_id", "account_name", "account_type",
                "reference", "category_id", "category_name", "purpose",
                "transaction_type", "inflow", "outflow", "mode", "recorded_by"
            ]
            
            for field in required_fields:
                assert field in txn, f"Transaction should contain '{field}'"
            
            # Verify account_name is enriched (not just ID)
            assert txn["account_name"] != txn["account_id"], "account_name should be enriched, not just ID"
            
            print(f"SUCCESS: Transaction contains all required fields")
            print(f"  - Account: {txn['account_name']}")
            print(f"  - Category: {txn['category_name']}")
            print(f"  - Mode: {txn['mode']}")
    
    def test_summary_calculations_correct(self):
        """Test that summary calculations (inflow, outflow, net) are correct"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing/2026-01-31/transactions",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Calculate expected totals from transactions
        expected_inflow = sum(t.get("inflow", 0) for t in data["transactions"])
        expected_outflow = sum(t.get("outflow", 0) for t in data["transactions"])
        expected_net = expected_inflow - expected_outflow
        
        summary = data["summary"]
        
        assert summary["total_inflow"] == expected_inflow, \
            f"Inflow mismatch: expected {expected_inflow}, got {summary['total_inflow']}"
        assert summary["total_outflow"] == expected_outflow, \
            f"Outflow mismatch: expected {expected_outflow}, got {summary['total_outflow']}"
        assert summary["net"] == expected_net, \
            f"Net mismatch: expected {expected_net}, got {summary['net']}"
        assert summary["count"] == len(data["transactions"]), \
            f"Count mismatch: expected {len(data['transactions'])}, got {summary['count']}"
        
        print(f"SUCCESS: Summary calculations are correct")
        print(f"  - Total Inflow: {summary['total_inflow']}")
        print(f"  - Total Outflow: {summary['total_outflow']}")
        print(f"  - Net: {summary['net']}")
    
    def test_invalid_date_format(self):
        """Test that invalid date format returns 400 error"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing/invalid-date/transactions",
            cookies=self.cookies
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid date, got {response.status_code}"
        print("SUCCESS: Invalid date format returns 400 error")
    
    def test_date_with_no_transactions(self):
        """Test that date with no transactions returns empty list"""
        # Use a date far in the past that likely has no transactions
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing/2020-01-01/transactions",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["transactions"] == [], "Should return empty transactions list"
        assert data["summary"]["count"] == 0, "Count should be 0"
        assert data["summary"]["total_inflow"] == 0, "Total inflow should be 0"
        assert data["summary"]["total_outflow"] == 0, "Total outflow should be 0"
        assert data["summary"]["net"] == 0, "Net should be 0"
        
        print("SUCCESS: Date with no transactions returns empty list with zero summary")
    
    def test_project_vendor_enrichment(self):
        """Test that project/vendor information is properly enriched"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing/2026-01-31/transactions",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Find a transaction with project info
        project_txns = [t for t in data["transactions"] if t.get("project_id")]
        
        if project_txns:
            txn = project_txns[0]
            assert txn.get("counterparty") is not None, "Project transaction should have counterparty"
            assert txn.get("counterparty_type") == "project", "Counterparty type should be 'project'"
            print(f"SUCCESS: Project enrichment working - {txn['counterparty']}")
        else:
            print("INFO: No project transactions found to test enrichment")
    
    def test_daily_closing_main_endpoint(self):
        """Test GET /api/finance/daily-closing returns account-wise summary"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing",
            params={"date": "2026-01-31"},
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify structure
        assert "date" in data
        assert "accounts" in data
        assert "totals" in data
        
        # Verify accounts have transaction_count
        for account in data["accounts"]:
            assert "transaction_count" in account, "Account should have transaction_count"
            assert "account_name" in account, "Account should have account_name"
        
        print(f"SUCCESS: Daily closing main endpoint returns {len(data['accounts'])} accounts")


class TestDaybookHistory:
    """Tests for Daybook history endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.cookies = login_response.cookies
    
    def test_get_closing_history(self):
        """Test GET /api/finance/daily-closing/history returns recent closings"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/daily-closing/history",
            params={"limit": 10},
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            closing = data[0]
            assert "date" in closing, "Closing should have 'date'"
            assert "transaction_count" in closing, "Closing should have 'transaction_count'"
            print(f"SUCCESS: History endpoint returns {len(data)} closings")
        else:
            print("INFO: No closing history found")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
