"""
Spatial BOQ Canvas API Tests
Tests for 2D Modular Layout Canvas feature:
- GET /api/spatial/module-library - Module types, finish types, shutter types
- POST /api/projects/{project_id}/spatial-layout - Create layout with walls and modules
- PUT /api/projects/{project_id}/spatial-layout/{layout_id} - Update layout
- GET /api/projects/{project_id}/spatial-layout - List all layouts for project
- POST /api/projects/{project_id}/spatial-layout/{layout_id}/generate-boq - Generate modular BOQ items
- GET /api/projects/{project_id}/modular-boq - Return generated BOQ items
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "sidheeq.arkidots@gmail.com"
TEST_PASSWORD = "founder123"

# Test project ID from context
TEST_PROJECT_ID = "proj_4aaba062"

# Session for authenticated requests
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})


class TestSpatialBOQSetup:
    """Setup tests - login and verify access"""
    
    @pytest.fixture(scope="class", autouse=True)
    def login(self):
        """Login and get session token"""
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Store cookies from response
        for cookie in response.cookies:
            session.cookies.set(cookie.name, cookie.value)
        
        print(f"✅ Logged in as {TEST_EMAIL}")
        yield
    
    def test_auth_me(self, login):
        """Verify authentication works"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth check failed: {response.text}"
        data = response.json()
        assert data.get("email") == TEST_EMAIL
        print(f"✅ Authenticated as {data.get('name')} ({data.get('role')})")


class TestModuleLibrary:
    """Tests for GET /api/spatial/module-library"""
    
    @pytest.fixture(scope="class", autouse=True)
    def login(self):
        """Login for this test class"""
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            for cookie in response.cookies:
                session.cookies.set(cookie.name, cookie.value)
        yield
    
    def test_get_module_library_returns_200(self, login):
        """GET /api/spatial/module-library should return 200"""
        response = session.get(f"{BASE_URL}/api/spatial/module-library")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ GET /api/spatial/module-library returns 200")
    
    def test_module_library_has_module_types(self, login):
        """Module library should contain module_types"""
        response = session.get(f"{BASE_URL}/api/spatial/module-library")
        data = response.json()
        assert "module_types" in data, "Response missing module_types"
        assert len(data["module_types"]) >= 10, f"Expected at least 10 module types, got {len(data['module_types'])}"
        print(f"✅ Module library has {len(data['module_types'])} module types")
    
    def test_module_library_has_finish_types(self, login):
        """Module library should contain finish_types"""
        response = session.get(f"{BASE_URL}/api/spatial/module-library")
        data = response.json()
        assert "finish_types" in data, "Response missing finish_types"
        assert len(data["finish_types"]) >= 6, f"Expected at least 6 finish types, got {len(data['finish_types'])}"
        
        # Verify expected finish types
        expected_finishes = ["laminate", "acrylic", "pu_paint", "veneer", "membrane", "glass"]
        for finish in expected_finishes:
            assert finish in data["finish_types"], f"Missing finish type: {finish}"
        print(f"✅ Module library has {len(data['finish_types'])} finish types")
    
    def test_module_library_has_shutter_types(self, login):
        """Module library should contain shutter_types"""
        response = session.get(f"{BASE_URL}/api/spatial/module-library")
        data = response.json()
        assert "shutter_types" in data, "Response missing shutter_types"
        assert len(data["shutter_types"]) >= 5, f"Expected at least 5 shutter types, got {len(data['shutter_types'])}"
        
        # Verify expected shutter types
        expected_shutters = ["flat", "profile", "glass", "handleless", "shaker"]
        for shutter in expected_shutters:
            assert shutter in data["shutter_types"], f"Missing shutter type: {shutter}"
        print(f"✅ Module library has {len(data['shutter_types'])} shutter types")
    
    def test_module_types_have_required_fields(self, login):
        """Each module type should have required fields"""
        response = session.get(f"{BASE_URL}/api/spatial/module-library")
        data = response.json()
        
        required_fields = ["name", "category", "default_width", "default_height", "default_depth", "unit"]
        for module_key, module_data in data["module_types"].items():
            for field in required_fields:
                assert field in module_data, f"Module {module_key} missing field: {field}"
        print("✅ All module types have required fields")
    
    def test_module_types_include_expected_modules(self, login):
        """Module library should include all expected module types"""
        response = session.get(f"{BASE_URL}/api/spatial/module-library")
        data = response.json()
        
        expected_modules = [
            "base_cabinet", "wall_cabinet", "tall_unit", "loft_unit",
            "appliance_hob", "appliance_chimney", "appliance_microwave",
            "appliance_oven", "appliance_dishwasher", "appliance_sink"
        ]
        for module in expected_modules:
            assert module in data["module_types"], f"Missing module type: {module}"
        print(f"✅ All {len(expected_modules)} expected module types present")


