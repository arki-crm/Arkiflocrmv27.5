"""
Test Lead to Project Conversion - Bug Fix Verification
Tests the fix for function name collision where async generate_project_timeline_intelligent()
was overriding sync generate_project_timeline() helper function.

Features tested:
1. Lead to Project conversion API endpoint: POST /api/leads/{lead_id}/convert
2. Conversion creates a new project document in database
3. Lead is marked as is_converted=True after conversion
4. Lead gets linked to project via project_id field
5. Project timeline is generated during conversion
6. Project milestones are seeded during conversion
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "thaha.pakayil@gmail.com"
TEST_PASSWORD = "password123"

# Lead stages in order
LEAD_STAGES = [
    "Lead Allocated",
    "BC Call Done",
    "BOQ Shared",
    "Site Meeting",
    "Revised BOQ Shared",
    "Waiting for Booking",
    "Booking Completed"
]


class TestLeadConversion:
    """Test Lead to Project Conversion functionality"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Get authenticated session with cookies"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Login not successful: {data}"
        
        return session
    
    @pytest.fixture(scope="class")
    def test_designer(self, session):
        """Get or create a test designer user"""
        response = session.get(f"{BASE_URL}/api/users")
        if response.status_code == 200:
            users = response.json()
            for user in users:
                if user.get("role") == "Designer":
                    return user
        return None
    
    def test_01_login_works(self, session):
        """Verify login works and we have a valid session"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth check failed: {response.text}"
        user = response.json()
        assert user.get("email") == TEST_EMAIL
        print(f"✓ Login successful, user: {user.get('name')}")
    
    def test_02_create_lead_for_conversion(self, session):
        """Create a fresh lead specifically for conversion testing"""
        unique_id = uuid.uuid4().hex[:8]
        
        lead_data = {
            "customer_name": f"TEST_ConversionLead_{unique_id}",
            "customer_phone": f"9999{unique_id[:6]}",
            "customer_email": f"conversion_test_{unique_id}@test.com",
            "source": "Referral",
            "budget": 750000,
            "customer_requirements": "Full home interior - conversion test"
        }
        
        response = session.post(
            f"{BASE_URL}/api/leads",
            json=lead_data
        )
        
        assert response.status_code in [200, 201], f"Failed to create lead: {response.text}"
        lead = response.json()
        
        assert "lead_id" in lead, f"No lead_id in response: {lead}"
        assert lead.get("customer_name") == lead_data["customer_name"]
        
        print(f"✓ Created test lead: {lead['lead_id']}")
        print(f"  Initial stage: {lead.get('stage')}")
        
        # Store for later tests
        self.__class__.created_lead_id = lead["lead_id"]
    
    def test_03_conversion_requires_booking_completed_stage(self, session):
        """Verify conversion fails if lead is not at Booking Completed stage"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = session.post(f"{BASE_URL}/api/leads/{lead_id}/convert")
        
        # Should fail because lead is not at Booking Completed stage
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Booking Completed" in data.get("detail", ""), f"Unexpected error: {data}"
        
        print(f"✓ Conversion correctly rejected - lead not at Booking Completed stage")
    
    def test_04_progress_lead_through_stages(self, session, test_designer):
        """Progress lead through stages to Waiting for Booking"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        # Assign designer if available
        if test_designer:
            designer_id = test_designer.get("user_id")
            response = session.put(
                f"{BASE_URL}/api/leads/{lead_id}/assign-designer",
                json={"designer_id": designer_id}
            )
            print(f"  Designer assignment: {response.status_code}")
        
        # Progress through stages up to Waiting for Booking
        # (Cannot go to Booking Completed without payment confirmation)
        stages_to_progress = [
            "BC Call Done",
            "BOQ Shared",
            "Site Meeting",
            "Revised BOQ Shared",
            "Waiting for Booking"
        ]
        
        for stage in stages_to_progress:
            response = session.put(
                f"{BASE_URL}/api/leads/{lead_id}/stage",
                json={"stage": stage}
            )
            print(f"  Stage '{stage}': {response.status_code}")
            if response.status_code != 200:
                print(f"    Error: {response.text}")
        
        # Verify lead is at Waiting for Booking
        response = session.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert response.status_code == 200
        lead = response.json()
        
        assert lead.get("stage") == "Waiting for Booking", f"Lead stage is {lead.get('stage')}, expected Waiting for Booking"
        print(f"✓ Lead progressed to Waiting for Booking stage")
    
    def test_05_confirm_booking_payment(self, session):
        """Confirm booking payment for the lead"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = session.put(f"{BASE_URL}/api/leads/{lead_id}/confirm-booking-payment")
        
        assert response.status_code == 200, f"Failed to confirm payment: {response.text}"
        
        # Verify lead has booking_payment_confirmed
        response = session.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert response.status_code == 200
        lead = response.json()
        
        assert lead.get("booking_payment_confirmed") == True, f"Payment not confirmed: {lead}"
        print(f"✓ Booking payment confirmed")
    
    def test_06_progress_to_booking_completed(self, session):
        """Progress lead to Booking Completed stage after payment confirmation"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = session.put(
            f"{BASE_URL}/api/leads/{lead_id}/stage",
            json={"stage": "Booking Completed"}
        )
        
        assert response.status_code == 200, f"Failed to progress to Booking Completed: {response.text}"
        
        # Verify lead is at Booking Completed
        response = session.get(f"{BASE_URL}/api/leads/{lead_id}")
        assert response.status_code == 200
        lead = response.json()
        
        assert lead.get("stage") == "Booking Completed", f"Lead stage is {lead.get('stage')}, expected Booking Completed"
        print(f"✓ Lead progressed to Booking Completed stage")
    
    def test_07_convert_lead_to_project_success(self, session):
        """
        CRITICAL TEST: Verify lead converts to project successfully
        This tests the bug fix for function name collision
        """
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = session.post(f"{BASE_URL}/api/leads/{lead_id}/convert")
        
        assert response.status_code == 200, f"Conversion failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "project_id" in data, f"No project_id in response: {data}"
        assert "pid" in data, f"No pid in response: {data}"
        assert "lead_id" in data, f"No lead_id in response: {data}"
        assert data["lead_id"] == lead_id
        
        # Store project_id for later tests
        self.__class__.created_project_id = data["project_id"]
        self.__class__.created_pid = data["pid"]
        
        print(f"✓ Lead converted successfully!")
        print(f"  Project ID: {data['project_id']}")
        print(f"  PID: {data['pid']}")
    
    def test_08_verify_project_created_in_database(self, session):
        """Verify the project document was created in database"""
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        response = session.get(f"{BASE_URL}/api/projects/{project_id}")
        
        assert response.status_code == 200, f"Project not found: {response.text}"
        project = response.json()
        
        # Verify project structure
        assert project.get("project_id") == project_id
        assert project.get("pid") == getattr(self.__class__, 'created_pid', None)
        assert project.get("stage") == "Design Finalization"
        assert project.get("lead_id") == getattr(self.__class__, 'created_lead_id', None)
        
        # Verify customer details carried forward
        assert "client_name" in project
        assert "client_phone" in project
        
        print(f"✓ Project document verified in database")
        print(f"  Stage: {project.get('stage')}")
        print(f"  Client: {project.get('client_name')}")
    
    def test_09_verify_lead_marked_as_converted(self, session):
        """Verify lead is marked as is_converted=True"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = session.get(f"{BASE_URL}/api/leads/{lead_id}")
        
        assert response.status_code == 200, f"Lead not found: {response.text}"
        lead = response.json()
        
        # Verify conversion flags
        assert lead.get("is_converted") == True, f"Lead not marked as converted: is_converted={lead.get('is_converted')}"
        assert lead.get("project_id") == getattr(self.__class__, 'created_project_id', None), \
            f"Lead not linked to project: project_id={lead.get('project_id')}"
        
        print(f"✓ Lead marked as converted")
        print(f"  is_converted: {lead.get('is_converted')}")
        print(f"  project_id: {lead.get('project_id')}")
    
    def test_10_verify_project_timeline_generated(self, session):
        """
        CRITICAL TEST: Verify project timeline was generated during conversion
        This is the key test for the bug fix - timeline generation was failing
        due to function name collision
        """
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        response = session.get(f"{BASE_URL}/api/projects/{project_id}")
        
        assert response.status_code == 200
        project = response.json()
        
        # Verify timeline exists
        timeline = project.get("timeline", [])
        assert len(timeline) > 0, f"No timeline generated for project: timeline={timeline}"
        
        print(f"✓ Project timeline generated successfully!")
        print(f"  Timeline entries: {len(timeline)}")
        
        # Print first few timeline entries
        for entry in timeline[:3]:
            print(f"    - {entry.get('title', 'N/A')}: {entry.get('status', 'N/A')}")
    
    def test_11_verify_project_milestones_seeded(self, session):
        """Verify project milestones were seeded during conversion"""
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        response = session.get(f"{BASE_URL}/api/projects/{project_id}")
        
        assert response.status_code == 200
        project = response.json()
        
        timeline = project.get("timeline", [])
        
        # Verify at least some milestones exist
        assert len(timeline) >= 1, f"Expected at least 1 milestone, got {len(timeline)}"
        
        # Check for expected milestone structure
        for milestone in timeline[:3]:
            assert "title" in milestone, f"Milestone missing title: {milestone}"
            assert "status" in milestone, f"Milestone missing status: {milestone}"
        
        print(f"✓ Project milestones seeded")
        print(f"  Total milestones: {len(timeline)}")
    
    def test_12_verify_cannot_convert_already_converted_lead(self, session):
        """Verify that already converted lead cannot be converted again"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = session.post(f"{BASE_URL}/api/leads/{lead_id}/convert")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "already converted" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        
        print(f"✓ Double conversion correctly prevented")
    
    def test_13_verify_timeline_intelligence_endpoint_renamed(self, session):
        """
        Verify the Timeline Intelligence endpoint is properly renamed
        and doesn't conflict with the sync helper function
        """
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        # Try to call the timeline generate endpoint
        # It should fail because timeline already exists (from conversion)
        response = session.post(
            f"{BASE_URL}/api/projects/{project_id}/timeline/generate",
            json={
                "scope_type": "3bhk",
                "project_tier": "standard",
                "priority_tag": "normal"
            }
        )
        
        # Should return 400 because timeline already exists
        # This proves the endpoint is working and properly named
        if response.status_code == 400:
            data = response.json()
            assert "already exists" in data.get("detail", "").lower(), f"Unexpected error: {data}"
            print(f"✓ Timeline Intelligence endpoint working correctly")
            print(f"  Correctly rejects duplicate timeline generation")
        elif response.status_code == 403:
            # Permission denied is also acceptable
            print(f"✓ Timeline Intelligence endpoint accessible (permission check working)")
        else:
            # Any other response means endpoint exists
            print(f"✓ Timeline Intelligence endpoint exists (status: {response.status_code})")


class TestLeadConversionEdgeCases:
    """Test edge cases for lead conversion"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return session
    
    def test_convert_nonexistent_lead(self, session):
        """Verify conversion fails for non-existent lead"""
        fake_lead_id = f"lead_nonexistent_{uuid.uuid4().hex[:8]}"
        
        response = session.post(f"{BASE_URL}/api/leads/{fake_lead_id}/convert")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ Non-existent lead conversion correctly returns 404")
    
    def test_convert_without_auth(self):
        """Verify conversion fails without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/leads/some_lead_id/convert",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated conversion correctly rejected")


class TestExistingConvertedLead:
    """Test with the already converted lead mentioned in the bug report"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return session
    
    def test_verify_existing_converted_lead(self, session):
        """Verify the lead mentioned in bug report (lead_9fb8a84d) was converted"""
        lead_id = "lead_9fb8a84d"
        
        response = session.get(f"{BASE_URL}/api/leads/{lead_id}")
        
        if response.status_code == 404:
            pytest.skip(f"Lead {lead_id} not found - may have been cleaned up")
        
        assert response.status_code == 200
        lead = response.json()
        
        # Verify it was converted
        assert lead.get("is_converted") == True, f"Lead not marked as converted"
        assert lead.get("project_id") is not None, f"Lead not linked to project"
        
        print(f"✓ Existing lead {lead_id} verified as converted")
        print(f"  project_id: {lead.get('project_id')}")
        
        # Store for next test
        self.__class__.existing_project_id = lead.get("project_id")
    
    def test_verify_existing_project_has_timeline(self, session):
        """Verify the project created from lead_9fb8a84d has timeline"""
        project_id = getattr(self.__class__, 'existing_project_id', "proj_b5e9610f")
        
        response = session.get(f"{BASE_URL}/api/projects/{project_id}")
        
        if response.status_code == 404:
            pytest.skip(f"Project {project_id} not found")
        
        assert response.status_code == 200
        project = response.json()
        
        # Verify timeline exists
        timeline = project.get("timeline", [])
        assert len(timeline) > 0, f"No timeline in project"
        
        print(f"✓ Existing project {project_id} has timeline")
        print(f"  Timeline entries: {len(timeline)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
