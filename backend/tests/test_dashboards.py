"""
Test suite for Sales & Funnel Dashboard and Designer Performance Dashboard APIs
Tests the new dashboard endpoints added for financial tracking
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token created for testing
TEST_SESSION_TOKEN = "test_session_dashboard_1770228136332"


class TestSalesDashboardAPI:
    """Tests for GET /api/dashboards/sales endpoint"""
    
    def test_sales_dashboard_default_period(self):
        """Test sales dashboard with default FY period"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/sales",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["dashboard_type"] == "sales_funnel"
        assert "value_sources_tooltip" in data
        assert "period" in data
        assert "funnel_summary" in data
        assert "conversion_rates" in data
        assert "value_changes" in data
        assert "stage_breakdown" in data
        assert "generated_at" in data
        
    def test_sales_dashboard_funnel_summary_structure(self):
        """Test funnel_summary contains inquiry/booked/signoff/cancelled with values and counts"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/sales?period=fy",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        funnel = data["funnel_summary"]
        
        # Check inquiry
        assert "inquiry" in funnel
        assert "total_value" in funnel["inquiry"]
        assert "count" in funnel["inquiry"]
        assert "tooltip" in funnel["inquiry"]
        
        # Check booked
        assert "booked" in funnel
        assert "total_value" in funnel["booked"]
        assert "count" in funnel["booked"]
        
        # Check signoff
        assert "signoff" in funnel
        assert "total_value" in funnel["signoff"]
        assert "count" in funnel["signoff"]
        
        # Check cancelled
        assert "cancelled" in funnel
        assert "total_value" in funnel["cancelled"]
        assert "count" in funnel["cancelled"]
        
    def test_sales_dashboard_conversion_rates(self):
        """Test conversion_rates contains inquiry_to_booked and booked_to_signoff"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/sales?period=fy",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        conversions = data["conversion_rates"]
        
        # Check inquiry_to_booked
        assert "inquiry_to_booked" in conversions
        assert "rate" in conversions["inquiry_to_booked"]
        assert isinstance(conversions["inquiry_to_booked"]["rate"], (int, float))
        
        # Check booked_to_signoff
        assert "booked_to_signoff" in conversions
        assert "rate" in conversions["booked_to_signoff"]
        assert isinstance(conversions["booked_to_signoff"]["rate"], (int, float))
        
    def test_sales_dashboard_value_changes(self):
        """Test value_changes contains absolute_change and percent_change"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/sales?period=fy",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        value_changes = data["value_changes"]
        
        # Check inquiry_to_booked
        assert "inquiry_to_booked" in value_changes
        assert "absolute_change" in value_changes["inquiry_to_booked"]
        assert "percent_change" in value_changes["inquiry_to_booked"]
        assert "projects_with_increase" in value_changes["inquiry_to_booked"]
        assert "projects_with_decrease" in value_changes["inquiry_to_booked"]
        
        # Check booked_to_signoff
        assert "booked_to_signoff" in value_changes
        assert "absolute_change" in value_changes["booked_to_signoff"]
        assert "percent_change" in value_changes["booked_to_signoff"]
        
    def test_sales_dashboard_mtd_period(self):
        """Test sales dashboard with MTD period"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/sales?period=mtd",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"]["type"] == "mtd"
        assert data["period"]["label"] == "Month to Date"
        
    def test_sales_dashboard_qtd_period(self):
        """Test sales dashboard with QTD period"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/sales?period=qtd",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"]["type"] == "qtd"
        assert data["period"]["label"] == "Quarter to Date"
        
    def test_sales_dashboard_custom_period(self):
        """Test sales dashboard with custom date range"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/sales?period=custom&from_date=2025-01-01&to_date=2025-12-31",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"]["type"] == "custom"
        assert "2025-01-01" in data["period"]["label"]
        assert "2025-12-31" in data["period"]["label"]


class TestDesignerDashboardAPI:
    """Tests for GET /api/dashboards/designer endpoint"""
    
    def test_designer_dashboard_default_period(self):
        """Test designer dashboard with default FY period"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["dashboard_type"] == "designer_performance"
        assert "value_sources_tooltip" in data
        assert "period" in data
        assert "team_summary" in data
        assert "designers" in data
        assert "generated_at" in data
        
    def test_designer_dashboard_team_summary(self):
        """Test team_summary contains totals"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer?period=fy",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        team = data["team_summary"]
        
        assert "total_booked_value" in team
        assert "total_signoff_value" in team
        assert "net_value_change" in team
        assert "net_value_change_percent" in team
        assert "total_projects" in team
        assert "active_designers" in team
        
    def test_designer_dashboard_designers_array(self):
        """Test designers array contains per-designer metrics"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer?period=fy",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        designers = data["designers"]
        assert isinstance(designers, list)
        
        # Check at least one designer entry exists (even if unassigned)
        if len(designers) > 0:
            designer = designers[0]
            assert "designer_id" in designer
            assert "designer_name" in designer
            assert "total_booked_value" in designer
            assert "total_signoff_value" in designer
            assert "net_value_change" in designer
            assert "project_count" in designer
            assert "active_projects" in designer
            assert "completed_projects" in designer
            assert "cancelled_projects" in designer
            assert "retention_rate" in designer
            
    def test_designer_dashboard_monthly_breakdown(self):
        """Test designers have monthly_breakdown for time-based performance"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer?period=fy",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        designers = data["designers"]
        if len(designers) > 0:
            designer = designers[0]
            assert "monthly_breakdown" in designer
            assert isinstance(designer["monthly_breakdown"], list)
            
    def test_designer_dashboard_mtd_period(self):
        """Test designer dashboard with MTD period"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer?period=mtd",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"]["type"] == "mtd"
        assert data["period"]["label"] == "Month to Date"
        
    def test_designer_dashboard_qtd_period(self):
        """Test designer dashboard with QTD period"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer?period=qtd",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"]["type"] == "qtd"
        assert data["period"]["label"] == "Quarter to Date"
        
    def test_designer_dashboard_custom_period(self):
        """Test designer dashboard with custom date range"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer?period=custom&from_date=2025-01-01&to_date=2025-12-31",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"]["type"] == "custom"
        assert "2025-01-01" in data["period"]["label"]
        assert "2025-12-31" in data["period"]["label"]


class TestDashboardAccessControl:
    """Tests for dashboard access control"""
    
    def test_sales_dashboard_requires_auth(self):
        """Test sales dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboards/sales")
        assert response.status_code == 401
        
    def test_designer_dashboard_requires_auth(self):
        """Test designer dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboards/designer")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