class TestSpatialLayoutCRUD:
    """Tests for Spatial Layout CRUD operations"""
    
    created_layout_id = None
    
    @pytest.fixture(scope="class", autouse=True)
    def login(self):
        """Login for this test class"""
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            for cookie in response.cookies:
                session.cookies.set(cookie.name, cookie.value)
        yield
    
    def test_create_spatial_layout(self, login):
        """POST /api/projects/{project_id}/spatial-layout should create layout"""
        payload = {
            "room_name": "Test Kitchen",
            "walls": [
                {
                    "start_x": 0,
                    "start_y": 0,
                    "end_x": 3000,
                    "end_y": 0,
                    "length": 3000,
                    "thickness": 150
                },
                {
                    "start_x": 3000,
                    "start_y": 0,
                    "end_x": 3000,
                    "end_y": 2500,
                    "length": 2500,
                    "thickness": 150
                }
            ],
            "modules": [
                {
                    "module_type": "base_cabinet",
                    "x": 100,
                    "y": 100,
                    "width": 600,
                    "height": 850,
                    "depth": 550,
                    "rotation": 0,
                    "finish_type": "laminate",
                    "shutter_type": "flat"
                }
            ],
            "canvas_width": 5000,
            "canvas_height": 4000,
            "scale": 0.15
        }
        
        response = session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "layout_id" in data, "Response missing layout_id"
        assert data["room_name"] == "Test Kitchen"
        assert len(data["walls"]) == 2
        assert len(data["modules"]) == 1
        
        # Store for later tests
        TestSpatialLayoutCRUD.created_layout_id = data["layout_id"]
        print(f"✅ Created spatial layout: {data['layout_id']}")
    
    def test_get_spatial_layouts_list(self, login):
        """GET /api/projects/{project_id}/spatial-layout should list layouts"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "layouts" in data, "Response missing layouts"
        assert "count" in data, "Response missing count"
        assert data["count"] >= 1, "Expected at least 1 layout"
        print(f"✅ GET layouts returns {data['count']} layouts")
    
    def test_get_spatial_layouts_with_room_filter(self, login):
        """GET /api/projects/{project_id}/spatial-layout?room_name=Kitchen should filter"""
        response = session.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout",
            params={"room_name": "Test Kitchen"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        for layout in data.get("layouts", []):
            assert layout["room_name"] == "Test Kitchen", f"Filter not working: got {layout['room_name']}"
        print("✅ Room name filter works correctly")
    
    def test_get_spatial_layout_detail(self, login):
        """GET /api/projects/{project_id}/spatial-layout/{layout_id} should return detail"""
        if not TestSpatialLayoutCRUD.created_layout_id:
            pytest.skip("No layout created")
        
        response = session.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout/{TestSpatialLayoutCRUD.created_layout_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["layout_id"] == TestSpatialLayoutCRUD.created_layout_id
        assert "summary" in data, "Response missing summary"
        assert "walls" in data, "Response missing walls"
        assert "modules" in data, "Response missing modules"
        print(f"✅ GET layout detail returns full data with summary")
    
    def test_update_spatial_layout(self, login):
        """PUT /api/projects/{project_id}/spatial-layout/{layout_id} should update"""
        if not TestSpatialLayoutCRUD.created_layout_id:
            pytest.skip("No layout created")
        
        payload = {
            "room_name": "Updated Kitchen",
            "walls": [
                {
                    "start_x": 0,
                    "start_y": 0,
                    "end_x": 4000,
                    "end_y": 0,
                    "length": 4000,
                    "thickness": 150
                }
            ],
            "modules": [
                {
                    "module_type": "base_cabinet",
                    "x": 100,
                    "y": 100,
                    "width": 800,
                    "height": 850,
                    "depth": 550,
                    "rotation": 0,
                    "finish_type": "acrylic",
                    "shutter_type": "handleless"
                },
                {
                    "module_type": "wall_cabinet",
                    "x": 100,
                    "y": 200,
                    "width": 600,
                    "height": 720,
                    "depth": 350,
                    "rotation": 0,
                    "finish_type": "laminate",
                    "shutter_type": "flat"
                }
            ],
            "canvas_width": 5000,
            "canvas_height": 4000,
            "scale": 0.15
        }
        
        response = session.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout/{TestSpatialLayoutCRUD.created_layout_id}",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["room_name"] == "Updated Kitchen"
        assert len(data["walls"]) == 1
        assert len(data["modules"]) == 2
        print("✅ PUT layout update works correctly")
    
    def test_layout_summary_calculations(self, login):
        """Layout summary should have correct calculations"""
        if not TestSpatialLayoutCRUD.created_layout_id:
            pytest.skip("No layout created")
        
        response = session.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout/{TestSpatialLayoutCRUD.created_layout_id}"
        )
        data = response.json()
        summary = data.get("summary", {})
        
        # Verify summary fields
        assert "total_wall_length_mm" in summary, "Missing total_wall_length_mm"
        assert "module_count" in summary, "Missing module_count"
        assert "total_material_sqft" in summary, "Missing total_material_sqft"
        assert "total_estimated_cost" in summary, "Missing total_estimated_cost"
        
        # Verify calculations
        assert summary["total_wall_length_mm"] == 4000, f"Expected 4000mm wall length, got {summary['total_wall_length_mm']}"
        assert summary["module_count"] == 2, f"Expected 2 modules, got {summary['module_count']}"
        assert summary["total_estimated_cost"] > 0, "Estimated cost should be > 0"
        
        print(f"✅ Summary calculations correct: {summary['module_count']} modules, {summary['total_wall_length_mm']}mm walls, ₹{summary['total_estimated_cost']}")


class TestBOQGeneration:
    """Tests for BOQ generation from spatial layout"""
    
    @pytest.fixture(scope="class", autouse=True)
    def login(self):
        """Login for this test class"""
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            for cookie in response.cookies:
                session.cookies.set(cookie.name, cookie.value)
        yield
    
    def test_generate_boq_from_layout(self, login):
        """POST /api/projects/{project_id}/spatial-layout/{layout_id}/generate-boq should generate BOQ"""
        if not TestSpatialLayoutCRUD.created_layout_id:
            pytest.skip("No layout created")
        
        response = session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout/{TestSpatialLayoutCRUD.created_layout_id}/generate-boq"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success: true"
        assert "modular_boq_id" in data, "Response missing modular_boq_id"
        assert "item_count" in data, "Response missing item_count"
        assert "total_estimated_cost" in data, "Response missing total_estimated_cost"
        assert "items" in data, "Response missing items"
        
        # Verify items have required fields
        for item in data["items"]:
            assert "item_id" in item
            assert "name" in item
            assert "width" in item
            assert "height" in item
            assert "depth" in item
            assert "unit_price" in item
            assert "total_price" in item
        
        print(f"✅ Generated BOQ with {data['item_count']} items, total ₹{data['total_estimated_cost']}")
    
    def test_get_modular_boqs(self, login):
        """GET /api/projects/{project_id}/modular-boq should return generated BOQs"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/modular-boq")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "modular_boqs" in data, "Response missing modular_boqs"
        assert "count" in data, "Response missing count"
        assert "total_estimated_cost" in data, "Response missing total_estimated_cost"
        
        print(f"✅ GET modular-boq returns {data['count']} BOQs, total ₹{data['total_estimated_cost']}")


