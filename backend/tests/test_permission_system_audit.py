"""
Permission System Audit Tests
Tests for the permission system fixes:
1. Founder login returns 209 permissions and is_founder=True
2. Admin login returns 209 permissions after auto-repair
3. Founder can update any user's permissions
4. Admin can update non-admin user permissions
5. Admin CANNOT remove Founder's permissions
6. Admin CANNOT modify another Admin's permissions
7. Admin CANNOT reset Founder permissions
8. Admin CANNOT reset another Admin's permissions
9. Founder CAN modify Admin permissions
10. Founder CAN reset Admin permissions
11. Permission auto-repair: Admin with reduced permissions gets full permissions on login
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
SYSTEM_ADMIN_EMAIL = "system.admin@arkiflo.com"
SYSTEM_ADMIN_PASSWORD = "Arkiflo@2024!"

# Test user IDs
DESIGNER_TEST_USER_ID = "designer_test_1771519655307"
FOUNDER_USER_ID = "user_56b6020c857d"
ADMIN_USER_ID = "test-user-1768140463239"
SYSTEM_ADMIN_USER_ID = "user_system_admin_001"

# Expected permission count
EXPECTED_PERMISSION_COUNT = 209


class TestFounderLogin:
    """Test Founder login returns correct permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create session"""
        self.session = requests.Session()
        
    def test_founder_login_returns_200(self):
        """Founder login should return 200"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        assert response.status_code == 200, f"Founder login failed: {response.text}"
        
    def test_founder_login_returns_correct_permission_count(self):
        """Founder login should return 209 permissions"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check permissions_count in login response
        permissions_count = data["user"].get("permissions_count", 0)
        print(f"Founder permissions_count: {permissions_count}")
        assert permissions_count >= EXPECTED_PERMISSION_COUNT, \
            f"Founder should have at least {EXPECTED_PERMISSION_COUNT} permissions, got {permissions_count}"
            
    def test_founder_login_returns_founder_role(self):
        """Founder login should return role=Founder"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["user"]["role"] == "Founder", f"Expected role=Founder, got {data['user']['role']}"
        
    def test_founder_auth_me_returns_is_founder_true(self):
        """GET /api/auth/me should return is_founder=True for Founder"""
        # Login first
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        assert login_response.status_code == 200
        
        # Check /api/auth/me
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        
        # Check is_founder flag
        is_founder = data.get("is_founder", False)
        print(f"Founder is_founder flag: {is_founder}")
        assert is_founder == True, f"Expected is_founder=True, got {is_founder}"


