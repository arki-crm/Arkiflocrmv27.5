"""
Test suite for Leads Hold Status Filter feature
Tests the hold_status query parameter on GET /api/leads endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeadsHoldStatusFilter:
    """Tests for leads hold_status filter functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Setup local admin
        setup_response = self.session.post(f"{BASE_URL}/api/auth/setup-local-admin")
        assert setup_response.status_code == 200
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200
        
        # Store session token
        self.session_token = self.session.cookies.get("session_token")
        if self.session_token:
            self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
    
    def test_leads_without_hold_status_filter(self):
        """Test GET /api/leads without hold_status filter returns all leads"""
        response = self.session.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        print(f"Total leads without filter: {len(leads)}")
    
    def test_leads_with_hold_status_all(self):
        """Test GET /api/leads?hold_status=all returns all leads"""
        response = self.session.get(f"{BASE_URL}/api/leads?hold_status=all")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        print(f"Total leads with hold_status=all: {len(leads)}")
    
    def test_leads_with_hold_status_active(self):
        """Test GET /api/leads?hold_status=Active returns only active leads"""
        response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Active")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        
        # Verify all returned leads are Active (or have no hold_status set)
        for lead in leads:
            hold_status = lead.get("hold_status")
            assert hold_status in [None, "Active"], f"Expected Active or null, got {hold_status}"
        
        print(f"Active leads count: {len(leads)}")
    
    def test_leads_with_hold_status_hold(self):
        """Test GET /api/leads?hold_status=Hold returns only leads on hold"""
        response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Hold")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        
        # Verify all returned leads have hold_status=Hold
        for lead in leads:
            assert lead.get("hold_status") == "Hold", f"Expected Hold, got {lead.get('hold_status')}"
        
        print(f"On Hold leads count: {len(leads)}")
    
    def test_leads_with_hold_status_deactivated(self):
        """Test GET /api/leads?hold_status=Deactivated returns only deactivated leads"""
        response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Deactivated")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        
        # Verify all returned leads have hold_status=Deactivated
        for lead in leads:
            assert lead.get("hold_status") == "Deactivated", f"Expected Deactivated, got {lead.get('hold_status')}"
        
        print(f"Deactivated leads count: {len(leads)}")
    
    def test_hold_status_filter_counts_match(self):
        """Test that Active + Hold + Deactivated counts equal total leads"""
        # Get all leads
        all_response = self.session.get(f"{BASE_URL}/api/leads")
        assert all_response.status_code == 200
        all_leads = all_response.json()
        
        # Get active leads
        active_response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Active")
        assert active_response.status_code == 200
        active_leads = active_response.json()
        
        # Get hold leads
        hold_response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Hold")
        assert hold_response.status_code == 200
        hold_leads = hold_response.json()
        
        # Get deactivated leads
        deactivated_response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Deactivated")
        assert deactivated_response.status_code == 200
        deactivated_leads = deactivated_response.json()
        
        # Verify counts
        total = len(all_leads)
        sum_filtered = len(active_leads) + len(hold_leads) + len(deactivated_leads)
        
        print(f"Total: {total}, Active: {len(active_leads)}, Hold: {len(hold_leads)}, Deactivated: {len(deactivated_leads)}")
        assert total == sum_filtered, f"Total ({total}) != Active ({len(active_leads)}) + Hold ({len(hold_leads)}) + Deactivated ({len(deactivated_leads)})"
    
    def test_hold_status_combined_with_other_filters(self):
        """Test hold_status filter works with other filters like time_filter"""
        # Test with time_filter
        response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Active&time_filter=this_month")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        
        # Verify all returned leads are Active
        for lead in leads:
            hold_status = lead.get("hold_status")
            assert hold_status in [None, "Active"], f"Expected Active or null, got {hold_status}"
        
        print(f"Active leads this month: {len(leads)}")
    
    def test_hold_status_combined_with_sort(self):
        """Test hold_status filter works with sorting"""
        response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Active&sort_by=created_at&sort_order=desc")
        assert response.status_code == 200
        
        leads = response.json()
        assert isinstance(leads, list)
        
        # Verify all returned leads are Active
        for lead in leads:
            hold_status = lead.get("hold_status")
            assert hold_status in [None, "Active"], f"Expected Active or null, got {hold_status}"
        
        print(f"Active leads sorted by created_at desc: {len(leads)}")