class TestEdgeCases:
    """Edge case and error handling tests"""
    
    @pytest.fixture(scope="class", autouse=True)
    def login(self):
        """Login for this test class"""
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            for cookie in response.cookies:
                session.cookies.set(cookie.name, cookie.value)
        yield
    
    def test_invalid_project_returns_404(self, login):
        """GET /api/projects/invalid_project/spatial-layout should return 404"""
        response = session.get(f"{BASE_URL}/api/projects/invalid_project_xyz/spatial-layout")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Invalid project returns 404")
    
    def test_invalid_layout_returns_404(self, login):
        """GET /api/projects/{project_id}/spatial-layout/invalid_layout should return 404"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout/invalid_layout_xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Invalid layout returns 404")
    
    def test_generate_boq_invalid_layout_returns_404(self, login):
        """POST generate-boq with invalid layout should return 404"""
        response = session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout/invalid_layout_xyz/generate-boq"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Generate BOQ with invalid layout returns 404")
    
    def test_create_layout_empty_walls_modules(self, login):
        """Create layout with empty walls and modules should work"""
        payload = {
            "room_name": "Empty Room",
            "walls": [],
            "modules": [],
            "canvas_width": 5000,
            "canvas_height": 4000,
            "scale": 0.15
        }
        
        response = session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/spatial-layout",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert len(data["walls"]) == 0
        assert len(data["modules"]) == 0
        print("✅ Empty layout creation works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
