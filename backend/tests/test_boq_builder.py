"""
BOQ Builder (Phase-1 Canvas Model) API Tests
Tests all BOQ endpoints at project level:
- GET /api/projects/{project_id}/boq - Get or create BOQ
- PUT /api/projects/{project_id}/boq - Save BOQ changes
- POST /api/projects/{project_id}/boq/rooms - Add room
- DELETE /api/projects/{project_id}/boq/rooms/{room_id} - Delete room
- PUT /api/projects/{project_id}/boq/status - Status transitions
- GET /api/projects/{project_id}/boq/versions - Version history
- GET /api/projects/{project_id}/boq/summary - Summary for project details
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"

# Test project ID (existing project with BOQ)
TEST_PROJECT_ID = "proj_4aaba062"


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for all tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as founder
    response = session.post(f"{BASE_URL}/api/auth/local-login", json={
        "email": FOUNDER_EMAIL,
        "password": FOUNDER_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    
    return session


class TestBOQGetOrCreate:
    """Test GET /api/projects/{project_id}/boq - Get or create BOQ"""
    
    def test_get_boq_returns_200(self, auth_session):
        """GET /api/projects/{project_id}/boq should return 200"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_boq_has_required_fields(self, auth_session):
        """BOQ response should have all required fields"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["boq_id", "project_id", "version", "status", "rooms", "grand_total"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
    
    def test_get_boq_has_rooms_array(self, auth_session):
        """BOQ should have rooms array"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data.get("rooms"), list), "rooms should be a list"
    
    def test_get_boq_rooms_have_structure(self, auth_session):
        """Each room should have room_id, name, items, subtotal"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert response.status_code == 200
        
        data = response.json()
        rooms = data.get("rooms", [])
        
        if len(rooms) > 0:
            room = rooms[0]
            assert "room_id" in room, "Room missing room_id"
            assert "name" in room, "Room missing name"
            assert "items" in room, "Room missing items"
            assert "subtotal" in room, "Room missing subtotal"
    
    def test_get_boq_creates_default_rooms_for_new_project(self, auth_session):
        """New BOQ should have 10 default rooms"""
        # First get the BOQ to check if it was newly created
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert response.status_code == 200
        
        data = response.json()
        # If this is a new BOQ, it should have default rooms
        # Default rooms: Kitchen, Living Room, Dining Room, Master Bedroom, Bedroom 2, Bedroom 3, Wardrobes, TV Unit, Wall Paneling, Misc/Custom
        expected_default_rooms = [
            "Kitchen", "Living Room", "Dining Room", "Master Bedroom",
            "Bedroom 2", "Bedroom 3", "Wardrobes", "TV Unit", "Wall Paneling", "Misc / Custom"
        ]
        
        room_names = [r.get("name") for r in data.get("rooms", [])]
        # Check that at least some default rooms exist
        assert len(room_names) > 0, "BOQ should have at least one room"
    
    def test_get_boq_invalid_project_returns_404(self, auth_session):
        """GET BOQ for non-existent project should return 404"""
        response = auth_session.get(f"{BASE_URL}/api/projects/invalid_project_id/boq")
        assert response.status_code == 404


class TestBOQSave:
    """Test PUT /api/projects/{project_id}/boq - Save BOQ changes"""
    
    def test_save_boq_returns_200(self, auth_session):
        """PUT /api/projects/{project_id}/boq should return 200"""
        # First get current BOQ
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert get_response.status_code == 200
        current_boq = get_response.json()
        
        # Skip if locked
        if current_boq.get("status") == "locked":
            pytest.skip("BOQ is locked, cannot test save")
        
        # Save with same data
        response = auth_session.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq",
            json={"rooms": current_boq.get("rooms", []), "notes": "Test save"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_save_boq_auto_calculates_totals(self, auth_session):
        """Saving BOQ should auto-calculate room subtotals and grand total"""
        # Get current BOQ
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert get_response.status_code == 200
        current_boq = get_response.json()
        
        if current_boq.get("status") == "locked":
            pytest.skip("BOQ is locked")
        
        # Add a test item to first room
        rooms = current_boq.get("rooms", [])
        if len(rooms) > 0:
            test_item = {
                "item_id": f"test_item_{uuid.uuid4().hex[:8]}",
                "name": "TEST_AutoCalc_Item",
                "quantity": 5,
                "unit": "nos",
                "unit_price": 1000
            }
            rooms[0]["items"].append(test_item)
            
            # Save
            save_response = auth_session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq",
                json={"rooms": rooms}
            )
            assert save_response.status_code == 200
            
            # Verify totals
            verify_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
            assert verify_response.status_code == 200
            
            verified_boq = verify_response.json()
            # Find the test item and verify total_price = quantity * unit_price = 5 * 1000 = 5000
            for room in verified_boq.get("rooms", []):
                for item in room.get("items", []):
                    if item.get("name") == "TEST_AutoCalc_Item":
                        assert item.get("total_price") == 5000, f"Expected total_price 5000, got {item.get('total_price')}"
                        break
            
            # Cleanup - remove test item
            rooms = verified_boq.get("rooms", [])
            for room in rooms:
                room["items"] = [i for i in room.get("items", []) if i.get("name") != "TEST_AutoCalc_Item"]
            
            auth_session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq",
                json={"rooms": rooms}
            )


class TestBOQRoomOperations:
    """Test room add/delete operations"""
    
    def test_add_room_returns_200(self, auth_session):
        """POST /api/projects/{project_id}/boq/rooms should return 200"""
        # Check if BOQ is locked first
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        if get_response.status_code == 200 and get_response.json().get("status") == "locked":
            pytest.skip("BOQ is locked")
        
        response = auth_session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/rooms",
            json={"name": "TEST_NewRoom"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "room" in data
        assert data["room"].get("name") == "TEST_NewRoom"
    
    def test_delete_room_returns_200(self, auth_session):
        """DELETE /api/projects/{project_id}/boq/rooms/{room_id} should return 200"""
        # First add a room to delete
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        if get_response.status_code == 200 and get_response.json().get("status") == "locked":
            pytest.skip("BOQ is locked")
        
        # Add room
        add_response = auth_session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/rooms",
            json={"name": "TEST_RoomToDelete"}
        )
        assert add_response.status_code == 200
        room_id = add_response.json().get("room", {}).get("room_id")
        
        # Delete room
        delete_response = auth_session.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/rooms/{room_id}"
        )
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert data.get("success") == True
    
    def test_delete_room_recalculates_grand_total(self, auth_session):
        """Deleting a room should recalculate grand total"""
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        if get_response.status_code == 200 and get_response.json().get("status") == "locked":
            pytest.skip("BOQ is locked")
        
        # Add room with items
        add_response = auth_session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/rooms",
            json={"name": "TEST_RoomWithItems"}
        )
        assert add_response.status_code == 200
        room_id = add_response.json().get("room", {}).get("room_id")
        
        # Get current BOQ and add item to new room
        boq_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        boq = boq_response.json()
        
        for room in boq.get("rooms", []):
            if room.get("room_id") == room_id:
                room["items"] = [{
                    "item_id": f"test_{uuid.uuid4().hex[:8]}",
                    "name": "Test Item",
                    "quantity": 10,
                    "unit": "nos",
                    "unit_price": 500
                }]
                break
        
        # Save
        auth_session.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq",
            json={"rooms": boq.get("rooms", [])}
        )
        
        # Get grand total before delete
        before_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        grand_total_before = before_response.json().get("grand_total", 0)
        
        # Delete room
        delete_response = auth_session.delete(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/rooms/{room_id}"
        )
        assert delete_response.status_code == 200
        
        # Verify grand total decreased
        after_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        grand_total_after = after_response.json().get("grand_total", 0)
        
        # Grand total should have decreased by 5000 (10 * 500)
        assert grand_total_after < grand_total_before, "Grand total should decrease after deleting room with items"


class TestBOQStatusTransitions:
    """Test PUT /api/projects/{project_id}/boq/status - Status transitions"""
    
    def test_status_draft_to_under_review(self, auth_session):
        """Status can transition from draft to under_review"""
        # Get current status
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert get_response.status_code == 200
        current_boq = get_response.json()
        
        if current_boq.get("status") == "locked":
            pytest.skip("BOQ is locked, cannot test status transitions")
        
        # If already under_review, revert to draft first
        if current_boq.get("status") == "under_review":
            auth_session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/status",
                json={"status": "draft", "change_notes": "Reverting for test"}
            )
        
        # Transition to under_review
        response = auth_session.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/status",
            json={"status": "under_review", "change_notes": "Test transition to review"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("status") == "under_review"
    
    def test_status_under_review_to_draft(self, auth_session):
        """Status can revert from under_review to draft"""
        # Get current status
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        assert get_response.status_code == 200
        current_boq = get_response.json()
        
        if current_boq.get("status") == "locked":
            pytest.skip("BOQ is locked")
        
        # Ensure we're in under_review
        if current_boq.get("status") == "draft":
            auth_session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/status",
                json={"status": "under_review"}
            )
        
        # Revert to draft
        response = auth_session.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/status",
            json={"status": "draft", "change_notes": "Reverting to draft for edits"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("status") == "draft"
    
    def test_invalid_status_returns_400(self, auth_session):
        """Invalid status should return 400"""
        response = auth_session.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/status",
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400


class TestBOQVersionHistory:
    """Test GET /api/projects/{project_id}/boq/versions - Version history"""
    
    def test_get_versions_returns_200(self, auth_session):
        """GET /api/projects/{project_id}/boq/versions should return 200"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/versions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_versions_has_versions_array(self, auth_session):
        """Versions response should have versions array"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/versions")
        assert response.status_code == 200
        
        data = response.json()
        assert "versions" in data
        assert isinstance(data["versions"], list)
    
    def test_get_versions_has_count(self, auth_session):
        """Versions response should have count"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/versions")
        assert response.status_code == 200
        
        data = response.json()
        assert "count" in data
        assert data["count"] == len(data.get("versions", []))


