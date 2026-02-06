"""
P2 System Accuracy & Reporting Bug Fixes Tests
- P2-8: Date/time incorrect system-wide - using UTC instead of local timezone
- P2-9: Purchase return reflection accuracy in reports - profitability report not including purchase refunds
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestP2ProfitabilityReportPurchaseRefunds:
    """P2-9: Profitability report now includes purchase_refunds and net_actual_cost fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        yield
        self.session.close()
    
    def test_profitability_report_endpoint_accessible(self):
        """Test that profitability report endpoint is accessible"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "summary" in data
        assert "projects" in data
        print("✓ Profitability report endpoint accessible")
    
    def test_profitability_report_summary_has_purchase_refunds_field(self):
        """P2-9: Summary should include total_purchase_refunds field"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        assert "total_purchase_refunds" in summary, "Missing total_purchase_refunds in summary"
        assert isinstance(summary["total_purchase_refunds"], (int, float)), "total_purchase_refunds should be numeric"
        print(f"✓ Summary has total_purchase_refunds: {summary['total_purchase_refunds']}")
    
    def test_profitability_report_summary_has_total_net_cost_field(self):
        """P2-9: Summary should include total_net_cost field"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        assert "total_net_cost" in summary, "Missing total_net_cost in summary"
        assert isinstance(summary["total_net_cost"], (int, float)), "total_net_cost should be numeric"
        print(f"✓ Summary has total_net_cost: {summary['total_net_cost']}")
    
    def test_profitability_report_projects_have_purchase_refunds_field(self):
        """P2-9: Each project should include purchase_refunds field"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        data = response.json()
        
        projects = data.get("projects", [])
        if len(projects) == 0:
            pytest.skip("No projects found to test")
        
        for project in projects[:5]:  # Check first 5 projects
            assert "purchase_refunds" in project, f"Missing purchase_refunds in project {project.get('project_id')}"
            assert isinstance(project["purchase_refunds"], (int, float)), "purchase_refunds should be numeric"
        
        print(f"✓ All projects have purchase_refunds field (checked {min(5, len(projects))} projects)")
    
    def test_profitability_report_projects_have_net_actual_cost_field(self):
        """P2-9: Each project should include net_actual_cost field"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        data = response.json()
        
        projects = data.get("projects", [])
        if len(projects) == 0:
            pytest.skip("No projects found to test")
        
        for project in projects[:5]:  # Check first 5 projects
            assert "net_actual_cost" in project, f"Missing net_actual_cost in project {project.get('project_id')}"
            assert isinstance(project["net_actual_cost"], (int, float)), "net_actual_cost should be numeric"
        
        print(f"✓ All projects have net_actual_cost field (checked {min(5, len(projects))} projects)")
    
    def test_net_actual_cost_calculation_correct(self):
        """P2-9: net_actual_cost should equal actual_cost - purchase_refunds"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        data = response.json()
        
        projects = data.get("projects", [])
        if len(projects) == 0:
            pytest.skip("No projects found to test")
        
        for project in projects[:5]:
            actual_cost = project.get("actual_cost", 0)
            purchase_refunds = project.get("purchase_refunds", 0)
            net_actual_cost = project.get("net_actual_cost", 0)
            
            expected_net_cost = actual_cost - purchase_refunds
            assert abs(net_actual_cost - expected_net_cost) < 0.01, \
                f"net_actual_cost mismatch for {project.get('project_id')}: expected {expected_net_cost}, got {net_actual_cost}"
        
        print("✓ net_actual_cost calculation is correct (actual_cost - purchase_refunds)")
    
    def test_summary_total_net_cost_calculation_correct(self):
        """P2-9: total_net_cost should equal total_actual_cost - total_purchase_refunds"""
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability")
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        total_actual_cost = summary.get("total_actual_cost", 0)
        total_purchase_refunds = summary.get("total_purchase_refunds", 0)
        total_net_cost = summary.get("total_net_cost", 0)
        
        expected_total_net_cost = total_actual_cost - total_purchase_refunds
        assert abs(total_net_cost - expected_total_net_cost) < 0.01, \
            f"total_net_cost mismatch: expected {expected_total_net_cost}, got {total_net_cost}"
        
        print(f"✓ Summary total_net_cost calculation correct: {total_actual_cost} - {total_purchase_refunds} = {total_net_cost}")
    
    def test_profitability_report_filters_work(self):
        """Test that filters (stage, status, sort) work correctly"""
        # Test status filter
        response = self.session.get(f"{BASE_URL}/api/finance/reports/project-profitability?status=profitable")
        assert response.status_code == 200
        data = response.json()
        
        for project in data.get("projects", []):
            assert project.get("profit_status") == "profitable", \
                f"Filter failed: project {project.get('project_id')} has status {project.get('profit_status')}"
        
        print("✓ Status filter works correctly")
    
    def test_profitability_report_sort_by_net_actual_cost(self):
        """P2-9: Sorting by actual_cost should use net_actual_cost"""
        response = self.session.get(
            f"{BASE_URL}/api/finance/reports/project-profitability?sort_by=actual_cost&sort_order=desc"
        )
        assert response.status_code == 200
        data = response.json()
        
        projects = data.get("projects", [])
        if len(projects) < 2:
            pytest.skip("Not enough projects to test sorting")
        
        # Verify descending order by net_actual_cost
        for i in range(len(projects) - 1):
            current_cost = projects[i].get("net_actual_cost", 0)
            next_cost = projects[i + 1].get("net_actual_cost", 0)
            assert current_cost >= next_cost, \
                f"Sort order incorrect: {current_cost} should be >= {next_cost}"
        
        print("✓ Sorting by actual_cost uses net_actual_cost correctly")