class TestAdminLogin:
    """Test Admin login returns correct permissions after auto-repair"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create session"""
        self.session = requests.Session()
        
    def test_admin_login_returns_200(self):
        """Admin login should return 200"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
    def test_admin_login_returns_correct_permission_count(self):
        """Admin login should return 209 permissions after auto-repair"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check permissions_count in login response
        permissions_count = data["user"].get("permissions_count", 0)
        print(f"Admin permissions_count: {permissions_count}")
        assert permissions_count >= EXPECTED_PERMISSION_COUNT, \
            f"Admin should have at least {EXPECTED_PERMISSION_COUNT} permissions, got {permissions_count}"
            
    def test_admin_login_returns_admin_role(self):
        """Admin login should return role=Admin"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["user"]["role"] == "Admin", f"Expected role=Admin, got {data['user']['role']}"


class TestFounderPermissionUpdates:
    """Test Founder can update any user's permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as Founder"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Founder login failed: {login_response.text}"
        self.founder_user = login_response.json()["user"]
        
    def test_founder_can_view_any_user_permissions(self):
        """Founder can view any user's permissions"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/users")
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Find a Designer user
        designer = next((u for u in users if u["role"] == "Designer"), None)
        if designer:
            response = self.session.get(f"{BASE_URL}/api/users/{designer['user_id']}/permissions")
            assert response.status_code == 200, f"Founder should be able to view Designer permissions"
            
    def test_founder_can_update_designer_permissions(self):
        """Founder can update Designer's permissions"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/users")
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Find a Designer user
        designer = next((u for u in users if u["role"] == "Designer"), None)
        if designer:
            # Get current permissions
            current_perms_response = self.session.get(f"{BASE_URL}/api/users/{designer['user_id']}/permissions")
            current_perms = current_perms_response.json().get("permissions", [])
            
            # Add a new permission
            new_perms = list(set(current_perms + ["finance.cashbook.view"]))
            
            response = self.session.put(
                f"{BASE_URL}/api/users/{designer['user_id']}/permissions",
                json={"permissions": new_perms, "custom_permissions": True}
            )
            assert response.status_code == 200, f"Founder should be able to update Designer permissions: {response.text}"
            
    def test_founder_can_modify_admin_permissions(self):
        """Founder CAN modify Admin permissions"""
        # Get Admin user permissions
        response = self.session.get(f"{BASE_URL}/api/users/{ADMIN_USER_ID}/permissions")
        if response.status_code == 200:
            current_perms = response.json().get("permissions", [])
            
            # Try to update Admin permissions (add a permission)
            new_perms = list(set(current_perms + ["finance.founder_dashboard"]))
            
            update_response = self.session.put(
                f"{BASE_URL}/api/users/{ADMIN_USER_ID}/permissions",
                json={"permissions": new_perms, "custom_permissions": True}
            )
            assert update_response.status_code == 200, \
                f"Founder should be able to modify Admin permissions: {update_response.text}"
                
    def test_founder_can_reset_admin_permissions(self):
        """Founder CAN reset Admin permissions"""
        response = self.session.post(f"{BASE_URL}/api/users/{ADMIN_USER_ID}/permissions/reset-to-role")
        # Founder should be able to reset Admin permissions
        assert response.status_code == 200, \
            f"Founder should be able to reset Admin permissions: {response.text}"


class TestAdminPermissionRestrictions:
    """Test Admin permission restrictions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as Admin"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        self.admin_user = login_response.json()["user"]
        
    def test_admin_can_update_non_admin_user_permissions(self):
        """Admin can update non-admin user permissions"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/users")
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Find a Designer user
        designer = next((u for u in users if u["role"] == "Designer"), None)
        if designer:
            # Get current permissions
            current_perms_response = self.session.get(f"{BASE_URL}/api/users/{designer['user_id']}/permissions")
            current_perms = current_perms_response.json().get("permissions", [])
            
            # Add a new permission
            new_perms = list(set(current_perms + ["leads.view"]))
            
            response = self.session.put(
                f"{BASE_URL}/api/users/{designer['user_id']}/permissions",
                json={"permissions": new_perms, "custom_permissions": True}
            )
            assert response.status_code == 200, \
                f"Admin should be able to update Designer permissions: {response.text}"
                
    def test_admin_cannot_remove_founder_permissions(self):
        """Admin CANNOT remove Founder's permissions"""
        # Get Founder user permissions
        response = self.session.get(f"{BASE_URL}/api/users/{FOUNDER_USER_ID}/permissions")
        if response.status_code == 200:
            current_perms = response.json().get("permissions", [])
            
            # Try to remove a permission from Founder
            if len(current_perms) > 1:
                reduced_perms = current_perms[:-1]  # Remove last permission
                
                update_response = self.session.put(
                    f"{BASE_URL}/api/users/{FOUNDER_USER_ID}/permissions",
                    json={"permissions": reduced_perms, "custom_permissions": True}
                )
                # Should be rejected with 403
                assert update_response.status_code == 403, \
                    f"Admin should NOT be able to remove Founder permissions. Got status {update_response.status_code}: {update_response.text}"
                    
    def test_admin_cannot_modify_another_admin_permissions(self):
        """Admin CANNOT modify another Admin's permissions"""
        # Get System Admin user permissions (another Admin)
        response = self.session.get(f"{BASE_URL}/api/users/{SYSTEM_ADMIN_USER_ID}/permissions")
        if response.status_code == 200:
            current_perms = response.json().get("permissions", [])
            
            # Try to update another Admin's permissions
            new_perms = list(set(current_perms + ["finance.founder_dashboard"]))
            
            update_response = self.session.put(
                f"{BASE_URL}/api/users/{SYSTEM_ADMIN_USER_ID}/permissions",
                json={"permissions": new_perms, "custom_permissions": True}
            )
            # Should be rejected with 403
            assert update_response.status_code == 403, \
                f"Admin should NOT be able to modify another Admin's permissions. Got status {update_response.status_code}: {update_response.text}"
                
    def test_admin_cannot_reset_founder_permissions(self):
        """Admin CANNOT reset Founder permissions"""
        response = self.session.post(f"{BASE_URL}/api/users/{FOUNDER_USER_ID}/permissions/reset-to-role")
        # Should be rejected with 403
        assert response.status_code == 403, \
            f"Admin should NOT be able to reset Founder permissions. Got status {response.status_code}: {response.text}"
            
    def test_admin_cannot_reset_another_admin_permissions(self):
        """Admin CANNOT reset another Admin's permissions"""
        response = self.session.post(f"{BASE_URL}/api/users/{SYSTEM_ADMIN_USER_ID}/permissions/reset-to-role")
        # Should be rejected with 403
        assert response.status_code == 403, \
            f"Admin should NOT be able to reset another Admin's permissions. Got status {response.status_code}: {response.text}"


