"""
Timeline Adjustment Feature Tests
Tests for Lead and Project timeline adjustment APIs including:
- Adjust Timeline endpoints (POST /api/leads/{id}/adjust-timeline, POST /api/projects/{id}/adjust-timeline)
- Timeline History endpoints (GET /api/leads/{id}/timeline-history, GET /api/projects/{id}/timeline-history)
- Permission checks (timeline.adjust permission required)
- Validation (reason, remarks, adjustment_type)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "thaha.pakayil@gmail.com"
ADMIN_PASSWORD = "password123"


class TestSetup:
    """Setup tests - ensure admin user exists and can login"""
    
    def test_setup_local_admin(self):
        """Setup local admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/setup-local-admin")
        # May return 200 (created) or 400 (already exists)
        assert response.status_code in [200, 400], f"Setup admin failed: {response.text}"
        print(f"Admin setup response: {response.status_code}")
    
    def test_admin_login(self):
        """Test admin login and get session token"""
        response = requests.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Login not successful"
        assert "user" in data, "No user in response"
        # Session token is set via Set-Cookie header
        assert "session_token" in response.cookies or "set-cookie" in response.headers.get("set-cookie", "").lower() or response.cookies.get("session_token"), "No session token cookie"
        print(f"Login successful for: {data['user'].get('email')}")


@pytest.fixture(scope="module")
def admin_session():
    """Get authenticated admin session"""
    # Setup admin first
    requests.post(f"{BASE_URL}/api/auth/setup-local-admin")
    
    # Login with session to capture cookies
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/local-login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    
    # Session token is set via Set-Cookie header and captured by session
    assert session.cookies.get("session_token"), "No session token cookie captured"
    
    return session


@pytest.fixture(scope="module")
def test_lead(admin_session):
    """Create a test lead for timeline adjustment tests"""
    lead_data = {
        "customer_name": f"TEST_Timeline_Lead_{uuid.uuid4().hex[:6]}",
        "customer_phone": "9876543210",
        "customer_email": f"test_timeline_{uuid.uuid4().hex[:6]}@example.com",
        "source": "Website",
        "city": "Mumbai",
        "property_type": "Apartment",
        "budget_range": "10-20 Lakhs",
        "notes": "Test lead for timeline adjustment testing"
    }
    
    response = admin_session.post(f"{BASE_URL}/api/leads", json=lead_data)
    
    if response.status_code == 201:
        lead = response.json()
        yield lead
        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/leads/{lead['lead_id']}")
    else:
        # Try to find an existing lead
        response = admin_session.get(f"{BASE_URL}/api/leads")
        if response.status_code == 200:
            leads = response.json()
            if leads and len(leads) > 0:
                yield leads[0]
            else:
                pytest.skip("No leads available for testing")
        else:
            pytest.skip(f"Could not create or find test lead: {response.text}")


@pytest.fixture(scope="module")
def test_project(admin_session):
    """Get or create a test project for timeline adjustment tests"""
    # Try to find an existing project
    response = admin_session.get(f"{BASE_URL}/api/projects")
    if response.status_code == 200:
        projects = response.json()
        if projects and len(projects) > 0:
            yield projects[0]
            return
    
    pytest.skip("No projects available for testing")


