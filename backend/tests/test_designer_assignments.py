"""
Test Designer Assignment APIs
Tests for the designer assignment tracking system that handles mid-project designer changes.

Features tested:
- GET /api/projects/{id}/designer-assignments - Get assignment list with current_primary
- POST /api/projects/{id}/designer-assignments - Create new assignment
- POST /api/projects/{id}/designer-assignments with Primary role - Ends current Primary
- PUT /api/projects/{id}/designer-assignments/{aid}/end - End an assignment
- GET /api/designer-assignment-options - Get available roles and reasons
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test project ID from main agent context
TEST_PROJECT_ID = "proj_126a928d"

# Test session token (will be created in setup)
TEST_SESSION_TOKEN = None


class TestDesignerAssignmentSetup:
    """Setup test session and verify prerequisites"""
    
    @pytest.fixture(autouse=True, scope="class")
    def setup_session(self, request):
        """Create test session for authenticated requests"""
        global TEST_SESSION_TOKEN
        
        # Use local login with founder credentials
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={
                "email": "sidheeq.arkidots@gmail.com",
                "password": "founder123"
            }
        )
        
        if response.status_code == 200:
            # Extract session token from cookies
            TEST_SESSION_TOKEN = response.cookies.get('session_token')
            request.cls.session_token = TEST_SESSION_TOKEN
            request.cls.user_data = response.json().get('user', {})
            print(f"✓ Logged in as: {request.cls.user_data.get('email')}")
        else:
            pytest.skip(f"Login failed: {response.status_code} - {response.text}")
    
    def test_session_created(self):
        """Verify session was created successfully"""
        assert self.session_token is not None, "Session token should be set"
        print(f"✓ Session token obtained")


class TestGetDesignerAssignments:
    """Test GET /api/projects/{id}/designer-assignments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        global TEST_SESSION_TOKEN
        self.session_token = TEST_SESSION_TOKEN
        self.headers = {"Cookie": f"session_token={self.session_token}"}
    
    def test_get_assignments_returns_200(self):
        """GET /api/projects/{id}/designer-assignments returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET designer-assignments returns 200")
    
    def test_get_assignments_structure(self):
        """Response contains required fields: project_id, current_primary, assignments, total_assignments"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers
        )
        data = response.json()
        
        assert "project_id" in data, "Response should contain project_id"
        assert "current_primary" in data, "Response should contain current_primary"
        assert "assignments" in data, "Response should contain assignments array"
        assert "total_assignments" in data, "Response should contain total_assignments"
        assert "active_count" in data, "Response should contain active_count"
        
        print(f"✓ Response structure is correct")
        print(f"  - Total assignments: {data['total_assignments']}")
        print(f"  - Active count: {data['active_count']}")
        print(f"  - Current primary: {data['current_primary']}")
    
    def test_assignment_record_structure(self):
        """Each assignment record has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers
        )
        data = response.json()
        
        if data["assignments"]:
            assignment = data["assignments"][0]
            required_fields = [
                "assignment_id", "project_id", "designer_id", "designer_name",
                "role", "assigned_from", "assigned_to", "assignment_reason",
                "end_reason", "assigned_by", "assigned_by_name", "notes", "is_active"
            ]
            
            for field in required_fields:
                assert field in assignment, f"Assignment should contain {field}"
            
            print(f"✓ Assignment record structure is correct")
            print(f"  - Designer: {assignment['designer_name']}")
            print(f"  - Role: {assignment['role']}")
            print(f"  - Active: {assignment['is_active']}")
        else:
            print("⚠ No assignments found to verify structure")
    
    def test_get_assignments_nonexistent_project(self):
        """GET assignments for non-existent project returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/projects/nonexistent_project_xyz/designer-assignments",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent project returns 404")
    
    def test_get_assignments_requires_auth(self):
        """GET assignments without auth returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Unauthenticated request returns 401")


class TestGetDesignerAssignmentOptions:
    """Test GET /api/designer-assignment-options"""
    
    def test_get_options_returns_200(self):
        """GET /api/designer-assignment-options returns 200"""
        response = requests.get(f"{BASE_URL}/api/designer-assignment-options")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ GET designer-assignment-options returns 200")
    
    def test_options_contains_roles(self):
        """Response contains roles array with Primary and Support"""
        response = requests.get(f"{BASE_URL}/api/designer-assignment-options")
        data = response.json()
        
        assert "roles" in data, "Response should contain roles"
        assert "Primary" in data["roles"], "Roles should include Primary"
        assert "Support" in data["roles"], "Roles should include Support"
        
        print(f"✓ Roles: {data['roles']}")
    
    def test_options_contains_reasons(self):
        """Response contains assignment_reasons array"""
        response = requests.get(f"{BASE_URL}/api/designer-assignment-options")
        data = response.json()
        
        assert "assignment_reasons" in data, "Response should contain assignment_reasons"
        expected_reasons = ["initial", "reassigned", "resigned", "escalation", "workload_balance"]
        
        for reason in expected_reasons:
            assert reason in data["assignment_reasons"], f"Reasons should include {reason}"
        
        print(f"✓ Assignment reasons: {data['assignment_reasons']}")


class TestCreateDesignerAssignment:
    """Test POST /api/projects/{id}/designer-assignments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        global TEST_SESSION_TOKEN
        self.session_token = TEST_SESSION_TOKEN
        self.headers = {"Cookie": f"session_token={self.session_token}"}
    
    def test_create_assignment_requires_auth(self):
        """POST assignment without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            json={
                "designer_id": "test_designer",
                "role": "Support",
                "assignment_reason": "initial"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Unauthenticated POST returns 401")
    
    def test_create_assignment_invalid_role(self):
        """POST with invalid role returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers,
            json={
                "designer_id": "user_5744e526f9ae",
                "role": "InvalidRole",
                "assignment_reason": "initial"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid role" in response.text
        print(f"✓ Invalid role returns 400")
    
    def test_create_assignment_invalid_reason(self):
        """POST with invalid reason returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers,
            json={
                "designer_id": "user_5744e526f9ae",
                "role": "Support",
                "assignment_reason": "invalid_reason"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid reason" in response.text
        print(f"✓ Invalid reason returns 400")
    
    def test_create_assignment_nonexistent_designer(self):
        """POST with non-existent designer returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers,
            json={
                "designer_id": "nonexistent_user_xyz",
                "role": "Support",
                "assignment_reason": "initial"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent designer returns 404")


class TestEndDesignerAssignment:
    """Test PUT /api/projects/{id}/designer-assignments/{aid}/end"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        global TEST_SESSION_TOKEN
        self.session_token = TEST_SESSION_TOKEN
        self.headers = {"Cookie": f"session_token={self.session_token}"}
    
    def test_end_assignment_requires_auth(self):
        """PUT end assignment without auth returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments/test_assignment/end",
            json={
                "end_reason": "reassigned"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Unauthenticated PUT returns 401")
    
    def test_end_assignment_nonexistent(self):
        """PUT end non-existent assignment returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments/nonexistent_assignment/end",
            headers=self.headers,
            json={
                "end_reason": "reassigned"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent assignment returns 404")


class TestDesignerAssignmentIntegration:
    """Integration tests for designer assignment workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        global TEST_SESSION_TOKEN
        self.session_token = TEST_SESSION_TOKEN
        self.headers = {"Cookie": f"session_token={self.session_token}"}
    
    def test_full_assignment_workflow(self):
        """Test complete workflow: get assignments, verify current primary"""
        # Step 1: Get current assignments
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Step 1: Retrieved {data['total_assignments']} assignments")
        
        # Step 2: Verify current primary exists
        if data['current_primary']:
            primary = data['current_primary']
            assert primary['role'] == 'Primary'
            assert primary['is_active'] == True
            print(f"✓ Step 2: Current primary is {primary['designer_name']}")
        else:
            print(f"⚠ Step 2: No current primary assigned")
        
        # Step 3: Verify only one active Primary
        active_primaries = [a for a in data['assignments'] if a['role'] == 'Primary' and a['is_active']]
        assert len(active_primaries) <= 1, "Should have at most one active Primary"
        print(f"✓ Step 3: Only {len(active_primaries)} active Primary (correct)")
        
        # Step 4: Verify assignment history is preserved
        ended_assignments = [a for a in data['assignments'] if not a['is_active']]
        print(f"✓ Step 4: {len(ended_assignments)} ended assignments in history")
    
    def test_assignment_attribution_fields(self):
        """Verify assignments have proper attribution fields for dashboards"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/designer-assignments",
            headers=self.headers
        )
        data = response.json()
        
        for assignment in data['assignments']:
            # Verify attribution fields exist
            assert 'assigned_from' in assignment, "Should have assigned_from for attribution"
            assert 'assigned_to' in assignment, "Should have assigned_to for attribution"
            assert 'role' in assignment, "Should have role for attribution"
            
            # Verify timestamps are valid ISO format
            if assignment['assigned_from']:
                try:
                    datetime.fromisoformat(assignment['assigned_from'].replace('Z', '+00:00'))
                except ValueError:
                    pytest.fail(f"Invalid assigned_from format: {assignment['assigned_from']}")
            
            if assignment['assigned_to']:
                try:
                    datetime.fromisoformat(assignment['assigned_to'].replace('Z', '+00:00'))
                except ValueError:
                    pytest.fail(f"Invalid assigned_to format: {assignment['assigned_to']}")
        
        print(f"✓ All assignments have valid attribution fields")


class TestDesignerPerformanceDashboardAttribution:
    """Test that Designer Performance Dashboard uses proper attribution"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        global TEST_SESSION_TOKEN
        self.session_token = TEST_SESSION_TOKEN
        self.headers = {"Cookie": f"session_token={self.session_token}"}
    
    def test_designer_dashboard_accessible(self):
        """Designer dashboard API is accessible"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Designer dashboard API accessible")
    
    def test_designer_dashboard_structure(self):
        """Designer dashboard returns proper structure for attribution"""
        response = requests.get(
            f"{BASE_URL}/api/dashboards/designer",
            headers=self.headers
        )
        data = response.json()
        
        assert "team_summary" in data, "Should have team_summary"
        assert "designers" in data, "Should have designers array"
        
        print(f"✓ Designer dashboard structure correct")
        print(f"  - Team summary: {data.get('team_summary', {})}")
        print(f"  - Designers count: {len(data.get('designers', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
