"""
Design Approval Gate Phase 1 - Backend API Tests
=================================================
Tests for the mandatory design approval workflow before client presentations.

Gated Milestones:
- design_meeting_2 -> Design Meeting 2 (3D Concept Freeze)
- design_meeting_3_final -> Design Meeting 3 (Final Design Freeze)
- pre_production_signoff -> Pre-Production Sign-Off

Test Coverage:
- GET /api/design-approval/gated-milestones
- GET /api/design-approval/checklist/{milestone_key}
- POST /api/projects/{id}/design-submissions
- GET /api/projects/{id}/design-submissions
- GET /api/projects/{id}/design-approval-status
- PUT /api/projects/{id}/design-submissions/{sid}/review
- GET /api/design-submissions/pending-approvals
- Milestone gate integration
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"

# Test project with existing approved submission
TEST_PROJECT_ID = "proj_8aeea5f1"


class TestDesignApprovalGateAPIs:
    """Design Approval Gate API Tests"""
    
    session_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        if not TestDesignApprovalGateAPIs.session_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/local-login",
                json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
            )
            assert response.status_code == 200, f"Login failed: {response.text}"
            # Extract session token from cookies
            TestDesignApprovalGateAPIs.session_token = response.cookies.get('session_token')
        
        self.headers = {"Content-Type": "application/json"}
        self.cookies = {"session_token": TestDesignApprovalGateAPIs.session_token}
    
    # ============ GATED MILESTONES CONFIG TESTS ============
    
    def test_get_gated_milestones_returns_3_milestones(self):
        """GET /api/design-approval/gated-milestones returns 3 milestones with checklist counts"""
        response = requests.get(
            f"{BASE_URL}/api/design-approval/gated-milestones",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "gated_milestones" in data
        assert "statuses" in data
        
        # Verify 3 gated milestones
        milestones = data["gated_milestones"]
        assert len(milestones) == 3, f"Expected 3 gated milestones, got {len(milestones)}"
        
        # Verify milestone keys
        milestone_keys = [m["key"] for m in milestones]
        assert "design_meeting_2" in milestone_keys
        assert "design_meeting_3_final" in milestone_keys
        assert "pre_production_signoff" in milestone_keys
        
        # Verify each milestone has checklist_items count
        for milestone in milestones:
            assert "checklist_items" in milestone
            assert milestone["checklist_items"] > 0, f"Milestone {milestone['key']} has no checklist items"
    
    def test_get_gated_milestones_has_statuses(self):
        """GET /api/design-approval/gated-milestones returns submission statuses"""
        response = requests.get(
            f"{BASE_URL}/api/design-approval/gated-milestones",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        statuses = data["statuses"]
        assert "pending_review" in statuses
        assert "approved" in statuses
        assert "rejected" in statuses
        assert "revision_required" in statuses
    
    # ============ CHECKLIST TEMPLATE TESTS ============
    
    def test_get_checklist_design_meeting_2(self):
        """GET /api/design-approval/checklist/design_meeting_2 returns 6 checklist items"""
        response = requests.get(
            f"{BASE_URL}/api/design-approval/checklist/design_meeting_2",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["milestone_key"] == "design_meeting_2"
        assert "checklist" in data
        assert len(data["checklist"]) == 6, f"Expected 6 checklist items, got {len(data['checklist'])}"
        
        # Verify checklist item structure
        for item in data["checklist"]:
            assert "key" in item
            assert "label" in item
            assert "required" in item
    
    def test_get_checklist_design_meeting_3_final(self):
        """GET /api/design-approval/checklist/design_meeting_3_final returns 6 checklist items"""
        response = requests.get(
            f"{BASE_URL}/api/design-approval/checklist/design_meeting_3_final",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["milestone_key"] == "design_meeting_3_final"
        assert len(data["checklist"]) == 6
    
    def test_get_checklist_pre_production_signoff(self):
        """GET /api/design-approval/checklist/pre_production_signoff returns 6 checklist items"""
        response = requests.get(
            f"{BASE_URL}/api/design-approval/checklist/pre_production_signoff",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["milestone_key"] == "pre_production_signoff"
        assert len(data["checklist"]) == 6
    
    def test_get_checklist_invalid_milestone_returns_400(self):
        """GET /api/design-approval/checklist/invalid_key returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/design-approval/checklist/invalid_milestone_key",
            cookies=self.cookies
        )
        
        assert response.status_code == 400
    
    # ============ PROJECT APPROVAL STATUS TESTS ============
    
    def test_get_project_design_approval_status(self):
        """GET /api/projects/{id}/design-approval-status shows status for all 3 gated milestones"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-approval-status",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["project_id"] == TEST_PROJECT_ID
        assert "milestones" in data
        assert len(data["milestones"]) == 3, f"Expected 3 milestones, got {len(data['milestones'])}"
        
        # Verify milestone structure
        for milestone in data["milestones"]:
            assert "milestone_key" in milestone
            assert "milestone_name" in milestone
            assert "status" in milestone
            assert "can_complete_milestone" in milestone
    
    def test_project_has_approved_submission_for_design_meeting_2(self):
        """Verify test project has approved submission for design_meeting_2"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-approval-status",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Find design_meeting_2 milestone
        dm2_milestone = next(
            (m for m in data["milestones"] if m["milestone_key"] == "design_meeting_2"),
            None
        )
        
        assert dm2_milestone is not None, "design_meeting_2 milestone not found"
        assert dm2_milestone["status"] == "approved", f"Expected approved, got {dm2_milestone['status']}"
        assert dm2_milestone["can_complete_milestone"] == True
    
    # ============ DESIGN SUBMISSIONS TESTS ============
    
    def test_get_project_design_submissions(self):
        """GET /api/projects/{id}/design-submissions returns submissions grouped by milestone"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["project_id"] == TEST_PROJECT_ID
        assert "by_milestone" in data
        assert "all_submissions" in data
        assert "total_submissions" in data
    
    def test_create_design_submission_for_design_meeting_3(self):
        """POST /api/projects/{id}/design-submissions creates submission with pending_review status"""
        # First check if there's already a pending submission
        status_response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-approval-status",
            cookies=self.cookies
        )
        status_data = status_response.json()
        
        dm3_milestone = next(
            (m for m in status_data["milestones"] if m["milestone_key"] == "design_meeting_3_final"),
            None
        )
        
        # If there's already a pending submission, skip this test
        if dm3_milestone and dm3_milestone["status"] == "pending_review":
            pytest.skip("Pending submission already exists for design_meeting_3_final")
        
        # Create submission
        submission_data = {
            "milestone_key": "design_meeting_3_final",
            "files": [
                {
                    "file_id": f"file_{uuid.uuid4().hex[:8]}",
                    "file_name": "final_design_v1.pdf",
                    "file_url": "https://example.com/final_design.pdf",
                    "file_type": "document",
                    "file_size": 1024000,
                    "uploaded_at": datetime.now().isoformat()
                }
            ],
            "checklist": [
                {"key": "all_revisions_incorporated", "label": "All Client Revisions Incorporated", "required": True, "checked": True},
                {"key": "final_3d_renders", "label": "Final 3D Renders Complete", "required": True, "checked": True},
                {"key": "working_drawings_ready", "label": "Working Drawings Ready", "required": True, "checked": True},
                {"key": "material_specifications_finalized", "label": "Material Specifications Finalized", "required": True, "checked": True},
                {"key": "budget_final_approval", "label": "Budget Has Client Approval", "required": True, "checked": True},
                {"key": "design_presentation_ready", "label": "Design Presentation Ready", "required": True, "checked": True}
            ],
            "design_notes": "Final design submission for testing - all revisions incorporated",
            "concept_summary": "Modern minimalist design with premium finishes",
            "constraints_notes": "Budget constraints addressed in material selection"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions",
            json=submission_data,
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "submission" in data
        assert data["submission"]["status"] == "pending_review"
        assert data["submission"]["milestone_key"] == "design_meeting_3_final"
        
        # Store submission ID for later tests
        TestDesignApprovalGateAPIs.test_submission_id = data["submission"]["submission_id"]
    
    def test_sequential_submission_control_blocks_duplicate_pending(self):
        """Cannot submit while pending review exists for same milestone"""
        # First ensure there's a pending submission
        status_response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-approval-status",
            cookies=self.cookies
        )
        status_data = status_response.json()
        
        dm3_milestone = next(
            (m for m in status_data["milestones"] if m["milestone_key"] == "design_meeting_3_final"),
            None
        )
        
        if not dm3_milestone or dm3_milestone["status"] != "pending_review":
            pytest.skip("No pending submission exists to test sequential control")
        
        # Try to create another submission - should fail
        submission_data = {
            "milestone_key": "design_meeting_3_final",
            "files": [{"file_id": "test", "file_name": "test.pdf", "file_url": "http://test.com", "file_type": "document", "uploaded_at": datetime.now().isoformat()}],
            "checklist": [{"key": "test", "label": "Test", "required": True, "checked": True}],
            "design_notes": "Duplicate submission test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions",
            json=submission_data,
            cookies=self.cookies
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "pending review" in response.json().get("detail", "").lower()
    
    # ============ PENDING APPROVALS QUEUE TESTS ============
    
    def test_get_pending_approvals_queue(self):
        """GET /api/design-submissions/pending-approvals returns queue for managers"""
        response = requests.get(
            f"{BASE_URL}/api/design-submissions/pending-approvals",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "pending_count" in data
        assert "overdue_count" in data
        assert "due_soon_count" in data
        assert "submissions" in data
        
        # Verify submission structure if any exist
        if data["submissions"]:
            sub = data["submissions"][0]
            assert "submission_id" in sub
            assert "project_id" in sub
            assert "project_name" in sub
            assert "milestone_name" in sub
            assert "submitted_by_name" in sub
    
    # ============ REVIEW SUBMISSION TESTS ============
    
    def test_reject_submission_with_review_notes(self):
        """PUT /api/projects/{id}/design-submissions/{sid}/review rejects with review_notes"""
        # Get a pending submission to reject
        status_response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-approval-status",
            cookies=self.cookies
        )
        status_data = status_response.json()
        
        dm3_milestone = next(
            (m for m in status_data["milestones"] if m["milestone_key"] == "design_meeting_3_final"),
            None
        )
        
        if not dm3_milestone or dm3_milestone["status"] != "pending_review":
            pytest.skip("No pending submission to reject")
        
        submission_id = dm3_milestone.get("pending_submission_id")
        if not submission_id:
            pytest.skip("No pending submission ID found")
        
        # Reject the submission
        review_data = {
            "approved": False,
            "review_notes": "Please revise the 3D renders to include updated material selections. The current renders don't reflect the latest client feedback.",
            "improvement_areas": ["3D Renders", "Material Selection"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions/{submission_id}/review",
            json=review_data,
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "revision_required"
        assert "reviewed_at" in data
    
    def test_reject_requires_minimum_review_notes(self):
        """Rejection requires minimum 10 characters in review_notes"""
        # Create a new submission first
        submission_data = {
            "milestone_key": "design_meeting_3_final",
            "files": [{"file_id": f"file_{uuid.uuid4().hex[:8]}", "file_name": "test.pdf", "file_url": "http://test.com", "file_type": "document", "uploaded_at": datetime.now().isoformat()}],
            "checklist": [
                {"key": "all_revisions_incorporated", "label": "All Client Revisions Incorporated", "required": True, "checked": True},
                {"key": "final_3d_renders", "label": "Final 3D Renders Complete", "required": True, "checked": True},
                {"key": "working_drawings_ready", "label": "Working Drawings Ready", "required": True, "checked": True},
                {"key": "material_specifications_finalized", "label": "Material Specifications Finalized", "required": True, "checked": True},
                {"key": "budget_final_approval", "label": "Budget Has Client Approval", "required": True, "checked": True},
                {"key": "design_presentation_ready", "label": "Design Presentation Ready", "required": True, "checked": True}
            ],
            "design_notes": "Test submission for rejection validation"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions",
            json=submission_data,
            cookies=self.cookies
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create submission for test")
        
        submission_id = create_response.json()["submission"]["submission_id"]
        
        # Try to reject with short notes
        review_data = {
            "approved": False,
            "review_notes": "Bad"  # Less than 10 characters
        }
        
        response = requests.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions/{submission_id}/review",
            json=review_data,
            cookies=self.cookies
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "minimum" in response.json().get("detail", "").lower() or "10 characters" in response.json().get("detail", "").lower()
    
    def test_approve_submission(self):
        """PUT /api/projects/{id}/design-submissions/{sid}/review approves submission"""
        # Get pending submission
        status_response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-approval-status",
            cookies=self.cookies
        )
        status_data = status_response.json()
        
        dm3_milestone = next(
            (m for m in status_data["milestones"] if m["milestone_key"] == "design_meeting_3_final"),
            None
        )
        
        # If no pending, create one
        if not dm3_milestone or dm3_milestone["status"] != "pending_review":
            submission_data = {
                "milestone_key": "design_meeting_3_final",
                "files": [{"file_id": f"file_{uuid.uuid4().hex[:8]}", "file_name": "final.pdf", "file_url": "http://test.com", "file_type": "document", "uploaded_at": datetime.now().isoformat()}],
                "checklist": [
                    {"key": "all_revisions_incorporated", "label": "All Client Revisions Incorporated", "required": True, "checked": True},
                    {"key": "final_3d_renders", "label": "Final 3D Renders Complete", "required": True, "checked": True},
                    {"key": "working_drawings_ready", "label": "Working Drawings Ready", "required": True, "checked": True},
                    {"key": "material_specifications_finalized", "label": "Material Specifications Finalized", "required": True, "checked": True},
                    {"key": "budget_final_approval", "label": "Budget Has Client Approval", "required": True, "checked": True},
                    {"key": "design_presentation_ready", "label": "Design Presentation Ready", "required": True, "checked": True}
                ],
                "design_notes": "Final submission for approval test"
            }
            
            create_response = requests.post(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions",
                json=submission_data,
                cookies=self.cookies
            )
            
            if create_response.status_code != 200:
                pytest.skip("Could not create submission for approval test")
            
            submission_id = create_response.json()["submission"]["submission_id"]
        else:
            submission_id = dm3_milestone.get("pending_submission_id")
        
        # Approve the submission
        review_data = {
            "approved": True,
            "review_notes": "Design looks great! Approved for client presentation."
        }
        
        response = requests.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions/{submission_id}/review",
            json=review_data,
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "approved"
    
    # ============ MILESTONE GATE INTEGRATION TESTS ============
    
    def test_milestone_gate_allows_completion_after_approval(self):
        """Milestone gate allows completion after approval"""
        # Verify design_meeting_2 has approved submission
        status_response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-approval-status",
            cookies=self.cookies
        )
        status_data = status_response.json()
        
        dm2_milestone = next(
            (m for m in status_data["milestones"] if m["milestone_key"] == "design_meeting_2"),
            None
        )
        
        assert dm2_milestone is not None
        assert dm2_milestone["status"] == "approved"
        assert dm2_milestone["can_complete_milestone"] == True
    
    def test_get_specific_submission_details(self):
        """GET /api/projects/{id}/design-submissions/{sid} returns submission details"""
        # Get submissions list first
        list_response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions",
            cookies=self.cookies
        )
        
        if list_response.status_code != 200 or not list_response.json().get("all_submissions"):
            pytest.skip("No submissions to test")
        
        submission_id = list_response.json()["all_submissions"][0]["submission_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions/{submission_id}",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "submission" in data
        assert data["submission"]["submission_id"] == submission_id
        assert "previous_submissions" in data


class TestDesignApprovalGateEdgeCases:
    """Edge case tests for Design Approval Gate"""
    
    session_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        if not TestDesignApprovalGateEdgeCases.session_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/local-login",
                json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
            )
            assert response.status_code == 200
            TestDesignApprovalGateEdgeCases.session_token = response.cookies.get('session_token')
        
        self.cookies = {"session_token": TestDesignApprovalGateEdgeCases.session_token}
    
    def test_invalid_project_returns_404(self):
        """GET /api/projects/invalid_id/design-approval-status returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/projects/invalid_project_id_12345/design-approval-status",
            cookies=self.cookies
        )
        
        assert response.status_code == 404
    
    def test_invalid_milestone_key_in_submission_returns_400(self):
        """POST with invalid milestone_key returns 400"""
        submission_data = {
            "milestone_key": "invalid_milestone_key",
            "files": [],
            "checklist": [],
            "design_notes": "Test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/design-submissions",
            json=submission_data,
            cookies=self.cookies
        )
        
        assert response.status_code == 400
        assert "invalid" in response.json().get("detail", "").lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