class TestP2DateUtilityFunctions:
    """P2-8: Date utility functions should use local timezone"""
    
    def test_frontend_date_utilities_exist(self):
        """Verify date utility functions are defined in utils.js"""
        utils_path = "/app/frontend/src/lib/utils.js"
        with open(utils_path, 'r') as f:
            content = f.read()
        
        assert "getLocalDateString" in content, "Missing getLocalDateString function"
        assert "formatDateLocal" in content, "Missing formatDateLocal function"
        assert "formatTimeLocal" in content, "Missing formatTimeLocal function"
        assert "formatDateTimeLocal" in content, "Missing formatDateTimeLocal function"
        
        print("✓ All date utility functions exist in utils.js")
    
    def test_cashbook_uses_local_date(self):
        """P2-8: CashBook should use getLocalDateString for selectedDate"""
        cashbook_path = "/app/frontend/src/pages/CashBook.jsx"
        with open(cashbook_path, 'r') as f:
            content = f.read()
        
        # Check import
        assert "getLocalDateString" in content, "CashBook should import getLocalDateString"
        
        # Check usage for selectedDate initialization
        assert "getLocalDateString()" in content, "CashBook should use getLocalDateString() for date initialization"
        
        # Verify it's NOT using toISOString for date initialization
        # (toISOString is still valid for transaction_date timestamps)
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'selectedDate' in line and 'useState' in line:
                assert 'toISOString' not in line, \
                    f"Line {i+1}: selectedDate should not use toISOString: {line}"
        
        print("✓ CashBook uses getLocalDateString for selectedDate")
    
    def test_daily_closing_uses_local_date(self):
        """P2-8: DailyClosing should use getLocalDateString for selectedDate"""
        daily_closing_path = "/app/frontend/src/pages/DailyClosing.jsx"
        with open(daily_closing_path, 'r') as f:
            content = f.read()
        
        # Check import
        assert "getLocalDateString" in content, "DailyClosing should import getLocalDateString"
        
        # Check usage
        assert "getLocalDateString()" in content, "DailyClosing should use getLocalDateString()"
        
        print("✓ DailyClosing uses getLocalDateString for selectedDate")
    
    def test_local_date_function_implementation(self):
        """P2-8: getLocalDateString should return YYYY-MM-DD in local timezone"""
        utils_path = "/app/frontend/src/lib/utils.js"
        with open(utils_path, 'r') as f:
            content = f.read()
        
        # Verify the function uses getFullYear, getMonth, getDate (local methods)
        # NOT toISOString (which uses UTC)
        assert "getFullYear()" in content, "Should use getFullYear() for local year"
        assert "getMonth()" in content, "Should use getMonth() for local month"
        assert "getDate()" in content, "Should use getDate() for local day"
        
        # Verify it's NOT using toISOString in getLocalDateString
        # Find the function and check its implementation
        func_start = content.find("export function getLocalDateString")
        func_end = content.find("}", func_start) + 1
        func_body = content[func_start:func_end]
        
        assert "toISOString" not in func_body, \
            "getLocalDateString should NOT use toISOString (UTC)"
        
        print("✓ getLocalDateString uses local date methods (not UTC)")


class TestP2ProjectProfitabilityReportUI:
    """P2-9: Frontend should display purchase refunds in profitability report"""
    
    def test_profitability_report_shows_net_cost_column(self):
        """P2-9: ProjectProfitabilityReport should show Net Cost column"""
        report_path = "/app/frontend/src/pages/ProjectProfitabilityReport.jsx"
        with open(report_path, 'r') as f:
            content = f.read()
        
        # Check for Net Cost header
        assert "Net Cost" in content, "Should have 'Net Cost' column header"
        
        # Check for net_actual_cost usage
        assert "net_actual_cost" in content, "Should use net_actual_cost field"
        
        print("✓ ProjectProfitabilityReport shows Net Cost column")
    
    def test_profitability_report_shows_refund_indicator(self):
        """P2-9: Should show refund indicator when purchase_refunds > 0"""
        report_path = "/app/frontend/src/pages/ProjectProfitabilityReport.jsx"
        with open(report_path, 'r') as f:
            content = f.read()
        
        # Check for purchase_refunds conditional display
        assert "purchase_refunds" in content, "Should reference purchase_refunds field"
        assert "refund" in content.lower(), "Should display refund information"
        
        print("✓ ProjectProfitabilityReport shows refund indicator")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
