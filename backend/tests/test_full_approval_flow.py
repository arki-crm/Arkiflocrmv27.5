"""
Test Full Design Approval Flow
==============================
This test creates a fresh design submission and tests the complete approval flow:
1. Create submission -> 2. Verify in queue -> 3. Approve -> 4. Verify approved status
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFullDesignApprovalFlow:
    """Test the complete design approval flow end-to-end"""
    
    auth_token = None
    test_project_id = "proj_b5e9610f"  # Project without existing submissions
    test_submission_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        if not TestFullDesignApprovalFlow.auth_token:
            login_response = requests.post(
                f"{BASE_URL}/api/auth/local-login",
                json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
            )
            if login_response.status_code == 200:
                cookies = login_response.cookies
                TestFullDesignApprovalFlow.auth_token = cookies.get("session_token")
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {TestFullDesignApprovalFlow.auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_01_create_fresh_submission(self):
        """Create a fresh design submission for design_meeting_2"""
        submission_data = {
            "milestone_key": "design_meeting_2",
            "checklist": [
                {"key": "floor_plan_finalized", "label": "Floor Plan Finalized", "checked": True},
                {"key": "3d_renders_ready", "label": "3D Renders Ready", "checked": True},
                {"key": "material_palette_selected", "label": "Material Palette Selected", "checked": True},
                {"key": "budget_aligned", "label": "Budget Aligned", "checked": True},
                {"key": "scope_coverage_complete", "label": "All Areas Covered", "checked": True},
                {"key": "client_requirements_addressed", "label": "Requirements Addressed", "checked": True}
            ],
            "files": [
                {"filename": "test_design.pdf", "url": "https://example.com/test.pdf"}
            ],
            "design_notes": f"Full flow test submission - {datetime.now().isoformat()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.test_project_id}/design-submissions",
            headers=self.get_headers(),
            json=submission_data
        )
        
        assert response.status_code == 201, f"Failed to create submission: {response.text}"
        
        data = response.json()
        TestFullDesignApprovalFlow.test_submission_id = data.get("submission_id")
        
        assert TestFullDesignApprovalFlow.test_submission_id is not None
        assert data.get("status") == "pending_review"
        
        print(f"✅ Created submission: {TestFullDesignApprovalFlow.test_submission_id}")
        print(f"   Status: {data.get('status')}")
        print(f"   Milestone: {data.get('milestone_name')}")
    
    def test_02_verify_submission_in_review_queue(self):
        """Verify the submission appears in the review queue"""
        response = requests.get(
            f"{BASE_URL}/api/design-manager/review-queue",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Failed to get review queue: {response.text}"
        
        data = response.json()
        pending_designs = data.get("pending_designs", [])
        
        # Find our submission
        found = False
        for sub in pending_designs:
            if sub.get("submission_id") == TestFullDesignApprovalFlow.test_submission_id:
                found = True
                print(f"✅ Submission found in review queue")
                print(f"   Project: {sub.get('project_name')}")
                print(f"   Designer: {sub.get('designer_name')}")
                print(f"   Priority: {sub.get('priority')}")
                break
        
        assert found, f"Submission {TestFullDesignApprovalFlow.test_submission_id} not found in review queue"
    
    def test_03_approve_submission(self):
        """Approve the submission as Design Manager"""
        review_data = {
            "approved": True,
            "review_notes": "Design approved - all requirements met. Good work on the 3D renders."
        }
        
        response = requests.put(
            f"{BASE_URL}/api/projects/{self.test_project_id}/design-submissions/{TestFullDesignApprovalFlow.test_submission_id}/review",
            headers=self.get_headers(),
            json=review_data
        )
        
        assert response.status_code == 200, f"Failed to approve submission: {response.text}"
        
        data = response.json()
        assert data.get("status") == "approved"
        
        print(f"✅ Submission approved successfully")
        print(f"   Status: {data.get('status')}")
        print(f"   Reviewed at: {data.get('reviewed_at')}")
    
    def test_04_verify_approved_status(self):
        """Verify the submission status is now approved"""
        response = requests.get(
            f"{BASE_URL}/api/projects/{self.test_project_id}/design-submissions/{TestFullDesignApprovalFlow.test_submission_id}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Failed to get submission: {response.text}"
        
        data = response.json()
        submission = data.get("submission", data)
        
        assert submission.get("status") == "approved"
        assert submission.get("is_locked") == True
        assert submission.get("reviewed_by") is not None
        
        print(f"✅ Submission status verified as approved")
        print(f"   Reviewed by: {submission.get('reviewed_by_name')}")
        print(f"   Review notes: {submission.get('review_notes')}")
    
    def test_05_submission_no_longer_in_pending_queue(self):
        """Verify approved submission is no longer in pending queue"""
        response = requests.get(
            f"{BASE_URL}/api/design-manager/review-queue",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200
        
        data = response.json()
        pending_designs = data.get("pending_designs", [])
        
        # Should NOT find our submission anymore
        found = any(
            sub.get("submission_id") == TestFullDesignApprovalFlow.test_submission_id 
            for sub in pending_designs
        )
        
        assert not found, "Approved submission should not be in pending queue"
        print(f"✅ Approved submission correctly removed from pending queue")


class TestDesignRejectionFlow:
    """Test the design rejection flow"""
    
    auth_token = None
    test_project_id = "proj_8aeea5f1"  # Different project for rejection test
    test_submission_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        if not TestDesignRejectionFlow.auth_token:
            login_response = requests.post(
                f"{BASE_URL}/api/auth/local-login",
                json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
            )
            if login_response.status_code == 200:
                cookies = login_response.cookies
                TestDesignRejectionFlow.auth_token = cookies.get("session_token")
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {TestDesignRejectionFlow.auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_01_create_submission_for_rejection(self):
        """Create a submission to test rejection flow"""
        submission_data = {
            "milestone_key": "design_meeting_2",
            "checklist": [
                {"key": "floor_plan_finalized", "label": "Floor Plan Finalized", "checked": True},
                {"key": "3d_renders_ready", "label": "3D Renders Ready", "checked": True}
            ],
            "files": [
                {"filename": "test.pdf", "url": "https://example.com/test.pdf"}
            ],
            "design_notes": f"Rejection test submission - {datetime.now().isoformat()}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.test_project_id}/design-submissions",
            headers=self.get_headers(),
            json=submission_data
        )
        
        if response.status_code != 201:
            pytest.skip(f"Could not create submission: {response.text}")
        
        data = response.json()
        TestDesignRejectionFlow.test_submission_id = data.get("submission_id")
        print(f"✅ Created submission for rejection test: {TestDesignRejectionFlow.test_submission_id}")
    
    def test_02_rejection_requires_detailed_notes(self):
        """Test that rejection requires minimum 10 character notes"""
        if not TestDesignRejectionFlow.test_submission_id:
            pytest.skip("No submission to test")
        
        # Try with short notes - should fail
        review_data = {
            "approved": False,
            "review_notes": "bad"  # Too short
        }
        
        response = requests.put(
            f"{BASE_URL}/api/projects/{self.test_project_id}/design-submissions/{TestDesignRejectionFlow.test_submission_id}/review",
            headers=self.get_headers(),
            json=review_data
        )
        
        assert response.status_code == 400, "Should reject short notes"
        print(f"✅ Rejection correctly requires detailed notes (min 10 chars)")
    
    def test_03_reject_with_proper_notes(self):
        """Test rejection with proper detailed notes"""
        if not TestDesignRejectionFlow.test_submission_id:
            pytest.skip("No submission to test")
        
        review_data = {
            "approved": False,
            "review_notes": "The floor plan needs revision. Please adjust the kitchen layout and add more storage space in the bedroom area.",
            "improvement_areas": ["floor_plan", "storage"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/projects/{self.test_project_id}/design-submissions/{TestDesignRejectionFlow.test_submission_id}/review",
            headers=self.get_headers(),
            json=review_data
        )
        
        assert response.status_code == 200, f"Rejection failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "revision_required"
        
        print(f"✅ Submission rejected successfully")
        print(f"   Status: {data.get('status')}")
    
    def test_04_verify_rejected_status(self):
        """Verify submission status is revision_required"""
        if not TestDesignRejectionFlow.test_submission_id:
            pytest.skip("No submission to test")
        
        response = requests.get(
            f"{BASE_URL}/api/projects/{self.test_project_id}/design-submissions/{TestDesignRejectionFlow.test_submission_id}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200
        
        data = response.json()
        submission = data.get("submission", data)
        
        assert submission.get("status") == "revision_required"
        assert submission.get("is_locked") == False  # Should be unlocked for revision
        
        print(f"✅ Rejected submission status verified")
        print(f"   Status: {submission.get('status')}")
        print(f"   Is locked: {submission.get('is_locked')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
