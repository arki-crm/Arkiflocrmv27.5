"""
Test Advanced Filters & Sorting for Leads, Projects, and PreSales pages
Tests: Time filters, Designer filter, Hold Status filter, Sorting
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdvancedFiltersSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        # Login to get session cookie
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        return s
    
    def test_login_success(self, session):
        """Verify login works"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == "thaha.pakayil@gmail.com"
        print(f"Logged in as: {data['name']} ({data['role']})")


class TestLeadsAdvancedFilters:
    """Test advanced filters on Leads endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        return s
    
    def test_leads_basic_fetch(self, session):
        """Test basic leads fetch without filters"""
        response = session.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} leads")
    
    def test_leads_time_filter_this_month(self, session):
        """Test time_filter=this_month"""
        response = session.get(f"{BASE_URL}/api/leads?time_filter=this_month")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This month leads: {len(data)}")
    
    def test_leads_time_filter_last_month(self, session):
        """Test time_filter=last_month"""
        response = session.get(f"{BASE_URL}/api/leads?time_filter=last_month")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Last month leads: {len(data)}")
    
    def test_leads_time_filter_this_quarter(self, session):
        """Test time_filter=this_quarter"""
        response = session.get(f"{BASE_URL}/api/leads?time_filter=this_quarter")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This quarter leads: {len(data)}")
    
    def test_leads_time_filter_custom_range(self, session):
        """Test custom date range filter"""
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        response = session.get(
            f"{BASE_URL}/api/leads?time_filter=custom&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Custom range leads ({start_date} to {end_date}): {len(data)}")
    
    def test_leads_sort_by_created_at_desc(self, session):
        """Test sorting by created_at descending"""
        response = session.get(f"{BASE_URL}/api/leads?sort_by=created_at&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify sorting order
        if len(data) >= 2:
            dates = [d.get("created_at", "") for d in data if d.get("created_at")]
            if len(dates) >= 2:
                assert dates[0] >= dates[1], "Should be sorted descending"
        print(f"Sorted by created_at desc: {len(data)} leads")
    
    def test_leads_sort_by_created_at_asc(self, session):
        """Test sorting by created_at ascending"""
        response = session.get(f"{BASE_URL}/api/leads?sort_by=created_at&sort_order=asc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify sorting order
        if len(data) >= 2:
            dates = [d.get("created_at", "") for d in data if d.get("created_at")]
            if len(dates) >= 2:
                assert dates[0] <= dates[1], "Should be sorted ascending"
        print(f"Sorted by created_at asc: {len(data)} leads")
    
    def test_leads_sort_by_updated_at(self, session):
        """Test sorting by updated_at"""
        response = session.get(f"{BASE_URL}/api/leads?sort_by=updated_at&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by updated_at: {len(data)} leads")
    
    def test_leads_sort_by_budget_desc(self, session):
        """Test sorting by budget descending"""
        response = session.get(f"{BASE_URL}/api/leads?sort_by=budget&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify budget sorting
        if len(data) >= 2:
            budgets = [float(d.get("budget", 0) or 0) for d in data]
            if budgets[0] > 0 and budgets[1] > 0:
                assert budgets[0] >= budgets[1], "Should be sorted by budget descending"
        print(f"Sorted by budget desc: {len(data)} leads")
    
    def test_leads_sort_by_budget_asc(self, session):
        """Test sorting by budget ascending"""
        response = session.get(f"{BASE_URL}/api/leads?sort_by=budget&sort_order=asc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by budget asc: {len(data)} leads")


class TestProjectsAdvancedFilters:
    """Test advanced filters on Projects endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        return s
    
    def test_projects_basic_fetch(self, session):
        """Test basic projects fetch without filters"""
        response = session.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} projects")
    
    def test_projects_time_filter_this_month(self, session):
        """Test time_filter=this_month"""
        response = session.get(f"{BASE_URL}/api/projects?time_filter=this_month")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This month projects: {len(data)}")
    
    def test_projects_time_filter_last_month(self, session):
        """Test time_filter=last_month"""
        response = session.get(f"{BASE_URL}/api/projects?time_filter=last_month")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Last month projects: {len(data)}")
    
    def test_projects_time_filter_this_quarter(self, session):
        """Test time_filter=this_quarter"""
        response = session.get(f"{BASE_URL}/api/projects?time_filter=this_quarter")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This quarter projects: {len(data)}")
    
    def test_projects_time_filter_custom_range(self, session):
        """Test custom date range filter"""
        start_date = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        response = session.get(
            f"{BASE_URL}/api/projects?time_filter=custom&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Custom range projects ({start_date} to {end_date}): {len(data)}")
    
    def test_projects_hold_status_active(self, session):
        """Test hold_status=Active filter"""
        response = session.get(f"{BASE_URL}/api/projects?hold_status=Active")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned projects are Active
        for project in data:
            assert project.get("hold_status", "Active") == "Active", f"Expected Active, got {project.get('hold_status')}"
        print(f"Active projects: {len(data)}")
    
    def test_projects_hold_status_hold(self, session):
        """Test hold_status=Hold filter"""
        response = session.get(f"{BASE_URL}/api/projects?hold_status=Hold")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned projects are on Hold
        for project in data:
            assert project.get("hold_status") == "Hold", f"Expected Hold, got {project.get('hold_status')}"
        print(f"On Hold projects: {len(data)}")
    
    def test_projects_hold_status_deactivated(self, session):
        """Test hold_status=Deactivated filter"""
        response = session.get(f"{BASE_URL}/api/projects?hold_status=Deactivated")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned projects are Deactivated
        for project in data:
            assert project.get("hold_status") == "Deactivated", f"Expected Deactivated, got {project.get('hold_status')}"
        print(f"Deactivated projects: {len(data)}")
    
    def test_projects_sort_by_created_at_desc(self, session):
        """Test sorting by created_at descending"""
        response = session.get(f"{BASE_URL}/api/projects?sort_by=created_at&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify sorting order
        if len(data) >= 2:
            dates = [d.get("created_at", "") for d in data if d.get("created_at")]
            if len(dates) >= 2:
                assert dates[0] >= dates[1], "Should be sorted descending"
        print(f"Sorted by created_at desc: {len(data)} projects")
    
    def test_projects_sort_by_updated_at(self, session):
        """Test sorting by updated_at"""
        response = session.get(f"{BASE_URL}/api/projects?sort_by=updated_at&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by updated_at: {len(data)} projects")
    
    def test_projects_sort_by_project_value_desc(self, session):
        """Test sorting by project_value descending"""
        response = session.get(f"{BASE_URL}/api/projects?sort_by=project_value&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify project_value sorting
        if len(data) >= 2:
            values = [float(d.get("project_value", 0) or 0) for d in data]
            if values[0] > 0 and values[1] > 0:
                assert values[0] >= values[1], "Should be sorted by project_value descending"
        print(f"Sorted by project_value desc: {len(data)} projects")
    
    def test_projects_sort_by_project_value_asc(self, session):
        """Test sorting by project_value ascending"""
        response = session.get(f"{BASE_URL}/api/projects?sort_by=project_value&sort_order=asc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by project_value asc: {len(data)} projects")


class TestPreSalesAdvancedFilters:
    """Test advanced filters on PreSales endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        return s
    
    def test_presales_basic_fetch(self, session):
        """Test basic presales fetch without filters"""
        response = session.get(f"{BASE_URL}/api/presales")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} presales leads")
    
    def test_presales_time_filter_this_month(self, session):
        """Test time_filter=this_month"""
        response = session.get(f"{BASE_URL}/api/presales?time_filter=this_month")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This month presales: {len(data)}")
    
    def test_presales_time_filter_last_month(self, session):
        """Test time_filter=last_month"""
        response = session.get(f"{BASE_URL}/api/presales?time_filter=last_month")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Last month presales: {len(data)}")
    
    def test_presales_time_filter_this_quarter(self, session):
        """Test time_filter=this_quarter"""
        response = session.get(f"{BASE_URL}/api/presales?time_filter=this_quarter")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This quarter presales: {len(data)}")
    
    def test_presales_time_filter_custom_range(self, session):
        """Test custom date range filter"""
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        response = session.get(
            f"{BASE_URL}/api/presales?time_filter=custom&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Custom range presales ({start_date} to {end_date}): {len(data)}")
    
    def test_presales_sort_by_created_at_desc(self, session):
        """Test sorting by created_at descending"""
        response = session.get(f"{BASE_URL}/api/presales?sort_by=created_at&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by created_at desc: {len(data)} presales")
    
    def test_presales_sort_by_created_at_asc(self, session):
        """Test sorting by created_at ascending"""
        response = session.get(f"{BASE_URL}/api/presales?sort_by=created_at&sort_order=asc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by created_at asc: {len(data)} presales")
    
    def test_presales_sort_by_updated_at(self, session):
        """Test sorting by updated_at"""
        response = session.get(f"{BASE_URL}/api/presales?sort_by=updated_at&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by updated_at: {len(data)} presales")
    
    def test_presales_sort_by_budget_desc(self, session):
        """Test sorting by budget descending"""
        response = session.get(f"{BASE_URL}/api/presales?sort_by=budget&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by budget desc: {len(data)} presales")
    
    def test_presales_sort_by_budget_asc(self, session):
        """Test sorting by budget ascending"""
        response = session.get(f"{BASE_URL}/api/presales?sort_by=budget&sort_order=asc")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Sorted by budget asc: {len(data)} presales")


class TestDesignerFilter:
    """Test designer filter functionality"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        return s
    
    def test_get_designers_list(self, session):
        """Test fetching designers list for filter dropdown"""
        response = session.get(f"{BASE_URL}/api/users/designers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} designers")
        
        # Store designer IDs for filter tests
        if data:
            return data[0].get("user_id")
        return None
    
    def test_leads_designer_filter(self, session):
        """Test filtering leads by designer_id"""
        # First get a designer
        designers_response = session.get(f"{BASE_URL}/api/users/designers")
        if designers_response.status_code != 200:
            pytest.skip("Could not fetch designers")
        
        designers = designers_response.json()
        if not designers:
            pytest.skip("No designers available")
        
        designer_id = designers[0].get("user_id")
        
        # Filter leads by designer
        response = session.get(f"{BASE_URL}/api/leads?designer_id={designer_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned leads have the designer
        for lead in data:
            assert lead.get("designer_id") == designer_id, f"Expected designer_id {designer_id}"
        print(f"Leads for designer {designer_id}: {len(data)}")
    
    def test_projects_designer_filter(self, session):
        """Test filtering projects by designer_id (collaborator)"""
        # First get a designer
        designers_response = session.get(f"{BASE_URL}/api/users/designers")
        if designers_response.status_code != 200:
            pytest.skip("Could not fetch designers")
        
        designers = designers_response.json()
        if not designers:
            pytest.skip("No designers available")
        
        designer_id = designers[0].get("user_id")
        
        # Filter projects by designer
        response = session.get(f"{BASE_URL}/api/projects?designer_id={designer_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Projects for designer {designer_id}: {len(data)}")


class TestCombinedFilters:
    """Test combining multiple filters"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        login_response = s.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        return s
    
    def test_leads_time_and_sort(self, session):
        """Test combining time filter with sorting"""
        response = session.get(
            f"{BASE_URL}/api/leads?time_filter=this_quarter&sort_by=budget&sort_order=desc"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This quarter leads sorted by budget: {len(data)}")
    
    def test_projects_hold_status_and_sort(self, session):
        """Test combining hold status with sorting"""
        response = session.get(
            f"{BASE_URL}/api/projects?hold_status=Active&sort_by=project_value&sort_order=desc"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all are Active
        for project in data:
            assert project.get("hold_status", "Active") == "Active"
        print(f"Active projects sorted by value: {len(data)}")
    
    def test_projects_time_and_hold_status(self, session):
        """Test combining time filter with hold status"""
        response = session.get(
            f"{BASE_URL}/api/projects?time_filter=this_month&hold_status=Active"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This month active projects: {len(data)}")
    
    def test_presales_time_and_sort(self, session):
        """Test combining time filter with sorting on presales"""
        response = session.get(
            f"{BASE_URL}/api/presales?time_filter=this_month&sort_by=created_at&sort_order=desc"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This month presales sorted by created_at: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
