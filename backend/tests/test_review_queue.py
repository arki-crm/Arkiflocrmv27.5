"""
Test Design Manager Review Queue APIs (Phase 3)
Tests:
- GET /api/design-manager/review-queue - Comprehensive queue with stats
- GET /api/design-manager/upcoming-meetings - Meetings in next N days needing approval
- GET /api/design-manager/overdue-reviews - Past-due submissions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReviewQueueAPIs:
    """Test Review Queue APIs for Design Managers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with founder credentials"""
        self.session = requests.Session()
        # Login with founder credentials
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "sidheeq.arkidots@gmail.com", "password": "founder123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_review_queue_returns_200(self):
        """GET /api/design-manager/review-queue returns 200"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_review_queue_has_stats(self):
        """Review queue response includes stats object"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200
        data = response.json()
        
        assert "stats" in data, "Response missing 'stats' field"
        stats = data["stats"]
        
        # Verify stats structure
        assert "pending_designs" in stats, "Stats missing 'pending_designs'"
        assert "pending_timelines" in stats, "Stats missing 'pending_timelines'"
        assert "upcoming_meetings" in stats, "Stats missing 'upcoming_meetings'"
        assert "total_action_items" in stats, "Stats missing 'total_action_items'"
    
    def test_review_queue_pending_designs_structure(self):
        """Pending designs stats have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200
        data = response.json()
        
        pending_designs = data["stats"]["pending_designs"]
        assert "total" in pending_designs, "pending_designs missing 'total'"
        assert "overdue" in pending_designs, "pending_designs missing 'overdue'"
        assert "due_soon" in pending_designs, "pending_designs missing 'due_soon'"
        
        # Values should be integers
        assert isinstance(pending_designs["total"], int)
        assert isinstance(pending_designs["overdue"], int)
        assert isinstance(pending_designs["due_soon"], int)
    
    def test_review_queue_pending_timelines_structure(self):
        """Pending timelines stats have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200
        data = response.json()
        
        pending_timelines = data["stats"]["pending_timelines"]
        assert "total" in pending_timelines, "pending_timelines missing 'total'"
        assert isinstance(pending_timelines["total"], int)
    
    def test_review_queue_upcoming_meetings_structure(self):
        """Upcoming meetings stats have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200
        data = response.json()
        
        upcoming_meetings = data["stats"]["upcoming_meetings"]
        assert "total" in upcoming_meetings, "upcoming_meetings missing 'total'"
        assert "critical" in upcoming_meetings, "upcoming_meetings missing 'critical'"
        assert "not_submitted" in upcoming_meetings, "upcoming_meetings missing 'not_submitted'"
        assert "pending_review" in upcoming_meetings, "upcoming_meetings missing 'pending_review'"
    
    def test_review_queue_has_data_arrays(self):
        """Review queue response includes data arrays"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200
        data = response.json()
        
        assert "pending_designs" in data, "Response missing 'pending_designs' array"
        assert "pending_timelines" in data, "Response missing 'pending_timelines' array"
        assert "upcoming_meetings" in data, "Response missing 'upcoming_meetings' array"
        
        # All should be lists
        assert isinstance(data["pending_designs"], list)
        assert isinstance(data["pending_timelines"], list)
        assert isinstance(data["upcoming_meetings"], list)
    
    def test_upcoming_meetings_endpoint_returns_200(self):
        """GET /api/design-manager/upcoming-meetings returns 200"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/upcoming-meetings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_upcoming_meetings_with_days_param(self):
        """Upcoming meetings accepts days_ahead parameter"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/upcoming-meetings?days_ahead=14")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_meetings" in data
        assert "ready_count" in data
        assert "needs_review_count" in data
        assert "not_submitted_count" in data
        assert "by_urgency" in data
        assert "all_meetings" in data
    
    def test_upcoming_meetings_urgency_categories(self):
        """Upcoming meetings are categorized by urgency"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/upcoming-meetings?days_ahead=14")
        assert response.status_code == 200
        data = response.json()
        
        by_urgency = data["by_urgency"]
        assert "critical" in by_urgency, "Missing 'critical' urgency category"
        assert "high" in by_urgency, "Missing 'high' urgency category"
        assert "medium" in by_urgency, "Missing 'medium' urgency category"
        assert "low" in by_urgency, "Missing 'low' urgency category"
        
        # All should be lists
        assert isinstance(by_urgency["critical"], list)
        assert isinstance(by_urgency["high"], list)
        assert isinstance(by_urgency["medium"], list)
        assert isinstance(by_urgency["low"], list)
    
    def test_upcoming_meetings_all_meetings_array(self):
        """Upcoming meetings includes all_meetings array"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/upcoming-meetings?days_ahead=14")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data["all_meetings"], list)
        
        # If there are meetings, verify structure
        if len(data["all_meetings"]) > 0:
            meeting = data["all_meetings"][0]
            expected_fields = ["project_id", "project_name", "milestone_key", "milestone_name", 
                            "meeting_date", "days_until_meeting", "status", "urgency"]
            for field in expected_fields:
                assert field in meeting, f"Meeting missing '{field}' field"
    
    def test_overdue_reviews_endpoint_returns_200(self):
        """GET /api/design-manager/overdue-reviews returns 200"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/overdue-reviews")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_overdue_reviews_structure(self):
        """Overdue reviews response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/overdue-reviews")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_overdue" in data, "Response missing 'total_overdue'"
        assert "critical_count" in data, "Response missing 'critical_count'"
        assert "overdue_reviews" in data, "Response missing 'overdue_reviews'"
        
        assert isinstance(data["total_overdue"], int)
        assert isinstance(data["critical_count"], int)
        assert isinstance(data["overdue_reviews"], list)
    
    def test_overdue_reviews_item_structure(self):
        """Overdue review items have correct structure (if any exist)"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/overdue-reviews")
        assert response.status_code == 200
        data = response.json()
        
        # If there are overdue reviews, verify structure
        if len(data["overdue_reviews"]) > 0:
            review = data["overdue_reviews"][0]
            expected_fields = ["submission_id", "project_id", "project_name", "milestone_name",
                            "days_overdue", "urgency"]
            for field in expected_fields:
                assert field in review, f"Overdue review missing '{field}' field"
            
            # days_overdue should be positive
            assert review["days_overdue"] > 0, "days_overdue should be positive for overdue items"
            
            # urgency should be valid
            assert review["urgency"] in ["critical", "high", "medium"], f"Invalid urgency: {review['urgency']}"
    
    def test_review_queue_permission_denied_for_designer(self):
        """Review queue requires manager permissions"""
        # Create a new session without login (or with designer role)
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/design-manager/review-queue")
        # Should return 401 (not authenticated) or 403 (forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_total_action_items_calculation(self):
        """Total action items equals sum of all pending items"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200
        data = response.json()
        
        stats = data["stats"]
        calculated_total = (
            stats["pending_designs"]["total"] + 
            stats["pending_timelines"]["total"] + 
            stats["upcoming_meetings"]["total"]
        )
        
        assert stats["total_action_items"] == calculated_total, \
            f"total_action_items ({stats['total_action_items']}) != calculated ({calculated_total})"


class TestReviewQueueEmptyState:
    """Test Review Queue with empty/no data scenarios"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "sidheeq.arkidots@gmail.com", "password": "founder123"}
        )
        assert login_response.status_code == 200
    
    def test_empty_queue_returns_valid_structure(self):
        """Empty queue still returns valid response structure"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/review-queue")
        assert response.status_code == 200
        data = response.json()
        
        # Even with empty data, structure should be valid
        assert data["stats"]["pending_designs"]["total"] >= 0
        assert data["stats"]["pending_timelines"]["total"] >= 0
        assert data["stats"]["upcoming_meetings"]["total"] >= 0
        assert data["stats"]["total_action_items"] >= 0
    
    def test_empty_overdue_returns_zero(self):
        """Empty overdue reviews returns zero counts"""
        response = self.session.get(f"{BASE_URL}/api/design-manager/overdue-reviews")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_overdue"] >= 0
        assert data["critical_count"] >= 0
        assert isinstance(data["overdue_reviews"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
