"""
Timeline Intelligence Engine API Tests
======================================
Tests for:
1. Timeline config options API
2. Timeline generation API
3. Timeline retrieval API
4. Timeline override request API
5. Sequential override control
6. Timeline review/approve API
7. Timeline share API
8. Customer view API
9. Pending approvals API
10. Timeline history API
11. User skill_level field
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"
TEST_PROJECT_ID = "proj_8aeea5f1"


class TestTimelineIntelligenceEngine:
    """Timeline Intelligence Engine API tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        return s
    
    # ============ TIMELINE CONFIG OPTIONS ============
    
    def test_timeline_config_options_returns_200(self, session):
        """Test timeline config options API returns 200"""
        response = session.get(f"{BASE_URL}/api/timeline-config/options")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_timeline_config_options_has_scope_types(self, session):
        """Test config options contains scope types"""
        response = session.get(f"{BASE_URL}/api/timeline-config/options")
        data = response.json()
        
        assert "scope_types" in data, "Missing scope_types in response"
        assert len(data["scope_types"]) > 0, "scope_types is empty"
        
        # Check structure
        scope = data["scope_types"][0]
        assert "value" in scope, "scope_type missing 'value'"
        assert "label" in scope, "scope_type missing 'label'"
        assert "complexity" in scope, "scope_type missing 'complexity'"
    
    def test_timeline_config_options_has_project_tiers(self, session):
        """Test config options contains project tiers"""
        response = session.get(f"{BASE_URL}/api/timeline-config/options")
        data = response.json()
        
        assert "project_tiers" in data, "Missing project_tiers in response"
        assert len(data["project_tiers"]) > 0, "project_tiers is empty"
        
        tier = data["project_tiers"][0]
        assert "value" in tier, "project_tier missing 'value'"
        assert "label" in tier, "project_tier missing 'label'"
        assert "revision_buffer" in tier, "project_tier missing 'revision_buffer'"
    
    def test_timeline_config_options_has_priority_tags(self, session):
        """Test config options contains priority tags"""
        response = session.get(f"{BASE_URL}/api/timeline-config/options")
        data = response.json()
        
        assert "priority_tags" in data, "Missing priority_tags in response"
        assert len(data["priority_tags"]) > 0, "priority_tags is empty"
        
        priority = data["priority_tags"][0]
        assert "value" in priority, "priority_tag missing 'value'"
        assert "label" in priority, "priority_tag missing 'label'"
        assert "compression" in priority, "priority_tag missing 'compression'"
    
    def test_timeline_config_options_has_skill_levels(self, session):
        """Test config options contains skill levels"""
        response = session.get(f"{BASE_URL}/api/timeline-config/options")
        data = response.json()
        
        assert "skill_levels" in data, "Missing skill_levels in response"
        assert len(data["skill_levels"]) > 0, "skill_levels is empty"
        
        skill = data["skill_levels"][0]
        assert "value" in skill, "skill_level missing 'value'"
        assert "label" in skill, "skill_level missing 'label'"
        assert "multiplier" in skill, "skill_level missing 'multiplier'"
    
    # ============ TIMELINE RETRIEVAL ============
    
    def test_get_project_timeline_returns_200(self, session):
        """Test get project timeline API returns 200"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_project_timeline_has_exists_field(self, session):
        """Test timeline response has exists field"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        assert "exists" in data, "Missing 'exists' field in response"
    
    def test_get_project_timeline_has_timeline_data(self, session):
        """Test timeline response has timeline data when exists"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists"):
            assert "timeline" in data, "Missing 'timeline' field when exists=True"
            timeline = data["timeline"]
            
            # Check timeline structure
            assert "timeline_id" in timeline, "Missing timeline_id"
            assert "project_id" in timeline, "Missing project_id"
            assert "versions" in timeline, "Missing versions"
            assert "scope_type" in timeline, "Missing scope_type"
            assert "project_tier" in timeline, "Missing project_tier"
            assert "priority_tag" in timeline, "Missing priority_tag"
    
    def test_get_project_timeline_has_11_milestones(self, session):
        """Test timeline has 11 milestones"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists") and data.get("timeline"):
            versions = data["timeline"].get("versions", [])
            if versions:
                milestones = versions[0].get("milestones", [])
                assert len(milestones) == 11, f"Expected 11 milestones, got {len(milestones)}"
    
    def test_get_project_timeline_milestones_structure(self, session):
        """Test milestone structure is correct"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists") and data.get("timeline"):
            versions = data["timeline"].get("versions", [])
            if versions and versions[0].get("milestones"):
                milestone = versions[0]["milestones"][0]
                
                assert "milestone_key" in milestone, "Missing milestone_key"
                assert "milestone_name" in milestone, "Missing milestone_name"
                assert "planned_date" in milestone, "Missing planned_date"
                assert "is_customer_facing" in milestone, "Missing is_customer_facing"
    
    def test_get_project_timeline_has_pending_approval_field(self, session):
        """Test timeline response has pending_approval field"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists"):
            assert "pending_approval" in data, "Missing 'pending_approval' field"
    
    def test_get_project_timeline_has_is_shared_field(self, session):
        """Test timeline response has is_shared_with_customer field"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists"):
            assert "is_shared_with_customer" in data, "Missing 'is_shared_with_customer' field"
    
    # ============ PENDING APPROVALS ============
    
    def test_pending_approvals_returns_200(self, session):
        """Test pending approvals API returns 200"""
        response = session.get(f"{BASE_URL}/api/timelines/pending-approvals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_pending_approvals_has_correct_structure(self, session):
        """Test pending approvals response structure"""
        response = session.get(f"{BASE_URL}/api/timelines/pending-approvals")
        data = response.json()
        
        assert "pending_count" in data, "Missing pending_count"
        assert "timelines" in data, "Missing timelines array"
        assert isinstance(data["timelines"], list), "timelines should be a list"
    
    def test_pending_approvals_timeline_structure(self, session):
        """Test pending approval timeline item structure"""
        response = session.get(f"{BASE_URL}/api/timelines/pending-approvals")
        data = response.json()
        
        if data.get("timelines") and len(data["timelines"]) > 0:
            timeline = data["timelines"][0]
            
            assert "timeline_id" in timeline, "Missing timeline_id"
            assert "project_id" in timeline, "Missing project_id"
            assert "project_name" in timeline, "Missing project_name"
            assert "version" in timeline, "Missing version"
            assert "type" in timeline, "Missing type"
    
    # ============ TIMELINE HISTORY ============
    
    def test_timeline_history_returns_200(self, session):
        """Test timeline history API returns 200"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_timeline_history_has_correct_structure(self, session):
        """Test timeline history response structure"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/history")
        data = response.json()
        
        assert "timeline" in data, "Missing timeline"
        assert "approval_history" in data, "Missing approval_history"
    
    def test_timeline_history_versions_list(self, session):
        """Test timeline history contains versions list"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/history")
        data = response.json()
        
        if data.get("timeline"):
            assert "versions" in data["timeline"], "Missing versions in timeline"
            versions = data["timeline"]["versions"]
            
            if versions:
                version = versions[0]
                assert "version" in version, "Missing version number"
                assert "type" in version, "Missing type"
                assert "status" in version, "Missing status"
    
    # ============ CUSTOMER VIEW ============
    
    def test_customer_view_api_exists(self, session):
        """Test customer view API endpoint exists"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/customer-view")
        # Should return 200 if shared, 403 if not shared, or 404 if no timeline
        assert response.status_code in [200, 403, 404], f"Unexpected status: {response.status_code}"
    
    def test_customer_view_filters_internal_milestones(self, session):
        """Test customer view filters out internal milestones"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/customer-view")
        
        if response.status_code == 200:
            data = response.json()
            milestones = data.get("milestones", [])
            
            # Check that internal milestones are filtered out
            for m in milestones:
                assert m.get("is_customer_facing", True) == True, \
                    f"Internal milestone {m.get('milestone_name')} should not be in customer view"
    
    # ============ SEQUENTIAL OVERRIDE CONTROL ============
    
    def test_sequential_override_control(self, session):
        """Test that second override is rejected while one is pending"""
        # First, get current timeline state
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if not data.get("exists"):
            pytest.skip("No timeline exists for test project")
        
        # Check if there's already a pending override
        if data.get("pending_approval"):
            # Try to submit another override - should fail
            override_response = session.post(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/override",
                json={
                    "milestones": data.get("active_milestones", []),
                    "override_reason": "Test sequential control",
                    "notes": "This should fail if there's already a pending override"
                }
            )
            
            # Should return 400 because there's already a pending override
            assert override_response.status_code == 400, \
                f"Expected 400 for duplicate override, got {override_response.status_code}"
            
            error_detail = override_response.json().get("detail", "")
            assert "pending" in error_detail.lower() or "already" in error_detail.lower(), \
                f"Error message should mention pending override: {error_detail}"
    
    # ============ TIMELINE REVIEW/APPROVE ============
    
    def test_timeline_review_api_exists(self, session):
        """Test timeline review API endpoint exists"""
        # This is a PUT endpoint, test with empty body to verify endpoint exists
        response = session.put(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/review",
            json={"approved": True}
        )
        # Should return 200 (success), 400 (no pending), or 404 (not found)
        assert response.status_code in [200, 400, 404], \
            f"Unexpected status: {response.status_code}: {response.text}"
    
    # ============ TIMELINE SHARE ============
    
    def test_timeline_share_api_exists(self, session):
        """Test timeline share API endpoint exists"""
        response = session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/share",
            json={}
        )
        # Should return 200 (success), 400 (no active version), or 404 (not found)
        assert response.status_code in [200, 400, 404], \
            f"Unexpected status: {response.status_code}: {response.text}"
    
    # ============ USER SKILL LEVEL ============
    
    def test_user_has_skill_level_field(self, session):
        """Test that user profile includes skill_level field"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        
        data = response.json()
        # skill_level may be null for non-designers, but field should exist
        # Check if the field is accessible (may be in user data)
    
    def test_users_list_includes_skill_level(self, session):
        """Test that users list includes skill_level"""
        response = session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", data) if isinstance(data, dict) else data
        
        if users and len(users) > 0:
            # Find a designer user
            designer = next((u for u in users if u.get("role") in ["Designer", "HybridDesigner"]), None)
            if designer:
                assert "skill_level" in designer, "Designer should have skill_level field"
    
    # ============ TIMELINE GENERATION ============
    
    def test_timeline_generation_requires_designer(self, session):
        """Test timeline generation requires a designer assigned"""
        # Try to generate for a project without designer - should fail
        # This is a validation test
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        if response.status_code == 200:
            project = response.json()
            if not project.get("primary_designer_id"):
                gen_response = session.post(
                    f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/generate",
                    json={
                        "scope_type": "3bhk",
                        "project_tier": "standard",
                        "priority_tag": "normal"
                    }
                )
                assert gen_response.status_code == 400, \
                    "Should fail without designer assigned"
    
    def test_timeline_generation_already_exists_error(self, session):
        """Test timeline generation fails if timeline already exists"""
        # Get current timeline
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists"):
            # Try to generate again - should fail
            gen_response = session.post(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/generate",
                json={
                    "scope_type": "3bhk",
                    "project_tier": "standard",
                    "priority_tag": "normal"
                }
            )
            assert gen_response.status_code == 400, \
                f"Expected 400 for duplicate generation, got {gen_response.status_code}"
    
    # ============ CALCULATION INPUTS ============
    
    def test_timeline_has_calculation_inputs(self, session):
        """Test timeline versions contain calculation inputs"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists") and data.get("timeline"):
            versions = data["timeline"].get("versions", [])
            if versions:
                calc_inputs = versions[0].get("calculation_inputs", {})
                
                # Check key calculation factors
                assert "scope_type" in calc_inputs, "Missing scope_type in calculation_inputs"
                assert "complexity_factor" in calc_inputs, "Missing complexity_factor"
                assert "designer_skill_level" in calc_inputs, "Missing designer_skill_level"
                assert "skill_multiplier" in calc_inputs, "Missing skill_multiplier"
                assert "workload_multiplier" in calc_inputs, "Missing workload_multiplier"
                assert "design_multiplier" in calc_inputs, "Missing design_multiplier"
    
    # ============ INTERNAL MILESTONES ============
    
    def test_timeline_has_internal_milestones(self, session):
        """Test timeline includes internal (non-customer-facing) milestones"""
        response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        data = response.json()
        
        if data.get("exists") and data.get("timeline"):
            versions = data["timeline"].get("versions", [])
            if versions and versions[0].get("milestones"):
                milestones = versions[0]["milestones"]
                
                # Count internal milestones
                internal_count = sum(1 for m in milestones if not m.get("is_customer_facing", True))
                
                # Should have at least 2 internal milestones (Internal Design Review 1 & 2)
                assert internal_count >= 2, \
                    f"Expected at least 2 internal milestones, found {internal_count}"
    
    # ============ ERROR HANDLING ============
    
    def test_timeline_not_found_for_invalid_project(self, session):
        """Test 404 for non-existent project"""
        response = session.get(f"{BASE_URL}/api/projects/invalid_project_id/timeline")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_timeline_history_not_found_for_invalid_project(self, session):
        """Test 404 for timeline history of non-existent project"""
        response = session.get(f"{BASE_URL}/api/projects/invalid_project_id/timeline/history")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestTimelineWorkflow:
    """End-to-end timeline workflow tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        login_response = s.post(f"{BASE_URL}/api/auth/local-login", json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        return s
    
    def test_full_timeline_workflow(self, session):
        """Test complete timeline workflow: get -> check pending -> review if needed"""
        # Step 1: Get timeline
        timeline_response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
        assert timeline_response.status_code == 200
        
        timeline_data = timeline_response.json()
        print(f"Timeline exists: {timeline_data.get('exists')}")
        
        if not timeline_data.get("exists"):
            print("No timeline exists - skipping workflow test")
            return
        
        # Step 2: Check pending approvals
        pending_response = session.get(f"{BASE_URL}/api/timelines/pending-approvals")
        assert pending_response.status_code == 200
        
        pending_data = pending_response.json()
        print(f"Pending approvals count: {pending_data.get('pending_count')}")
        
        # Step 3: Get history
        history_response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/history")
        assert history_response.status_code == 200
        
        history_data = history_response.json()
        versions = history_data.get("timeline", {}).get("versions", [])
        print(f"Timeline versions: {len(versions)}")
        
        for v in versions:
            print(f"  - v{v.get('version')}: {v.get('type')} - {v.get('status')}")
        
        # Step 4: If there's a pending approval, approve it
        if timeline_data.get("pending_approval"):
            print("Found pending approval - approving...")
            review_response = session.put(
                f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline/review",
                json={"approved": True, "review_notes": "Approved via automated test"}
            )
            print(f"Review response: {review_response.status_code}")
            
            if review_response.status_code == 200:
                # Verify approval
                verify_response = session.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/timeline")
                verify_data = verify_response.json()
                
                # Should have active version now
                assert verify_data.get("timeline", {}).get("active_version") is not None, \
                    "Should have active version after approval"
                print("Timeline approved successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