class TestPermissionAutoRepair:
    """Test permission auto-repair on login"""
    
    def test_admin_with_reduced_permissions_gets_full_on_login(self):
        """Admin with reduced permissions gets full permissions on login"""
        session = requests.Session()
        
        # Login as Admin
        login_response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        data = login_response.json()
        
        # After login, Admin should have full permissions (auto-repair)
        permissions_count = data["user"].get("permissions_count", 0)
        print(f"Admin permissions after login: {permissions_count}")
        
        # Verify via /api/auth/me
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        
        actual_perms = len(me_data.get("permissions", []))
        print(f"Admin actual permissions from /api/auth/me: {actual_perms}")
        
        assert actual_perms >= EXPECTED_PERMISSION_COUNT, \
            f"Admin should have at least {EXPECTED_PERMISSION_COUNT} permissions after auto-repair, got {actual_perms}"


class TestSystemAdminLogin:
    """Test System Admin login"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - create session"""
        self.session = requests.Session()
        
    def test_system_admin_login_returns_200(self):
        """System Admin login should return 200"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": SYSTEM_ADMIN_EMAIL, "password": SYSTEM_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"System Admin login failed: {response.text}"
        
    def test_system_admin_has_admin_role(self):
        """System Admin should have Admin role"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": SYSTEM_ADMIN_EMAIL, "password": SYSTEM_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["user"]["role"] == "Admin", f"Expected role=Admin, got {data['user']['role']}"


class TestPermissionBypassLogic:
    """Test has_permission bypass logic for Founder and Admin"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as Founder"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        assert login_response.status_code == 200
        
    def test_founder_can_access_admin_only_endpoints(self):
        """Founder can access admin-only endpoints"""
        # Try to access admin endpoints
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code == 200, \
            f"Founder should have access to admin endpoints: {response.text}"
            
    def test_founder_can_access_finance_endpoints(self):
        """Founder can access finance endpoints"""
        response = self.session.get(f"{BASE_URL}/api/finance/accounts")
        assert response.status_code == 200, \
            f"Founder should have access to finance endpoints: {response.text}"
            
    def test_founder_can_access_founder_dashboard(self):
        """Founder can access founder dashboard"""
        response = self.session.get(f"{BASE_URL}/api/founder/dashboard")
        assert response.status_code == 200, \
            f"Founder should have access to founder dashboard: {response.text}"


class TestAdminBypassLogic:
    """Test has_permission bypass logic for Admin"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as Admin"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        
    def test_admin_can_access_admin_endpoints(self):
        """Admin can access admin endpoints"""
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code == 200, \
            f"Admin should have access to admin endpoints: {response.text}"
            
    def test_admin_can_access_finance_endpoints(self):
        """Admin can access finance endpoints"""
        response = self.session.get(f"{BASE_URL}/api/finance/accounts")
        assert response.status_code == 200, \
            f"Admin should have access to finance endpoints: {response.text}"
            
    def test_admin_can_manage_users(self):
        """Admin can manage users"""
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200, \
            f"Admin should have access to users endpoint: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
