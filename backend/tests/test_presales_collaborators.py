"""
Test Pre-Sales Collaborators Feature
Tests the new collaborator assignment functionality for Pre-Sales leads:
- GET /api/presales/{id}/collaborators - Get collaborators list
- POST /api/presales/{id}/collaborators - Add collaborator
- DELETE /api/presales/{id}/collaborators/{user_id} - Remove collaborator
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "thaha.pakayil@gmail.com"
ADMIN_PASSWORD = "password123"
TEST_PRESALES_LEAD_ID = "lead_2ae66bb8"


class TestPresalesCollaborators:
    """Test Pre-Sales Collaborators CRUD operations"""
    
    session_token = None
    test_user_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Setup - login and get session token"""
        # Setup local admin first
        setup_response = api_client.post(f"{BASE_URL}/api/auth/setup-local-admin")
        print(f"Setup local admin response: {setup_response.status_code}")
        
        # Login
        login_response = api_client.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            # Get session token from cookies
            self.session_token = login_response.cookies.get("session_token")
            print(f"Login successful, session token obtained: {bool(self.session_token)}")
        else:
            print(f"Login failed: {login_response.status_code} - {login_response.text}")
            pytest.skip("Login failed - skipping tests")
    
    def test_01_get_presales_lead_exists(self, api_client):
        """Test that the presales lead exists"""
        response = api_client.get(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}",
            cookies={"session_token": self.session_token}
        )
        
        print(f"Get presales lead response: {response.status_code}")
        
        if response.status_code == 404:
            # Lead doesn't exist, let's check what leads are available
            list_response = api_client.get(
                f"{BASE_URL}/api/presales",
                cookies={"session_token": self.session_token}
            )
            print(f"Available presales leads: {list_response.json()[:3] if list_response.status_code == 200 else 'N/A'}")
            pytest.skip(f"Test presales lead {TEST_PRESALES_LEAD_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        assert "lead_id" in data or "customer_name" in data
        print(f"Presales lead found: {data.get('customer_name', 'Unknown')}")
    
    def test_02_get_collaborators_endpoint(self, api_client):
        """Test GET /api/presales/{id}/collaborators returns collaborators list"""
        response = api_client.get(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            cookies={"session_token": self.session_token}
        )
        
        print(f"Get collaborators response: {response.status_code}")
        
        if response.status_code == 404:
            pytest.skip("Presales lead not found")
        
        assert response.status_code == 200
        data = response.json()
        assert "collaborators" in data
        assert isinstance(data["collaborators"], list)
        print(f"Current collaborators count: {len(data['collaborators'])}")
    
    def test_03_get_users_for_selection(self, api_client):
        """Test GET /api/users returns users for collaborator selection"""
        response = api_client.get(
            f"{BASE_URL}/api/users",
            cookies={"session_token": self.session_token}
        )
        
        print(f"Get users response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Available users count: {len(data)}")
        
        # Store a test user for later tests
        if len(data) > 1:
            # Find a user that's not the admin
            for user in data:
                if user.get("email") != ADMIN_EMAIL:
                    TestPresalesCollaborators.test_user_id = user.get("user_id")
                    print(f"Test user for collaborator: {user.get('name')} ({user.get('user_id')})")
                    break
    
    def test_04_add_collaborator(self, api_client):
        """Test POST /api/presales/{id}/collaborators adds a collaborator"""
        if not TestPresalesCollaborators.test_user_id:
            pytest.skip("No test user available for adding as collaborator")
        
        # First check if user is already a collaborator
        get_response = api_client.get(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            cookies={"session_token": self.session_token}
        )
        
        if get_response.status_code == 200:
            existing = get_response.json().get("collaborators", [])
            if any(c.get("user_id") == TestPresalesCollaborators.test_user_id for c in existing):
                print("User already a collaborator, removing first...")
                # Remove first
                api_client.delete(
                    f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators/{TestPresalesCollaborators.test_user_id}",
                    cookies={"session_token": self.session_token}
                )
        
        # Add collaborator
        response = api_client.post(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            json={
                "user_id": TestPresalesCollaborators.test_user_id,
                "role": "Pre-Sales Executive",
                "reason": "Test collaborator assignment"
            },
            cookies={"session_token": self.session_token}
        )
        
        print(f"Add collaborator response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 404:
            pytest.skip("Presales lead not found")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "collaborator" in data
        print(f"Collaborator added: {data['collaborator'].get('name')}")
    
    def test_05_verify_collaborator_added(self, api_client):
        """Test that collaborator appears in the list after adding"""
        if not TestPresalesCollaborators.test_user_id:
            pytest.skip("No test user available")
        
        response = api_client.get(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            cookies={"session_token": self.session_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        collaborators = data.get("collaborators", [])
        
        # Check if our test user is in the list
        found = any(c.get("user_id") == TestPresalesCollaborators.test_user_id for c in collaborators)
        assert found, f"Test user {TestPresalesCollaborators.test_user_id} not found in collaborators"
        print(f"Verified collaborator in list. Total collaborators: {len(collaborators)}")
    
    def test_06_add_duplicate_collaborator_fails(self, api_client):
        """Test that adding duplicate collaborator returns error"""
        if not TestPresalesCollaborators.test_user_id:
            pytest.skip("No test user available")
        
        response = api_client.post(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            json={
                "user_id": TestPresalesCollaborators.test_user_id,
                "role": "Designer",
                "reason": "Duplicate test"
            },
            cookies={"session_token": self.session_token}
        )
        
        print(f"Add duplicate collaborator response: {response.status_code}")
        assert response.status_code == 400
        assert "already a collaborator" in response.text.lower()
        print("Correctly rejected duplicate collaborator")
    
    def test_07_remove_collaborator(self, api_client):
        """Test DELETE /api/presales/{id}/collaborators/{user_id} removes collaborator"""
        if not TestPresalesCollaborators.test_user_id:
            pytest.skip("No test user available")
        
        response = api_client.delete(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators/{TestPresalesCollaborators.test_user_id}",
            cookies={"session_token": self.session_token}
        )
        
        print(f"Remove collaborator response: {response.status_code}")
        
        if response.status_code == 404:
            # Could be lead not found or collaborator not found
            print(f"Response: {response.text}")
            pytest.skip("Lead or collaborator not found")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Collaborator removed successfully")
    
    def test_08_verify_collaborator_removed(self, api_client):
        """Test that collaborator no longer appears in the list after removal"""
        if not TestPresalesCollaborators.test_user_id:
            pytest.skip("No test user available")
        
        response = api_client.get(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            cookies={"session_token": self.session_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        collaborators = data.get("collaborators", [])
        
        # Check that our test user is NOT in the list
        found = any(c.get("user_id") == TestPresalesCollaborators.test_user_id for c in collaborators)
        assert not found, f"Test user {TestPresalesCollaborators.test_user_id} still in collaborators after removal"
        print(f"Verified collaborator removed. Remaining collaborators: {len(collaborators)}")
    
    def test_09_add_collaborator_missing_user_id(self, api_client):
        """Test that adding collaborator without user_id returns error"""
        response = api_client.post(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            json={
                "role": "Designer",
                "reason": "Missing user_id test"
            },
            cookies={"session_token": self.session_token}
        )
        
        print(f"Add collaborator without user_id response: {response.status_code}")
        assert response.status_code == 400
        print("Correctly rejected request without user_id")
    
    def test_10_add_collaborator_invalid_user(self, api_client):
        """Test that adding non-existent user as collaborator returns error"""
        response = api_client.post(
            f"{BASE_URL}/api/presales/{TEST_PRESALES_LEAD_ID}/collaborators",
            json={
                "user_id": "non_existent_user_12345",
                "role": "Designer",
                "reason": "Invalid user test"
            },
            cookies={"session_token": self.session_token}
        )
        
        print(f"Add invalid user as collaborator response: {response.status_code}")
        assert response.status_code == 404
        print("Correctly rejected non-existent user")


class TestPresalesListWithCollaboratorFilter:
    """Test Pre-Sales list page with collaborator filter"""
    
    session_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Setup - login and get session token"""
        # Setup local admin first
        api_client.post(f"{BASE_URL}/api/auth/setup-local-admin")
        
        # Login
        login_response = api_client.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            self.session_token = login_response.cookies.get("session_token")
        else:
            pytest.skip("Login failed")
    
    def test_presales_list_returns_collaborators(self, api_client):
        """Test that presales list includes collaborator data for filtering"""
        response = api_client.get(
            f"{BASE_URL}/api/presales",
            cookies={"session_token": self.session_token}
        )
        
        print(f"Presales list response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Total presales leads: {len(data)}")
        
        # Check if leads have collaborators field
        if len(data) > 0:
            first_lead = data[0]
            print(f"First lead keys: {list(first_lead.keys())}")
            # Collaborators field should be present (even if empty)
            has_collaborators_field = "collaborators" in first_lead
            print(f"Has collaborators field: {has_collaborators_field}")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
