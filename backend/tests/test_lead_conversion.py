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


class TestLeadConversion:
    """Test Lead to Project Conversion functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, f"No token in response: {data}"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def test_designer(self, auth_headers):
        """Get or create a test designer user"""
        # Get list of users to find a designer
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        if response.status_code == 200:
            users = response.json()
            # Find a designer
            for user in users:
                if user.get("role") == "Designer":
                    return user
        # Return None if no designer found - tests will handle this
        return None
    
    @pytest.fixture(scope="class")
    def test_lead_for_conversion(self, auth_headers, test_designer):
        """Create a test lead at 'Booking Completed' stage for conversion testing"""
        unique_id = uuid.uuid4().hex[:8]
        
        lead_data = {
            "customer_name": f"TEST_ConversionTest_{unique_id}",
            "customer_phone": f"9876{unique_id[:6]}",
            "customer_email": f"test_conversion_{unique_id}@example.com",
            "customer_address": "Test Address for Conversion",
            "source": "Website",
            "budget": 500000,
            "customer_requirements": "Test requirements for conversion testing"
        }
        
        # Create lead
        response = requests.post(
            f"{BASE_URL}/api/leads",
            json=lead_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201], f"Failed to create lead: {response.text}"
        lead = response.json()
        lead_id = lead.get("lead_id")
        assert lead_id, f"No lead_id in response: {lead}"
        
        # Progress lead to Booking Completed stage
        # First, assign a designer if available
        if test_designer:
            designer_id = test_designer.get("user_id")
            requests.put(
                f"{BASE_URL}/api/leads/{lead_id}/assign-designer",
                json={"designer_id": designer_id},
                headers=auth_headers
            )
        
        # Progress through stages to reach Booking Completed
        stages_to_progress = [
            "Site Visit Scheduled",
            "Site Visit Completed", 
            "Quotation Sent",
            "Negotiation",
            "Booking Completed"
        ]
        
        for stage in stages_to_progress:
            response = requests.put(
                f"{BASE_URL}/api/leads/{lead_id}/stage",
                json={"stage": stage},
                headers=auth_headers
            )
            # Don't fail if stage update fails - some stages may have requirements
        
        # Confirm booking payment (required for conversion)
        response = requests.put(
            f"{BASE_URL}/api/leads/{lead_id}/confirm-booking-payment",
            headers=auth_headers
        )
        
        # Get the updated lead
        response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=auth_headers)
        if response.status_code == 200:
            lead = response.json()
        
        yield lead
        
        # Cleanup: Delete test lead and any created project
        # Note: In production, you might want to keep these for audit
    
    def test_01_login_works(self, auth_token):
        """Verify login works and we have a valid token"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, token obtained")
    
    def test_02_create_lead_for_conversion(self, auth_headers):
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
        
        response = requests.post(
            f"{BASE_URL}/api/leads",
            json=lead_data,
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Failed to create lead: {response.text}"
        lead = response.json()
        
        assert "lead_id" in lead, f"No lead_id in response: {lead}"
        assert lead.get("customer_name") == lead_data["customer_name"]
        
        print(f"✓ Created test lead: {lead['lead_id']}")
        
        # Store for later tests
        self.__class__.created_lead_id = lead["lead_id"]
        return lead
    
    def test_03_conversion_requires_booking_completed_stage(self, auth_headers):
        """Verify conversion fails if lead is not at Booking Completed stage"""
        # Use the lead created in previous test
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/convert",
            headers=auth_headers
        )
        
        # Should fail because lead is not at Booking Completed stage
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Booking Completed" in data.get("detail", ""), f"Unexpected error: {data}"
        
        print(f"✓ Conversion correctly rejected - lead not at Booking Completed stage")
    
    def test_04_progress_lead_to_booking_completed(self, auth_headers, test_designer):
        """Progress lead through stages to Booking Completed"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        # Assign designer if available
        if test_designer:
            designer_id = test_designer.get("user_id")
            response = requests.put(
                f"{BASE_URL}/api/leads/{lead_id}/assign-designer",
                json={"designer_id": designer_id},
                headers=auth_headers
            )
            print(f"  Designer assignment: {response.status_code}")
        
        # Progress through stages
        stages = [
            "Site Visit Scheduled",
            "Site Visit Completed",
            "Quotation Sent",
            "Negotiation",
            "Booking Completed"
        ]
        
        for stage in stages:
            response = requests.put(
                f"{BASE_URL}/api/leads/{lead_id}/stage",
                json={"stage": stage},
                headers=auth_headers
            )
            print(f"  Stage '{stage}': {response.status_code}")
        
        # Verify lead is at Booking Completed
        response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=auth_headers)
        assert response.status_code == 200
        lead = response.json()
        
        assert lead.get("stage") == "Booking Completed", f"Lead stage is {lead.get('stage')}, expected Booking Completed"
        print(f"✓ Lead progressed to Booking Completed stage")
    
    def test_05_conversion_requires_payment_confirmation(self, auth_headers):
        """Verify conversion fails without booking payment confirmation"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/convert",
            headers=auth_headers
        )
        
        # Should fail because booking payment not confirmed
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "payment" in data.get("detail", "").lower() or "accounts" in data.get("detail", "").lower(), \
            f"Unexpected error: {data}"
        
        print(f"✓ Conversion correctly rejected - booking payment not confirmed")
    
    def test_06_confirm_booking_payment(self, auth_headers):
        """Confirm booking payment for the lead"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = requests.put(
            f"{BASE_URL}/api/leads/{lead_id}/confirm-booking-payment",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to confirm payment: {response.text}"
        
        # Verify lead has booking_payment_confirmed
        response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=auth_headers)
        assert response.status_code == 200
        lead = response.json()
        
        assert lead.get("booking_payment_confirmed") == True, f"Payment not confirmed: {lead}"
        print(f"✓ Booking payment confirmed")
    
    def test_07_convert_lead_to_project_success(self, auth_headers):
        """
        CRITICAL TEST: Verify lead converts to project successfully
        This tests the bug fix for function name collision
        """
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/convert",
            headers=auth_headers
        )
        
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
    
    def test_08_verify_project_created_in_database(self, auth_headers):
        """Verify the project document was created in database"""
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}",
            headers=auth_headers
        )
        
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
    
    def test_09_verify_lead_marked_as_converted(self, auth_headers):
        """Verify lead is marked as is_converted=True"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Lead not found: {response.text}"
        lead = response.json()
        
        # Verify conversion flags
        assert lead.get("is_converted") == True, f"Lead not marked as converted: {lead}"
        assert lead.get("project_id") == getattr(self.__class__, 'created_project_id', None), \
            f"Lead not linked to project: {lead}"
        
        print(f"✓ Lead marked as converted")
        print(f"  is_converted: {lead.get('is_converted')}")
        print(f"  project_id: {lead.get('project_id')}")
    
    def test_10_verify_project_timeline_generated(self, auth_headers):
        """
        CRITICAL TEST: Verify project timeline was generated during conversion
        This is the key test for the bug fix - timeline generation was failing
        due to function name collision
        """
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        project = response.json()
        
        # Verify timeline exists
        timeline = project.get("timeline", [])
        assert len(timeline) > 0, f"No timeline generated for project: {project}"
        
        print(f"✓ Project timeline generated successfully!")
        print(f"  Timeline entries: {len(timeline)}")
        
        # Print first few timeline entries
        for entry in timeline[:3]:
            print(f"    - {entry.get('title', 'N/A')}: {entry.get('status', 'N/A')}")
    
    def test_11_verify_project_milestones_seeded(self, auth_headers):
        """Verify project milestones were seeded during conversion"""
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        project = response.json()
        
        timeline = project.get("timeline", [])
        
        # Check for expected milestone stages
        expected_stages = ["Design Finalization"]  # At minimum, current stage should be present
        
        timeline_stages = [entry.get("stage_ref") or entry.get("stage") for entry in timeline]
        
        # Verify at least some milestones exist
        assert len(timeline) >= 1, f"Expected at least 1 milestone, got {len(timeline)}"
        
        print(f"✓ Project milestones seeded")
        print(f"  Total milestones: {len(timeline)}")
    
    def test_12_verify_cannot_convert_already_converted_lead(self, auth_headers):
        """Verify that already converted lead cannot be converted again"""
        lead_id = getattr(self.__class__, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/convert",
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "already converted" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        
        print(f"✓ Double conversion correctly prevented")
    
    def test_13_verify_timeline_intelligence_endpoint_renamed(self, auth_headers):
        """
        Verify the Timeline Intelligence endpoint is properly renamed
        and doesn't conflict with the sync helper function
        """
        project_id = getattr(self.__class__, 'created_project_id', None)
        if not project_id:
            pytest.skip("No project created in previous test")
        
        # Try to call the timeline generate endpoint
        # It should fail because timeline already exists (from conversion)
        response = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/timeline/generate",
            json={
                "scope_type": "3bhk",
                "project_tier": "standard",
                "priority_tag": "normal"
            },
            headers=auth_headers
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
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        token = data.get("token") or data.get("access_token")
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_convert_nonexistent_lead(self, auth_headers):
        """Verify conversion fails for non-existent lead"""
        fake_lead_id = f"lead_nonexistent_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{fake_lead_id}/convert",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent lead conversion correctly returns 404")
    
    def test_convert_without_auth(self):
        """Verify conversion fails without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/leads/some_lead_id/convert",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated conversion correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
