"""
Role Management API Tests
Tests for /api/roles endpoints - CRUD operations for custom roles
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_exec_discount_1769888944948"

class TestRoleManagementAPI:
    """Role Management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={SESSION_TOKEN}"
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    # ============ GET /api/roles ============
    def test_get_all_roles(self):
        """Test GET /api/roles returns list of roles"""
        response = self.session.get(f"{BASE_URL}/api/roles")
        assert response.status_code == 200
        
        data = response.json()
        assert "roles" in data
        assert "total" in data
        assert "builtin_count" in data
        assert isinstance(data["roles"], list)
        assert len(data["roles"]) > 0
        
        # Verify built-in roles are present
        role_ids = [r["id"] for r in data["roles"]]
        assert "Admin" in role_ids
        assert "Designer" in role_ids
    
    def test_roles_have_required_fields(self):
        """Test each role has required fields"""
        response = self.session.get(f"{BASE_URL}/api/roles")
        assert response.status_code == 200
        
        data = response.json()
        for role in data["roles"]:
            assert "id" in role
            assert "name" in role
            assert "is_builtin" in role
            assert "default_permissions" in role
            assert "permission_count" in role
            assert "user_count" in role
            assert isinstance(role["permission_count"], int)
            assert isinstance(role["user_count"], int)
    
    # ============ GET /api/roles/{role_id} ============
    def test_get_specific_role_builtin(self):
        """Test GET /api/roles/{role_id} for built-in role"""
        response = self.session.get(f"{BASE_URL}/api/roles/Admin")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == "Admin"
        assert data["is_builtin"] == True
        assert "default_permissions" in data
        assert len(data["default_permissions"]) > 0
    
    def test_get_nonexistent_role(self):
        """Test GET /api/roles/{role_id} for non-existent role returns 404"""
        response = self.session.get(f"{BASE_URL}/api/roles/NonExistentRole123")
        assert response.status_code == 404
    
    # ============ POST /api/roles ============
    def test_create_custom_role(self):
        """Test POST /api/roles creates new custom role"""
        unique_id = f"TestRole_{int(time.time())}"
        payload = {
            "id": unique_id,
            "name": f"Test Role {unique_id}",
            "description": "Test role for pytest",
            "default_permissions": ["presales.view", "leads.view"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/roles", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "role" in data
        assert data["role"]["id"] == unique_id
        assert data["role"]["name"] == payload["name"]
        assert data["role"]["is_builtin"] == False
        assert data["role"]["default_permissions"] == payload["default_permissions"]
        
        # Cleanup - delete the test role
        self.session.delete(f"{BASE_URL}/api/roles/{unique_id}")
    
    def test_create_role_duplicate_id(self):
        """Test POST /api/roles with duplicate ID returns error"""
        unique_id = f"DuplicateTest_{int(time.time())}"
        payload = {
            "id": unique_id,
            "name": "Duplicate Test",
            "description": "Test",
            "default_permissions": ["presales.view"]
        }
        
        # Create first role
        response1 = self.session.post(f"{BASE_URL}/api/roles", json=payload)
        assert response1.status_code == 200
        
        # Try to create duplicate
        response2 = self.session.post(f"{BASE_URL}/api/roles", json=payload)
        assert response2.status_code == 400
        assert "already exists" in response2.json().get("detail", "")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/roles/{unique_id}")
    
    def test_create_role_builtin_id(self):
        """Test POST /api/roles with built-in role ID returns error"""
        payload = {
            "id": "Admin",
            "name": "Fake Admin",
            "description": "Test",
            "default_permissions": ["presales.view"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/roles", json=payload)
        assert response.status_code == 400
        assert "built-in role" in response.json().get("detail", "")
    
    def test_create_role_invalid_permissions(self):
        """Test POST /api/roles with invalid permissions returns error"""
        unique_id = f"InvalidPermTest_{int(time.time())}"
        payload = {
            "id": unique_id,
            "name": "Invalid Perm Test",
            "description": "Test",
            "default_permissions": ["invalid.permission.xyz"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/roles", json=payload)
        assert response.status_code == 400
        assert "Invalid permissions" in response.json().get("detail", "")
    
    # ============ PUT /api/roles/{role_id} ============
    def test_update_custom_role(self):
        """Test PUT /api/roles/{role_id} updates custom role"""
        unique_id = f"UpdateTest_{int(time.time())}"
        
        # Create role first
        create_payload = {
            "id": unique_id,
            "name": "Update Test Original",
            "description": "Original description",
            "default_permissions": ["presales.view"]
        }
        self.session.post(f"{BASE_URL}/api/roles", json=create_payload)
        
        # Update the role
        update_payload = {
            "name": "Update Test Modified",
            "description": "Modified description",
            "default_permissions": ["presales.view", "leads.view", "projects.view"]
        }
        response = self.session.put(f"{BASE_URL}/api/roles/{unique_id}", json=update_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["role"]["name"] == "Update Test Modified"
        assert data["role"]["description"] == "Modified description"
        assert len(data["role"]["default_permissions"]) == 3
        
        # Verify with GET
        get_response = self.session.get(f"{BASE_URL}/api/roles/{unique_id}")
        assert get_response.status_code == 200
        assert get_response.json()["name"] == "Update Test Modified"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/roles/{unique_id}")
    
    def test_update_builtin_role_creates_override(self):
        """Test PUT /api/roles/{role_id} on built-in role creates custom override"""
        # Update Designer role
        update_payload = {
            "default_permissions": ["presales.view", "leads.view"]
        }
        response = self.session.put(f"{BASE_URL}/api/roles/Designer", json=update_payload)
        assert response.status_code == 200
        
        # Verify the role now has custom permissions
        get_response = self.session.get(f"{BASE_URL}/api/roles")
        roles = get_response.json()["roles"]
        designer = next((r for r in roles if r["id"] == "Designer"), None)
        assert designer is not None
        
        # Reset to defaults
        self.session.post(f"{BASE_URL}/api/roles/Designer/reset")
    
    # ============ DELETE /api/roles/{role_id} ============
    def test_delete_custom_role(self):
        """Test DELETE /api/roles/{role_id} deletes custom role"""
        unique_id = f"DeleteTest_{int(time.time())}"
        
        # Create role first
        create_payload = {
            "id": unique_id,
            "name": "Delete Test",
            "description": "To be deleted",
            "default_permissions": ["presales.view"]
        }
        self.session.post(f"{BASE_URL}/api/roles", json=create_payload)
        
        # Delete the role
        response = self.session.delete(f"{BASE_URL}/api/roles/{unique_id}")
        assert response.status_code == 200
        assert "deleted successfully" in response.json().get("message", "")
        
        # Verify it's gone
        get_response = self.session.get(f"{BASE_URL}/api/roles/{unique_id}")
        assert get_response.status_code == 404
    
    def test_delete_builtin_role_fails(self):
        """Test DELETE /api/roles/{role_id} on built-in role without override fails"""
        response = self.session.delete(f"{BASE_URL}/api/roles/Admin")
        assert response.status_code == 400
        assert "Cannot delete built-in role" in response.json().get("detail", "")
    
    # ============ POST /api/roles/{role_id}/reset ============
    def test_reset_builtin_role(self):
        """Test POST /api/roles/{role_id}/reset resets built-in role to defaults"""
        response = self.session.post(f"{BASE_URL}/api/roles/Designer/reset")
        assert response.status_code == 200
        
        data = response.json()
        assert "reset to default permissions" in data.get("message", "")
        assert "default_permissions" in data
    
    def test_reset_nonbuiltin_role_fails(self):
        """Test POST /api/roles/{role_id}/reset on non-built-in role fails"""
        response = self.session.post(f"{BASE_URL}/api/roles/NonExistentRole/reset")
        assert response.status_code == 400
        assert "not a built-in role" in response.json().get("detail", "")
    
    # ============ GET /api/permissions/available ============
    def test_get_available_permissions(self):
        """Test GET /api/permissions/available returns permission groups"""
        response = self.session.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code == 200
        
        data = response.json()
        assert "permission_groups" in data
        assert isinstance(data["permission_groups"], dict)
        
        # Verify some expected groups exist
        groups = data["permission_groups"]
        assert "presales" in groups
        assert "leads" in groups
        assert "admin" in groups
        
        # Verify group structure
        for group_key, group in groups.items():
            assert "name" in group
            assert "permissions" in group
            assert isinstance(group["permissions"], list)
            for perm in group["permissions"]:
                assert "id" in perm
                assert "name" in perm
                assert "description" in perm


class TestRoleManagementEdgeCases:
    """Edge case tests for Role Management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={SESSION_TOKEN}"
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def test_create_role_empty_permissions(self):
        """Test creating role with empty permissions list"""
        unique_id = f"EmptyPermTest_{int(time.time())}"
        payload = {
            "id": unique_id,
            "name": "Empty Perm Test",
            "description": "Role with no permissions",
            "default_permissions": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/roles", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["role"]["default_permissions"] == []
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/roles/{unique_id}")
    
    def test_update_role_partial_data(self):
        """Test updating role with partial data (only name)"""
        unique_id = f"PartialUpdate_{int(time.time())}"
        
        # Create role
        create_payload = {
            "id": unique_id,
            "name": "Partial Update Test",
            "description": "Original",
            "default_permissions": ["presales.view"]
        }
        self.session.post(f"{BASE_URL}/api/roles", json=create_payload)
        
        # Update only name
        update_payload = {"name": "New Name Only"}
        response = self.session.put(f"{BASE_URL}/api/roles/{unique_id}", json=update_payload)
        assert response.status_code == 200
        
        # Verify permissions unchanged
        get_response = self.session.get(f"{BASE_URL}/api/roles/{unique_id}")
        data = get_response.json()
        assert data["name"] == "New Name Only"
        assert "presales.view" in data["default_permissions"]
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/roles/{unique_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
