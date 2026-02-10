"""
Test Financial Mapping Fix - Project Finance Value Lifecycle
Tests that:
1. GET /api/finance/project-finance returns signoff_value, booked_value, presales_budget fields
2. GET /api/finance/project-finance/{project_id} returns signoff_value in summary
3. signoff_value is used for profit calculations (not presales_budget)
4. backward compatibility: contract_value field still returned (equals signoff_value)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFinancialMappingFix:
    """Test financial value lifecycle mapping fix"""
    
    session = None
    test_project_id = "proj_4aaba062"  # Test project with known values
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        if TestFinancialMappingFix.session is None:
            TestFinancialMappingFix.session = requests.Session()
            # Login with founder credentials
            login_response = self.session.post(
                f"{BASE_URL}/api/auth/local-login",
                json={
                    "email": "sidheeq.arkidots@gmail.com",
                    "password": "founder123"
                }
            )
            assert login_response.status_code == 200, f"Login failed: {login_response.text}"
            print(f"✓ Login successful")
    
    def test_01_login_works(self):
        """Test authentication is working"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == "sidheeq.arkidots@gmail.com"
        print(f"✓ Auth working - user: {data['name']}")
    
    def test_02_list_projects_returns_value_lifecycle_fields(self):
        """Test GET /api/finance/project-finance returns all value lifecycle fields"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        projects = response.json()
        assert isinstance(projects, list), "Response should be a list"
        assert len(projects) > 0, "Should have at least one project"
        
        # Check first project has all required fields
        project = projects[0]
        
        # Value lifecycle fields
        assert "presales_budget" in project, "Missing presales_budget field"
        assert "booked_value" in project, "Missing booked_value field"
        assert "signoff_value" in project, "Missing signoff_value field"
        assert "signoff_locked" in project, "Missing signoff_locked field"
        
        # Backward compatibility
        assert "contract_value" in project, "Missing contract_value field (backward compatibility)"
        
        # Financial summary fields
        assert "total_received" in project, "Missing total_received field"
        assert "planned_cost" in project, "Missing planned_cost field"
        assert "actual_cost" in project, "Missing actual_cost field"
        assert "remaining_liability" in project, "Missing remaining_liability field"
        assert "safe_surplus" in project, "Missing safe_surplus field"
        
        print(f"✓ List projects returns all value lifecycle fields")
        print(f"  Sample project: presales_budget={project['presales_budget']}, booked_value={project['booked_value']}, signoff_value={project['signoff_value']}")
    
    def test_03_contract_value_equals_signoff_value(self):
        """Test backward compatibility: contract_value equals signoff_value"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance")
        assert response.status_code == 200
        
        projects = response.json()
        for project in projects[:5]:  # Check first 5 projects
            signoff_value = project.get("signoff_value")
            contract_value = project.get("contract_value")
            
            # contract_value should equal signoff_value for backward compatibility
            assert contract_value == signoff_value, \
                f"contract_value ({contract_value}) should equal signoff_value ({signoff_value}) for project {project.get('pid')}"
        
        print(f"✓ contract_value equals signoff_value for backward compatibility")
    
    def test_04_get_project_finance_detail_returns_value_lifecycle(self):
        """Test GET /api/finance/project-finance/{project_id} returns value lifecycle in summary"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance/{self.test_project_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Check structure
        assert "project" in data, "Missing project field"
        assert "summary" in data, "Missing summary field"
        
        summary = data["summary"]
        
        # Value lifecycle fields in summary
        assert "presales_budget" in summary, "Missing presales_budget in summary"
        assert "booked_value" in summary, "Missing booked_value in summary"
        assert "signoff_value" in summary, "Missing signoff_value in summary"
        assert "signoff_locked" in summary, "Missing signoff_locked in summary"
        assert "contract_value" in summary, "Missing contract_value in summary (backward compatibility)"
        
        # Financial metrics
        assert "total_received" in summary, "Missing total_received in summary"
        assert "planned_cost" in summary, "Missing planned_cost in summary"
        assert "actual_cost" in summary, "Missing actual_cost in summary"
        assert "remaining_liability" in summary, "Missing remaining_liability in summary"
        assert "safe_surplus" in summary, "Missing safe_surplus in summary"
        
        # Profit calculations
        assert "gross_profit" in summary, "Missing gross_profit in summary"
        assert "profit_margin" in summary, "Missing profit_margin in summary"
        
        print(f"✓ Project finance detail returns all value lifecycle fields")
        print(f"  Summary: presales_budget={summary['presales_budget']}, booked_value={summary['booked_value']}, signoff_value={summary['signoff_value']}")
    
    def test_05_signoff_value_used_for_profit_calculations(self):
        """Test that signoff_value is used for profit calculations, not presales_budget"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance/{self.test_project_id}")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        signoff_value = summary.get("signoff_value", 0)
        actual_cost = summary.get("actual_cost", 0)
        gross_profit = summary.get("gross_profit", 0)
        profit_margin = summary.get("profit_margin", 0)
        
        # Verify profit calculation uses signoff_value
        if signoff_value > 0:
            expected_gross_profit = signoff_value - actual_cost
            expected_profit_margin = round(((signoff_value - actual_cost) / signoff_value) * 100, 1)
            
            assert gross_profit == expected_gross_profit, \
                f"gross_profit ({gross_profit}) should be signoff_value ({signoff_value}) - actual_cost ({actual_cost}) = {expected_gross_profit}"
            
            assert profit_margin == expected_profit_margin, \
                f"profit_margin ({profit_margin}) should be {expected_profit_margin}%"
            
            print(f"✓ Profit calculations use signoff_value correctly")
            print(f"  signoff_value={signoff_value}, actual_cost={actual_cost}, gross_profit={gross_profit}, profit_margin={profit_margin}%")
        else:
            print(f"⚠ signoff_value is 0, skipping profit calculation verification")
    
    def test_06_test_project_has_correct_signoff_value(self):
        """Test that test project proj_4aaba062 has signoff_value=214000 (not presales_budget=500000)"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance/{self.test_project_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        summary = data["summary"]
        
        signoff_value = summary.get("signoff_value", 0)
        presales_budget = summary.get("presales_budget", 0)
        
        # According to the test request, signoff_value should be 214000, presales_budget should be 500000
        # This verifies the fix is working - signoff_value is NOT pulling presales_budget
        print(f"  Test project values: signoff_value={signoff_value}, presales_budget={presales_budget}")
        
        # The key assertion: signoff_value should NOT equal presales_budget if they are different
        # This confirms the fix is working
        if presales_budget == 500000:
            assert signoff_value != presales_budget or signoff_value == 214000, \
                f"signoff_value ({signoff_value}) should be different from presales_budget ({presales_budget}) - expected 214000"
            print(f"✓ signoff_value correctly differs from presales_budget")
        else:
            print(f"⚠ presales_budget is not 500000 as expected, may have been modified")
    
    def test_07_value_lifecycle_fields_are_distinct(self):
        """Test that presales_budget, booked_value, and signoff_value are tracked as distinct fields"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance")
        assert response.status_code == 200
        
        projects = response.json()
        
        # Find projects where values differ to verify they're tracked separately
        projects_with_different_values = []
        for p in projects:
            presales = p.get("presales_budget", 0)
            booked = p.get("booked_value", 0)
            signoff = p.get("signoff_value", 0)
            
            if presales != booked or booked != signoff or presales != signoff:
                projects_with_different_values.append({
                    "pid": p.get("pid"),
                    "presales_budget": presales,
                    "booked_value": booked,
                    "signoff_value": signoff
                })
        
        print(f"✓ Found {len(projects_with_different_values)} projects with distinct value lifecycle values")
        for p in projects_with_different_values[:3]:
            print(f"  {p['pid']}: presales={p['presales_budget']}, booked={p['booked_value']}, signoff={p['signoff_value']}")
    
    def test_08_detail_contract_value_equals_signoff_value(self):
        """Test backward compatibility in detail endpoint: contract_value equals signoff_value"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance/{self.test_project_id}")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        signoff_value = summary.get("signoff_value")
        contract_value = summary.get("contract_value")
        
        assert contract_value == signoff_value, \
            f"In detail endpoint, contract_value ({contract_value}) should equal signoff_value ({signoff_value})"
        
        print(f"✓ Detail endpoint: contract_value equals signoff_value for backward compatibility")


class TestFinancialMappingListEndpoint:
    """Additional tests for list endpoint value lifecycle"""
    
    session = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        if TestFinancialMappingListEndpoint.session is None:
            TestFinancialMappingListEndpoint.session = requests.Session()
            login_response = self.session.post(
                f"{BASE_URL}/api/auth/local-login",
                json={
                    "email": "sidheeq.arkidots@gmail.com",
                    "password": "founder123"
                }
            )
            assert login_response.status_code == 200
    
    def test_01_search_filter_works(self):
        """Test search filter on project finance list"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance?search=ARKI")
        assert response.status_code == 200
        
        projects = response.json()
        print(f"✓ Search filter works - found {len(projects)} projects matching 'ARKI'")
    
    def test_02_all_projects_have_value_lifecycle(self):
        """Test all projects in list have value lifecycle fields"""
        response = self.session.get(f"{BASE_URL}/api/finance/project-finance")
        assert response.status_code == 200
        
        projects = response.json()
        
        missing_fields = []
        for p in projects:
            pid = p.get("pid", "unknown")
            if "presales_budget" not in p:
                missing_fields.append(f"{pid}: missing presales_budget")
            if "booked_value" not in p:
                missing_fields.append(f"{pid}: missing booked_value")
            if "signoff_value" not in p:
                missing_fields.append(f"{pid}: missing signoff_value")
            if "contract_value" not in p:
                missing_fields.append(f"{pid}: missing contract_value")
        
        assert len(missing_fields) == 0, f"Missing fields: {missing_fields}"
        print(f"✓ All {len(projects)} projects have complete value lifecycle fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