class TestLeadHoldStatusUpdate:
    """Tests for updating lead hold status"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Setup local admin
        setup_response = self.session.post(f"{BASE_URL}/api/auth/setup-local-admin")
        assert setup_response.status_code == 200
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "thaha.pakayil@gmail.com", "password": "password123"}
        )
        assert login_response.status_code == 200
        
        # Store session token
        self.session_token = self.session.cookies.get("session_token")
        if self.session_token:
            self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
    
    def test_put_lead_on_hold(self):
        """Test PUT /api/leads/{lead_id}/hold-status to put lead on hold"""
        # First create a test lead
        create_response = self.session.post(
            f"{BASE_URL}/api/leads",
            json={
                "customer_name": "TEST_HoldTest",
                "customer_phone": "1234567890",
                "source": "Others",
                "status": "In Progress"
            }
        )
        assert create_response.status_code == 200
        lead = create_response.json()
        lead_id = lead["lead_id"]
        
        # Put lead on hold
        hold_response = self.session.put(
            f"{BASE_URL}/api/leads/{lead_id}/hold-status",
            json={"action": "Hold", "reason": "Testing hold functionality"}
        )
        assert hold_response.status_code == 200
        
        updated_lead = hold_response.json()
        assert updated_lead["hold_status"] == "Hold"
        
        # Verify lead appears in Hold filter
        filter_response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Hold")
        assert filter_response.status_code == 200
        hold_leads = filter_response.json()
        
        lead_ids = [l["lead_id"] for l in hold_leads]
        assert lead_id in lead_ids, "Lead should appear in Hold filter"
        
        print(f"Lead {lead_id} successfully put on hold")
    
    def test_activate_lead_from_hold(self):
        """Test PUT /api/leads/{lead_id}/hold-status to activate lead from hold"""
        # First create a test lead
        create_response = self.session.post(
            f"{BASE_URL}/api/leads",
            json={
                "customer_name": "TEST_ActivateTest",
                "customer_phone": "1234567891",
                "source": "Others",
                "status": "In Progress"
            }
        )
        assert create_response.status_code == 200
        lead = create_response.json()
        lead_id = lead["lead_id"]
        
        # Put lead on hold first
        hold_response = self.session.put(
            f"{BASE_URL}/api/leads/{lead_id}/hold-status",
            json={"action": "Hold", "reason": "Testing"}
        )
        assert hold_response.status_code == 200
        
        # Activate the lead
        activate_response = self.session.put(
            f"{BASE_URL}/api/leads/{lead_id}/hold-status",
            json={"action": "Activate", "reason": "Testing activation"}
        )
        assert activate_response.status_code == 200
        
        updated_lead = activate_response.json()
        assert updated_lead["hold_status"] == "Active"
        
        # Verify lead appears in Active filter
        filter_response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Active")
        assert filter_response.status_code == 200
        active_leads = filter_response.json()
        
        lead_ids = [l["lead_id"] for l in active_leads]
        assert lead_id in lead_ids, "Lead should appear in Active filter"
        
        print(f"Lead {lead_id} successfully activated")
    
    def test_deactivate_lead(self):
        """Test PUT /api/leads/{lead_id}/hold-status to deactivate lead"""
        # First create a test lead
        create_response = self.session.post(
            f"{BASE_URL}/api/leads",
            json={
                "customer_name": "TEST_DeactivateTest",
                "customer_phone": "1234567892",
                "source": "Others",
                "status": "In Progress"
            }
        )
        assert create_response.status_code == 200
        lead = create_response.json()
        lead_id = lead["lead_id"]
        
        # Deactivate the lead
        deactivate_response = self.session.put(
            f"{BASE_URL}/api/leads/{lead_id}/hold-status",
            json={"action": "Deactivate", "reason": "Testing deactivation"}
        )
        assert deactivate_response.status_code == 200
        
        updated_lead = deactivate_response.json()
        assert updated_lead["hold_status"] == "Deactivated"
        
        # Verify lead appears in Deactivated filter
        filter_response = self.session.get(f"{BASE_URL}/api/leads?hold_status=Deactivated")
        assert filter_response.status_code == 200
        deactivated_leads = filter_response.json()
        
        lead_ids = [l["lead_id"] for l in deactivated_leads]
        assert lead_id in lead_ids, "Lead should appear in Deactivated filter"
        
        print(f"Lead {lead_id} successfully deactivated")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