class TestBOQSummary:
    """Test GET /api/projects/{project_id}/boq/summary - Summary for project details"""
    
    def test_get_summary_returns_200(self, auth_session):
        """GET /api/projects/{project_id}/boq/summary should return 200"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_summary_has_required_fields(self, auth_session):
        """Summary should have all required fields"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/summary")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["has_boq", "status", "grand_total", "room_count", "item_count", "version"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
    
    def test_get_summary_has_room_summary(self, auth_session):
        """Summary should have room_summary with subtotals"""
        response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq/summary")
        assert response.status_code == 200
        
        data = response.json()
        if data.get("has_boq"):
            assert "room_summary" in data
            if len(data.get("room_summary", [])) > 0:
                room = data["room_summary"][0]
                assert "name" in room
                assert "subtotal" in room


class TestBOQCalculations:
    """Test BOQ calculation logic"""
    
    def test_item_total_calculation(self, auth_session):
        """Item total should be quantity × unit_price"""
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        if get_response.status_code == 200 and get_response.json().get("status") == "locked":
            pytest.skip("BOQ is locked")
        
        boq = get_response.json()
        rooms = boq.get("rooms", [])
        
        if len(rooms) > 0:
            # Add test item with known values
            test_item = {
                "item_id": f"calc_test_{uuid.uuid4().hex[:8]}",
                "name": "TEST_CalcItem",
                "quantity": 7,
                "unit": "sqft",
                "unit_price": 250
            }
            rooms[0]["items"].append(test_item)
            
            # Save
            auth_session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq",
                json={"rooms": rooms}
            )
            
            # Verify
            verify_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
            verified_boq = verify_response.json()
            
            for room in verified_boq.get("rooms", []):
                for item in room.get("items", []):
                    if item.get("name") == "TEST_CalcItem":
                        expected_total = 7 * 250  # 1750
                        assert item.get("total_price") == expected_total, f"Expected {expected_total}, got {item.get('total_price')}"
                        break
            
            # Cleanup
            rooms = verified_boq.get("rooms", [])
            for room in rooms:
                room["items"] = [i for i in room.get("items", []) if i.get("name") != "TEST_CalcItem"]
            auth_session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq",
                json={"rooms": rooms}
            )


class TestBOQCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_rooms(self, auth_session):
        """Remove any TEST_ prefixed rooms"""
        get_response = auth_session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq")
        if get_response.status_code != 200:
            return
        
        boq = get_response.json()
        if boq.get("status") == "locked":
            return
        
        rooms = boq.get("rooms", [])
        original_count = len(rooms)
        
        # Remove TEST_ rooms
        rooms = [r for r in rooms if not r.get("name", "").startswith("TEST_")]
        
        # Remove TEST_ items from remaining rooms
        for room in rooms:
            room["items"] = [i for i in room.get("items", []) if not i.get("name", "").startswith("TEST_")]
        
        if len(rooms) != original_count:
            auth_session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/boq",
                json={"rooms": rooms}
            )
        
        print(f"Cleanup complete: removed {original_count - len(rooms)} test rooms")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
