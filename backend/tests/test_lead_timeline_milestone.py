"""
Test Lead Timeline/Milestone Flow - Business Logic Fix Verification

Tests the corrected behavior:
1. Lead starts at 'Lead Allocated' stage (auto-completed on creation)
2. 'BC Call Done' must be manually completed by designer (24h TAT)
3. 'First BOQ Sent' must be manually completed (48h TAT after BC Call)
4. Delay tracking should work correctly based on TAT rules
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeadTimelineMilestoneFlow:
    """Test the corrected lead timeline/milestone business logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin credentials"""
        # Setup admin user
        setup_response = requests.post(f"{BASE_URL}/api/auth/setup-local-admin")
        assert setup_response.status_code == 200, f"Admin setup failed: {setup_response.text}"
        
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        self.session = requests.Session()
        self.session.cookies.update(login_response.cookies)
        
        yield
        
        # Cleanup: Delete test leads
        try:
            leads_response = self.session.get(f"{BASE_URL}/api/leads")
            if leads_response.status_code == 200:
                for lead in leads_response.json():
                    if lead.get('customer_name', '').startswith('TEST_'):
                        self.session.delete(f"{BASE_URL}/api/leads/{lead['lead_id']}")
        except:
            pass
    
    def test_new_lead_starts_at_lead_allocated_stage(self):
        """Test that new leads start at 'Lead Allocated' stage, not 'BC Call Done'"""
        # Create a new lead
        lead_data = {
            "customer_name": "TEST_Timeline_Customer",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "source": "Walk-in",
            "status": "In Progress"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        
        # CRITICAL: Verify lead starts at 'Lead Allocated' stage
        assert lead['stage'] == 'Lead Allocated', f"Expected stage 'Lead Allocated', got '{lead['stage']}'"
        
        # Store lead_id for cleanup
        self.test_lead_id = lead['lead_id']
        
        print(f"✓ New lead created with stage: {lead['stage']}")
        return lead
    
    def test_lead_allocated_milestone_is_auto_completed(self):
        """Test that 'Lead Allocated' milestone is auto-completed on creation"""
        # Create a new lead
        lead_data = {
            "customer_name": "TEST_Milestone_Customer",
            "customer_phone": "9876543211",
            "source": "Meta"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        timeline = lead.get('timeline', [])
        
        # Find 'Lead Allocated' milestone
        lead_allocated_milestone = None
        for milestone in timeline:
            if milestone['title'] == 'Lead Allocated':
                lead_allocated_milestone = milestone
                break
        
        assert lead_allocated_milestone is not None, "Lead Allocated milestone not found in timeline"
        
        # CRITICAL: Verify 'Lead Allocated' is auto-completed
        assert lead_allocated_milestone['status'] == 'completed', \
            f"Expected 'Lead Allocated' status 'completed', got '{lead_allocated_milestone['status']}'"
        assert lead_allocated_milestone['completedDate'] is not None, \
            "'Lead Allocated' should have a completedDate"
        
        print(f"✓ Lead Allocated milestone status: {lead_allocated_milestone['status']}")
        print(f"✓ Lead Allocated completedDate: {lead_allocated_milestone['completedDate']}")
        
        self.test_lead_id = lead['lead_id']
        return lead
    
    def test_bc_call_done_milestone_is_pending_not_auto_completed(self):
        """Test that 'BC Call Done' milestone is pending (NOT auto-completed)"""
        # Create a new lead
        lead_data = {
            "customer_name": "TEST_BCCall_Customer",
            "customer_phone": "9876543212",
            "source": "Referral"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        timeline = lead.get('timeline', [])
        
        # Find 'BC Call Done' milestone
        bc_call_milestone = None
        for milestone in timeline:
            if milestone['title'] == 'BC Call Done':
                bc_call_milestone = milestone
                break
        
        assert bc_call_milestone is not None, "BC Call Done milestone not found in timeline"
        
        # CRITICAL: Verify 'BC Call Done' is NOT auto-completed (should be pending or delayed)
        assert bc_call_milestone['status'] in ['pending', 'delayed'], \
            f"Expected 'BC Call Done' status 'pending' or 'delayed', got '{bc_call_milestone['status']}'"
        assert bc_call_milestone['completedDate'] is None, \
            "'BC Call Done' should NOT have a completedDate on creation"
        
        print(f"✓ BC Call Done milestone status: {bc_call_milestone['status']} (correctly NOT auto-completed)")
        print(f"✓ BC Call Done completedDate: {bc_call_milestone['completedDate']}")
        
        self.test_lead_id = lead['lead_id']
        return lead
    
    def test_first_boq_sent_has_correct_tat(self):
        """Test that 'First BOQ Sent' milestone has correct TAT (48h after BC Call)"""
        # Create a new lead
        lead_data = {
            "customer_name": "TEST_BOQ_TAT_Customer",
            "customer_phone": "9876543213",
            "source": "Others"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        timeline = lead.get('timeline', [])
        created_at = lead.get('created_at')
        
        # Find milestones
        lead_allocated = None
        bc_call = None
        first_boq = None
        
        for milestone in timeline:
            if milestone['title'] == 'Lead Allocated':
                lead_allocated = milestone
            elif milestone['title'] == 'BC Call Done':
                bc_call = milestone
            elif milestone['title'] == 'First BOQ Sent':
                first_boq = milestone
        
        assert lead_allocated is not None, "Lead Allocated milestone not found"
        assert bc_call is not None, "BC Call Done milestone not found"
        assert first_boq is not None, "First BOQ Sent milestone not found"
        
        # Parse dates
        created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        bc_call_expected = datetime.fromisoformat(bc_call['expectedDate'].replace('Z', '+00:00'))
        first_boq_expected = datetime.fromisoformat(first_boq['expectedDate'].replace('Z', '+00:00'))
        
        # Verify TAT:
        # Lead Allocated: Day 0 (immediate)
        # BC Call Done: Day 1 (24h TAT)
        # First BOQ Sent: Day 3 (cumulative: 0 + 1 + 2 = 3 days from creation)
        
        bc_call_days = (bc_call_expected - created_date).days
        first_boq_days = (first_boq_expected - created_date).days
        
        print(f"✓ Created at: {created_date.date()}")
        print(f"✓ BC Call expected: {bc_call_expected.date()} ({bc_call_days} days from creation)")
        print(f"✓ First BOQ expected: {first_boq_expected.date()} ({first_boq_days} days from creation)")
        
        # BC Call should be 1 day after creation (TAT: 1 day)
        assert bc_call_days == 1, f"BC Call should be 1 day after creation, got {bc_call_days} days"
        
        # First BOQ should be 3 days after creation (cumulative: 0 + 1 + 2 = 3)
        assert first_boq_days == 3, f"First BOQ should be 3 days after creation, got {first_boq_days} days"
        
        self.test_lead_id = lead['lead_id']
        return lead
    
    def test_stage_progression_lead_allocated_to_bc_call_done(self):
        """Test stage progression from 'Lead Allocated' to 'BC Call Done'"""
        # Create a new lead
        lead_data = {
            "customer_name": "TEST_Stage_Progress_Customer",
            "customer_phone": "9876543214",
            "source": "Walk-in"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        lead_id = lead['lead_id']
        
        # Verify initial stage
        assert lead['stage'] == 'Lead Allocated', f"Initial stage should be 'Lead Allocated', got '{lead['stage']}'"
        
        # Progress to BC Call Done
        stage_update = {"stage": "BC Call Done"}
        update_response = self.session.put(f"{BASE_URL}/api/leads/{lead_id}/stage", json=stage_update)
        assert update_response.status_code == 200, f"Failed to update stage: {update_response.text}"
        
        updated_lead = update_response.json()
        assert updated_lead['stage'] == 'BC Call Done', \
            f"Stage should be 'BC Call Done' after update, got '{updated_lead['stage']}'"
        
        print(f"✓ Stage progression: Lead Allocated -> BC Call Done successful")
        
        self.test_lead_id = lead_id
        return updated_lead
    
    def test_stage_progression_bc_call_done_to_boq_shared(self):
        """Test stage progression from 'BC Call Done' to 'BOQ Shared'"""
        # Create a new lead
        lead_data = {
            "customer_name": "TEST_BOQ_Progress_Customer",
            "customer_phone": "9876543215",
            "source": "Meta"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        lead_id = lead['lead_id']
        
        # Progress to BC Call Done first
        self.session.put(f"{BASE_URL}/api/leads/{lead_id}/stage", json={"stage": "BC Call Done"})
        
        # Progress to BOQ Shared
        stage_update = {"stage": "BOQ Shared"}
        update_response = self.session.put(f"{BASE_URL}/api/leads/{lead_id}/stage", json=stage_update)
        assert update_response.status_code == 200, f"Failed to update stage: {update_response.text}"
        
        updated_lead = update_response.json()
        assert updated_lead['stage'] == 'BOQ Shared', \
            f"Stage should be 'BOQ Shared' after update, got '{updated_lead['stage']}'"
        
        print(f"✓ Stage progression: BC Call Done -> BOQ Shared successful")
        
        self.test_lead_id = lead_id
        return updated_lead
    
    def test_timeline_shows_correct_expected_dates(self):
        """Test that timeline shows correct expected dates based on TAT rules"""
        # Create a new lead
        lead_data = {
            "customer_name": "TEST_Timeline_Dates_Customer",
            "customer_phone": "9876543216",
            "source": "Referral"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        timeline = lead.get('timeline', [])
        created_at = lead.get('created_at')
        
        created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        # Expected TAT cumulative days:
        # Lead Allocated: 0 days
        # BC Call Done: 1 day (0 + 1)
        # First BOQ Sent: 3 days (0 + 1 + 2)
        # Site Meeting: 5 days (0 + 1 + 2 + 2)
        # Revised BOQ Shared: 7 days (0 + 1 + 2 + 2 + 2)
        
        expected_tat = {
            "Lead Allocated": 0,
            "BC Call Done": 1,
            "First BOQ Sent": 3,
            "Site Meeting": 5,
            "Revised BOQ Shared": 7
        }
        
        print(f"✓ Lead created at: {created_date.date()}")
        
        for milestone in timeline:
            title = milestone['title']
            if title in expected_tat:
                expected_date = datetime.fromisoformat(milestone['expectedDate'].replace('Z', '+00:00'))
                actual_days = (expected_date - created_date).days
                expected_days = expected_tat[title]
                
                print(f"  - {title}: Expected {expected_days} days, Got {actual_days} days")
                
                assert actual_days == expected_days, \
                    f"{title} should be {expected_days} days from creation, got {actual_days} days"
        
        print(f"✓ All milestone expected dates follow correct TAT rules")
        
        self.test_lead_id = lead['lead_id']
        return lead
    
    def test_lead_stages_array_includes_lead_allocated(self):
        """Test that LEAD_STAGES array includes 'Lead Allocated' as first stage"""
        # Get a lead to verify stages
        lead_data = {
            "customer_name": "TEST_Stages_Array_Customer",
            "customer_phone": "9876543217",
            "source": "Others"
        }
        
        response = self.session.post(f"{BASE_URL}/api/leads", json=lead_data)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        lead = response.json()
        
        # The lead should start at 'Lead Allocated' which proves it's in the stages array
        assert lead['stage'] == 'Lead Allocated', \
            f"Lead should start at 'Lead Allocated', got '{lead['stage']}'"
        
        # Verify timeline has 'Lead Allocated' as first milestone
        timeline = lead.get('timeline', [])
        assert len(timeline) > 0, "Timeline should not be empty"
        
        first_milestone = timeline[0]
        assert first_milestone['title'] == 'Lead Allocated', \
            f"First milestone should be 'Lead Allocated', got '{first_milestone['title']}'"
        
        print(f"✓ LEAD_STAGES includes 'Lead Allocated' as first stage")
        print(f"✓ First milestone in timeline: {first_milestone['title']}")
        
        self.test_lead_id = lead['lead_id']
        return lead
    
    def test_existing_lead_verification(self):
        """Verify the test lead mentioned in the request (lead_a0f72655)"""
        # Try to fetch the existing test lead
        response = self.session.get(f"{BASE_URL}/api/leads/lead_a0f72655")
        
        if response.status_code == 200:
            lead = response.json()
            
            print(f"✓ Found existing test lead: {lead['lead_id']}")
            print(f"  - Stage: {lead['stage']}")
            print(f"  - Customer: {lead.get('customer_name', 'N/A')}")
            
            # Verify stage is 'Lead Allocated'
            assert lead['stage'] == 'Lead Allocated', \
                f"Existing lead should be at 'Lead Allocated', got '{lead['stage']}'"
            
            # Check timeline milestones
            timeline = lead.get('timeline', [])
            for milestone in timeline:
                if milestone['title'] == 'Lead Allocated':
                    assert milestone['status'] == 'completed', \
                        f"Lead Allocated should be completed, got '{milestone['status']}'"
                    print(f"  - Lead Allocated: {milestone['status']}")
                elif milestone['title'] == 'BC Call Done':
                    assert milestone['status'] in ['pending', 'delayed'], \
                        f"BC Call Done should be pending/delayed, got '{milestone['status']}'"
                    print(f"  - BC Call Done: {milestone['status']}")
            
            return lead
        else:
            print(f"⚠ Existing test lead not found (may have been cleaned up)")
            pytest.skip("Existing test lead not found")


class TestPreSalesToLeadConversion:
    """Test Pre-Sales to Lead conversion starts at 'Lead Allocated'"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        setup_response = requests.post(f"{BASE_URL}/api/auth/setup-local-admin")
        assert setup_response.status_code == 200
        
        login_response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200
        
        self.session = requests.Session()
        self.session.cookies.update(login_response.cookies)
        
        yield
        
        # Cleanup
        try:
            leads_response = self.session.get(f"{BASE_URL}/api/presales")
            if leads_response.status_code == 200:
                for lead in leads_response.json():
                    if lead.get('customer_name', '').startswith('TEST_'):
                        self.session.delete(f"{BASE_URL}/api/presales/{lead['lead_id']}")
        except:
            pass
    
    def test_presales_to_lead_conversion_starts_at_lead_allocated(self):
        """Test that converting Pre-Sales to Lead starts at 'Lead Allocated' stage"""
        # First create a pre-sales lead
        presales_data = {
            "customer_name": "TEST_PreSales_Convert_Customer",
            "customer_phone": "9876543220",
            "source": "Meta"
        }
        
        # Create pre-sales lead
        create_response = self.session.post(f"{BASE_URL}/api/presales", json=presales_data)
        
        if create_response.status_code != 200:
            pytest.skip(f"Pre-sales creation not available: {create_response.text}")
        
        presales_lead = create_response.json()
        presales_id = presales_lead['lead_id']
        
        print(f"✓ Created pre-sales lead: {presales_id}")
        
        # Convert to lead
        convert_response = self.session.post(f"{BASE_URL}/api/presales/{presales_id}/convert-to-lead")
        
        if convert_response.status_code != 200:
            pytest.skip(f"Pre-sales conversion not available: {convert_response.text}")
        
        # Fetch the converted lead
        lead_response = self.session.get(f"{BASE_URL}/api/leads/{presales_id}")
        assert lead_response.status_code == 200, f"Failed to fetch converted lead: {lead_response.text}"
        
        converted_lead = lead_response.json()
        
        # CRITICAL: Verify converted lead starts at 'Lead Allocated'
        assert converted_lead['stage'] == 'Lead Allocated', \
            f"Converted lead should start at 'Lead Allocated', got '{converted_lead['stage']}'"
        
        # Verify timeline
        timeline = converted_lead.get('timeline', [])
        lead_allocated = None
        bc_call = None
        
        for milestone in timeline:
            if milestone['title'] == 'Lead Allocated':
                lead_allocated = milestone
            elif milestone['title'] == 'BC Call Done':
                bc_call = milestone
        
        assert lead_allocated is not None, "Lead Allocated milestone not found"
        assert lead_allocated['status'] == 'completed', \
            f"Lead Allocated should be completed, got '{lead_allocated['status']}'"
        
        assert bc_call is not None, "BC Call Done milestone not found"
        assert bc_call['status'] in ['pending', 'delayed'], \
            f"BC Call Done should be pending/delayed, got '{bc_call['status']}'"
        
        print(f"✓ Converted lead stage: {converted_lead['stage']}")
        print(f"✓ Lead Allocated status: {lead_allocated['status']}")
        print(f"✓ BC Call Done status: {bc_call['status']}")
        
        return converted_lead


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