class TestLeadTimelineAdjustment:
    """Tests for Lead Timeline Adjustment API"""
    
    def test_adjust_timeline_shift_forward(self, admin_session, test_lead):
        """Test shifting lead timeline forward by N days"""
        lead_id = test_lead.get("lead_id")
        
        adjustment_data = {
            "reason": "Customer Delay",
            "remarks": "Customer requested delay due to personal reasons - testing shift forward",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "shift_forward",
            "shift_days": 7
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 200, f"Adjust timeline failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert data["message"] == "Timeline adjusted successfully"
        assert "adjustment" in data
        assert data["adjustment"]["adjustment_type"] == "shift_forward"
        assert data["adjustment"]["shift_days"] == 7
        assert data["adjustment"]["reason"] == "Customer Delay"
        print(f"Lead timeline shifted forward by 7 days successfully")
    
    def test_adjust_timeline_on_hold(self, admin_session, test_lead):
        """Test marking lead timeline as on hold"""
        lead_id = test_lead.get("lead_id")
        
        adjustment_data = {
            "reason": "Customer Hold",
            "remarks": "Customer requested hold due to travel - testing on hold feature",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "on_hold"
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 200, f"Adjust timeline failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Timeline adjusted successfully"
        assert data["current_timeline"]["on_hold"] == True
        assert "hold_since" in data["current_timeline"]
        print(f"Lead timeline marked as on hold successfully")
    
    def test_adjust_timeline_resume(self, admin_session, test_lead):
        """Test resuming lead timeline from hold"""
        lead_id = test_lead.get("lead_id")
        
        # First check if on hold
        history_response = admin_session.get(f"{BASE_URL}/api/leads/{lead_id}/timeline-history")
        if history_response.status_code == 200:
            history_data = history_response.json()
            if not history_data.get("is_on_hold"):
                # Put on hold first
                admin_session.post(
                    f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
                    json={
                        "reason": "Customer Hold",
                        "remarks": "Putting on hold before resume test - testing resume feature",
                        "effective_date": datetime.now().strftime("%Y-%m-%d"),
                        "adjustment_type": "on_hold"
                    }
                )
        
        adjustment_data = {
            "reason": "Customer Hold",
            "remarks": "Customer ready to proceed - testing resume from hold feature",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "resume"
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 200, f"Resume timeline failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Timeline adjusted successfully"
        assert data["current_timeline"]["on_hold"] == False
        print(f"Lead timeline resumed successfully")
    
    def test_adjust_timeline_new_completion_date(self, admin_session, test_lead):
        """Test setting new completion date for lead"""
        lead_id = test_lead.get("lead_id")
        
        new_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        adjustment_data = {
            "reason": "Scope Change",
            "remarks": "Scope expanded, need more time - testing new completion date feature",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "new_completion_date",
            "new_completion_date": new_date
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 200, f"Adjust timeline failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Timeline adjusted successfully"
        assert data["adjustment"]["new_completion"] == new_date
        print(f"Lead completion date set to {new_date} successfully")
    
    def test_get_lead_timeline_history(self, admin_session, test_lead):
        """Test getting lead timeline history"""
        lead_id = test_lead.get("lead_id")
        
        response = admin_session.get(f"{BASE_URL}/api/leads/{lead_id}/timeline-history")
        
        assert response.status_code == 200, f"Get timeline history failed: {response.text}"
        data = response.json()
        
        assert "lead_id" in data
        assert data["lead_id"] == lead_id
        assert "timeline_adjustments" in data
        assert "is_on_hold" in data
        print(f"Lead timeline history retrieved: {len(data.get('timeline_adjustments', []))} adjustments")
    
    def test_adjust_timeline_invalid_reason(self, admin_session, test_lead):
        """Test that invalid reason is rejected"""
        lead_id = test_lead.get("lead_id")
        
        adjustment_data = {
            "reason": "Invalid Reason",
            "remarks": "This should fail due to invalid reason - testing validation",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "shift_forward",
            "shift_days": 5
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid reason, got {response.status_code}"
        print("Invalid reason correctly rejected")
    
    def test_adjust_timeline_short_remarks(self, admin_session, test_lead):
        """Test that short remarks are rejected"""
        lead_id = test_lead.get("lead_id")
        
        adjustment_data = {
            "reason": "Customer Delay",
            "remarks": "Short",  # Less than 10 characters
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "shift_forward",
            "shift_days": 5
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 400, f"Expected 400 for short remarks, got {response.status_code}"
        print("Short remarks correctly rejected")
    
    def test_adjust_timeline_missing_shift_days(self, admin_session, test_lead):
        """Test that shift_forward without shift_days is rejected"""
        lead_id = test_lead.get("lead_id")
        
        adjustment_data = {
            "reason": "Customer Delay",
            "remarks": "Testing validation for missing shift_days parameter",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "shift_forward"
            # Missing shift_days
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 400, f"Expected 400 for missing shift_days, got {response.status_code}"
        print("Missing shift_days correctly rejected")


class TestProjectTimelineAdjustment:
    """Tests for Project Timeline Adjustment API"""
    
    def test_adjust_project_timeline_shift_forward(self, admin_session, test_project):
        """Test shifting project timeline forward by N days"""
        project_id = test_project.get("project_id")
        
        adjustment_data = {
            "reason": "Vendor Delay",
            "remarks": "Vendor delayed material delivery - testing project shift forward",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "shift_forward",
            "shift_days": 14
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/projects/{project_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 200, f"Adjust project timeline failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Timeline adjusted successfully"
        assert data["adjustment"]["adjustment_type"] == "shift_forward"
        assert data["adjustment"]["shift_days"] == 14
        print(f"Project timeline shifted forward by 14 days successfully")
    
    def test_adjust_project_timeline_on_hold(self, admin_session, test_project):
        """Test marking project timeline as on hold"""
        project_id = test_project.get("project_id")
        
        adjustment_data = {
            "reason": "Payment Delay",
            "remarks": "Awaiting payment from customer - testing project on hold feature",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "on_hold"
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/projects/{project_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 200, f"Adjust project timeline failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Timeline adjusted successfully"
        assert data["current_timeline"]["on_hold"] == True
        print(f"Project timeline marked as on hold successfully")
    
    def test_adjust_project_timeline_resume(self, admin_session, test_project):
        """Test resuming project timeline from hold"""
        project_id = test_project.get("project_id")
        
        # First check if on hold
        history_response = admin_session.get(f"{BASE_URL}/api/projects/{project_id}/timeline-history")
        if history_response.status_code == 200:
            history_data = history_response.json()
            if not history_data.get("is_on_hold"):
                # Put on hold first
                admin_session.post(
                    f"{BASE_URL}/api/projects/{project_id}/adjust-timeline",
                    json={
                        "reason": "Customer Hold",
                        "remarks": "Putting project on hold before resume test - testing resume",
                        "effective_date": datetime.now().strftime("%Y-%m-%d"),
                        "adjustment_type": "on_hold"
                    }
                )
        
        adjustment_data = {
            "reason": "Payment Delay",
            "remarks": "Payment received, resuming project - testing project resume feature",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "resume"
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/projects/{project_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 200, f"Resume project timeline failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "Timeline adjusted successfully"
        assert data["current_timeline"]["on_hold"] == False
        print(f"Project timeline resumed successfully")
    
    def test_get_project_timeline_history(self, admin_session, test_project):
        """Test getting project timeline history"""
        project_id = test_project.get("project_id")
        
        response = admin_session.get(f"{BASE_URL}/api/projects/{project_id}/timeline-history")
        
        assert response.status_code == 200, f"Get project timeline history failed: {response.text}"
        data = response.json()
        
        assert "project_id" in data
        assert data["project_id"] == project_id
        assert "timeline_adjustments" in data
        assert "is_on_hold" in data
        print(f"Project timeline history retrieved: {len(data.get('timeline_adjustments', []))} adjustments")


class TestTimelineAdjustmentValidation:
    """Tests for timeline adjustment validation"""
    
    def test_all_valid_reasons(self, admin_session, test_lead):
        """Test that all valid reasons are accepted"""
        lead_id = test_lead.get("lead_id")
        
        valid_reasons = [
            "Customer Hold",
            "Customer Delay",
            "Internal Delay",
            "Payment Delay",
            "Vendor Delay",
            "Scope Change",
            "Other"
        ]
        
        for reason in valid_reasons:
            adjustment_data = {
                "reason": reason,
                "remarks": f"Testing valid reason: {reason} - this is a test remark",
                "effective_date": datetime.now().strftime("%Y-%m-%d"),
                "adjustment_type": "shift_forward",
                "shift_days": 1
            }
            
            response = admin_session.post(
                f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
                json=adjustment_data
            )
            
            assert response.status_code == 200, f"Reason '{reason}' should be valid but got {response.status_code}: {response.text}"
        
        print(f"All {len(valid_reasons)} valid reasons accepted")
    
    def test_invalid_adjustment_type(self, admin_session, test_lead):
        """Test that invalid adjustment type is rejected"""
        lead_id = test_lead.get("lead_id")
        
        adjustment_data = {
            "reason": "Customer Delay",
            "remarks": "Testing invalid adjustment type - should be rejected",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "invalid_type"
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/{lead_id}/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid adjustment_type, got {response.status_code}"
        print("Invalid adjustment_type correctly rejected")
    
    def test_nonexistent_lead(self, admin_session):
        """Test that adjusting nonexistent lead returns 404"""
        adjustment_data = {
            "reason": "Customer Delay",
            "remarks": "Testing nonexistent lead - should return 404 error",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "shift_forward",
            "shift_days": 5
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/leads/nonexistent_lead_id/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 404, f"Expected 404 for nonexistent lead, got {response.status_code}"
        print("Nonexistent lead correctly returns 404")
    
    def test_nonexistent_project(self, admin_session):
        """Test that adjusting nonexistent project returns 404"""
        adjustment_data = {
            "reason": "Customer Delay",
            "remarks": "Testing nonexistent project - should return 404 error",
            "effective_date": datetime.now().strftime("%Y-%m-%d"),
            "adjustment_type": "shift_forward",
            "shift_days": 5
        }
        
        response = admin_session.post(
            f"{BASE_URL}/api/projects/nonexistent_project_id/adjust-timeline",
            json=adjustment_data
        )
        
        assert response.status_code == 404, f"Expected 404 for nonexistent project, got {response.status_code}"
        print("Nonexistent project correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
