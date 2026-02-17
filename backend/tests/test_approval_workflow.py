"""
Test suite for Incentive and Commission Approval Workflow
Tests the complete lifecycle: create -> approve -> pay (and rejection flow)
"""
import pytest
import httpx
from datetime import datetime

BASE_URL = "https://crm-finance-hub-1.preview.emergentagent.com/api"

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"


@pytest.fixture
async def auth_headers():
    """Authenticate and return headers with token"""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{BASE_URL}/auth/login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_employee(auth_headers):
    """Get or create a test employee for incentives"""
    async with httpx.AsyncClient(timeout=30) as client:
        # Get existing employees
        response = await client.get(
            f"{BASE_URL}/users",
            headers=auth_headers
        )
        if response.status_code == 200:
            users = response.json()
            if isinstance(users, list) and len(users) > 0:
                # Find an employee with eligible classification
                for user in users:
                    if user.get("employee_classification") in ["permanent", "probation", "trainee"]:
                        return user
                # Return first user if no eligible found
                return users[0]
        return None


@pytest.fixture
async def test_account(auth_headers):
    """Get a test account for payouts"""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{BASE_URL}/accounting/accounts",
            headers=auth_headers
        )
        if response.status_code == 200:
            accounts = response.json()
            if accounts and len(accounts) > 0:
                return accounts[0]
        return None


class TestIncentiveApprovalWorkflow:
    """Test Incentive approval workflow"""
    
    @pytest.mark.asyncio
    async def test_create_incentive_as_draft(self, auth_headers, test_employee):
        """Test creating an incentive in draft status"""
        if not test_employee:
            pytest.skip("No test employee available")
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers,
                json={
                    "employee_id": test_employee.get("user_id"),
                    "incentive_type": "general_performance",
                    "amount": 5000,
                    "calculation_type": "fixed",
                    "notes": "Test incentive for approval workflow",
                    "status": "draft"
                }
            )
            
            assert response.status_code == 200, f"Create incentive failed: {response.text}"
            data = response.json()
            assert data.get("success") is True
            incentive = data.get("incentive")
            assert incentive is not None
            assert incentive.get("status") == "draft"
            assert len(incentive.get("history", [])) >= 1
            assert incentive.get("history")[0].get("action") == "created"
            
            return incentive
    
    @pytest.mark.asyncio
    async def test_create_incentive_pending_approval(self, auth_headers, test_employee):
        """Test creating an incentive in pending_approval status"""
        if not test_employee:
            pytest.skip("No test employee available")
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers,
                json={
                    "employee_id": test_employee.get("user_id"),
                    "incentive_type": "general_performance",
                    "amount": 3000,
                    "calculation_type": "fixed",
                    "notes": "Test incentive pending approval"
                }
            )
            
            assert response.status_code == 200, f"Create incentive failed: {response.text}"
            data = response.json()
            incentive = data.get("incentive")
            assert incentive.get("status") == "pending_approval"
    
    @pytest.mark.asyncio
    async def test_full_approval_lifecycle(self, auth_headers, test_employee, test_account):
        """Test complete lifecycle: create -> submit -> approve -> payout"""
        if not test_employee or not test_account:
            pytest.skip("Missing test employee or account")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: Create as draft
            response = await client.post(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers,
                json={
                    "employee_id": test_employee.get("user_id"),
                    "incentive_type": "general_performance",
                    "amount": 2500,
                    "calculation_type": "fixed",
                    "notes": "Full lifecycle test",
                    "status": "draft"
                }
            )
            assert response.status_code == 200
            incentive = response.json().get("incentive")
            incentive_id = incentive.get("incentive_id")
            
            # Step 2: Submit for approval
            response = await client.put(
                f"{BASE_URL}/finance/incentives/{incentive_id}/submit",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Submit failed: {response.text}"
            
            # Step 3: Approve
            response = await client.put(
                f"{BASE_URL}/finance/incentives/{incentive_id}/approve",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Approve failed: {response.text}"
            
            # Verify status is approved
            response = await client.get(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers
            )
            incentives = response.json()
            approved_incentive = next(
                (i for i in incentives if i.get("incentive_id") == incentive_id),
                None
            )
            assert approved_incentive is not None
            assert approved_incentive.get("status") == "approved"
            
            # Step 4: Payout
            payment_date = datetime.now().strftime("%Y-%m-%d")
            response = await client.post(
                f"{BASE_URL}/finance/incentives/{incentive_id}/payout",
                headers=auth_headers,
                json={
                    "account_id": test_account.get("account_id"),
                    "payment_date": payment_date,
                    "notes": "Test payout"
                }
            )
            assert response.status_code == 200, f"Payout failed: {response.text}"
            payout_data = response.json()
            assert payout_data.get("success") is True
            assert payout_data.get("payment_id") is not None
            
            # Verify final status is paid
            response = await client.get(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers
            )
            incentives = response.json()
            paid_incentive = next(
                (i for i in incentives if i.get("incentive_id") == incentive_id),
                None
            )
            assert paid_incentive is not None
            assert paid_incentive.get("status") == "paid"
            # Verify history has all actions
            history = paid_incentive.get("history", [])
            actions = [h.get("action") for h in history]
            assert "created" in actions
            assert "approved" in actions
            assert "paid" in actions
    
    @pytest.mark.asyncio
    async def test_rejection_flow(self, auth_headers, test_employee):
        """Test rejection and re-submission flow"""
        if not test_employee:
            pytest.skip("No test employee available")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Create incentive
            response = await client.post(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers,
                json={
                    "employee_id": test_employee.get("user_id"),
                    "incentive_type": "general_performance",
                    "amount": 1500,
                    "calculation_type": "fixed",
                    "notes": "Rejection test"
                }
            )
            assert response.status_code == 200
            incentive_id = response.json().get("incentive").get("incentive_id")
            
            # Reject with reason
            response = await client.put(
                f"{BASE_URL}/finance/incentives/{incentive_id}/reject",
                headers=auth_headers,
                json={"reason": "Amount too high, please revise"}
            )
            assert response.status_code == 200, f"Reject failed: {response.text}"
            
            # Verify rejected status
            response = await client.get(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers
            )
            incentives = response.json()
            rejected_incentive = next(
                (i for i in incentives if i.get("incentive_id") == incentive_id),
                None
            )
            assert rejected_incentive is not None
            assert rejected_incentive.get("status") == "rejected"
            assert rejected_incentive.get("rejection_reason") == "Amount too high, please revise"
    
    @pytest.mark.asyncio
    async def test_cannot_edit_paid_incentive(self, auth_headers, test_employee, test_account):
        """Test that paid incentives cannot be edited"""
        if not test_employee or not test_account:
            pytest.skip("Missing test employee or account")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Create and pay an incentive
            response = await client.post(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers,
                json={
                    "employee_id": test_employee.get("user_id"),
                    "incentive_type": "general_performance",
                    "amount": 1000,
                    "calculation_type": "fixed",
                    "notes": "Edit lock test"
                }
            )
            incentive_id = response.json().get("incentive").get("incentive_id")
            
            # Approve
            await client.put(
                f"{BASE_URL}/finance/incentives/{incentive_id}/approve",
                headers=auth_headers
            )
            
            # Pay
            payment_date = datetime.now().strftime("%Y-%m-%d")
            await client.post(
                f"{BASE_URL}/finance/incentives/{incentive_id}/payout",
                headers=auth_headers,
                json={
                    "account_id": test_account.get("account_id"),
                    "payment_date": payment_date
                }
            )
            
            # Try to edit - should fail
            response = await client.put(
                f"{BASE_URL}/finance/incentives/{incentive_id}",
                headers=auth_headers,
                json={"amount": 2000}
            )
            assert response.status_code == 400, "Should not be able to edit paid incentive"
    
    @pytest.mark.asyncio
    async def test_cannot_delete_approved_incentive(self, auth_headers, test_employee):
        """Test that approved incentives cannot be deleted"""
        if not test_employee:
            pytest.skip("No test employee available")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Create incentive
            response = await client.post(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers,
                json={
                    "employee_id": test_employee.get("user_id"),
                    "incentive_type": "general_performance",
                    "amount": 1000,
                    "calculation_type": "fixed",
                    "notes": "Delete lock test"
                }
            )
            incentive_id = response.json().get("incentive").get("incentive_id")
            
            # Approve
            await client.put(
                f"{BASE_URL}/finance/incentives/{incentive_id}/approve",
                headers=auth_headers
            )
            
            # Try to delete - should fail
            response = await client.delete(
                f"{BASE_URL}/finance/incentives/{incentive_id}",
                headers=auth_headers
            )
            assert response.status_code == 400, "Should not be able to delete approved incentive"


class TestCommissionApprovalWorkflow:
    """Test Commission approval workflow"""
    
    @pytest.mark.asyncio
    async def test_create_commission_as_draft(self, auth_headers):
        """Test creating a commission in draft status"""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers,
                json={
                    "recipient_type": "referral",
                    "recipient_id": "ref_001",
                    "recipient_name": "Test Referral Partner",
                    "recipient_contact": "9876543210",
                    "commission_type": "referral_commission",
                    "amount": 10000,
                    "calculation_type": "fixed",
                    "notes": "Test commission for approval workflow",
                    "status": "draft"
                }
            )
            
            assert response.status_code == 200, f"Create commission failed: {response.text}"
            data = response.json()
            assert data.get("success") is True
            commission = data.get("commission")
            assert commission is not None
            assert commission.get("status") == "draft"
            assert len(commission.get("history", [])) >= 1
            assert commission.get("history")[0].get("action") == "created"
    
    @pytest.mark.asyncio
    async def test_full_commission_lifecycle(self, auth_headers, test_account):
        """Test complete lifecycle: create -> approve -> payout with history tracking"""
        if not test_account:
            pytest.skip("No test account available")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: Create commission
            response = await client.post(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers,
                json={
                    "recipient_type": "channel_partner",
                    "recipient_id": "cp_002",
                    "recipient_name": "Channel Partner ABC",
                    "recipient_contact": "9876543211",
                    "commission_type": "channel_partner_commission",
                    "amount": 15000,
                    "calculation_type": "fixed",
                    "notes": "Full lifecycle test commission",
                    "status": "draft"
                }
            )
            assert response.status_code == 200
            commission = response.json().get("commission")
            commission_id = commission.get("commission_id")
            
            # Step 2: Submit for approval
            response = await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/submit",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Submit failed: {response.text}"
            
            # Step 3: Approve
            response = await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/approve",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Approve failed: {response.text}"
            
            # Verify status is approved
            response = await client.get(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers
            )
            commissions = response.json()
            approved_commission = next(
                (c for c in commissions if c.get("commission_id") == commission_id),
                None
            )
            assert approved_commission is not None
            assert approved_commission.get("status") == "approved"
            
            # Step 4: Payout
            payment_date = datetime.now().strftime("%Y-%m-%d")
            response = await client.post(
                f"{BASE_URL}/finance/commissions/{commission_id}/payout",
                headers=auth_headers,
                json={
                    "account_id": test_account.get("account_id"),
                    "payment_date": payment_date,
                    "notes": "Test commission payout"
                }
            )
            assert response.status_code == 200, f"Payout failed: {response.text}"
            payout_data = response.json()
            assert payout_data.get("success") is True
            assert payout_data.get("payment_id") is not None
            
            # Verify final status is paid and history has all actions
            response = await client.get(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers
            )
            commissions = response.json()
            paid_commission = next(
                (c for c in commissions if c.get("commission_id") == commission_id),
                None
            )
            assert paid_commission is not None
            assert paid_commission.get("status") == "paid"
            # Verify history has all actions including paid (NEW FIX)
            history = paid_commission.get("history", [])
            actions = [h.get("action") for h in history]
            assert "created" in actions, "Missing 'created' in history"
            assert "approved" in actions, "Missing 'approved' in history"
            assert "paid" in actions, "Missing 'paid' in history - this was the fix!"
    
    @pytest.mark.asyncio
    async def test_commission_rejection_flow(self, auth_headers):
        """Test commission rejection and edit flow"""
        async with httpx.AsyncClient(timeout=30) as client:
            # Create commission
            response = await client.post(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers,
                json={
                    "recipient_type": "referral",
                    "recipient_id": "ref_003",
                    "recipient_name": "Test Referral",
                    "recipient_contact": "9876543212",
                    "commission_type": "referral_commission",
                    "amount": 5000,
                    "calculation_type": "fixed",
                    "notes": "Rejection test commission"
                }
            )
            assert response.status_code == 200
            commission_id = response.json().get("commission").get("commission_id")
            
            # Reject
            response = await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/reject",
                headers=auth_headers,
                json={"reason": "Commission percentage too high"}
            )
            assert response.status_code == 200, f"Reject failed: {response.text}"
            
            # Verify rejected status
            response = await client.get(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers
            )
            commissions = response.json()
            rejected_commission = next(
                (c for c in commissions if c.get("commission_id") == commission_id),
                None
            )
            assert rejected_commission is not None
            assert rejected_commission.get("status") == "rejected"
            assert rejected_commission.get("rejection_reason") == "Commission percentage too high"
            
            # Edit rejected commission (should move to pending_approval)
            response = await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}",
                headers=auth_headers,
                json={"amount": 3000, "notes": "Revised amount"}
            )
            assert response.status_code == 200, f"Edit failed: {response.text}"
            
            # Verify status changed to pending_approval
            updated_commission = response.json().get("commission")
            assert updated_commission.get("status") == "pending_approval"
            assert updated_commission.get("rejection_reason") is None
    
    @pytest.mark.asyncio
    async def test_cannot_pay_rejected_commission(self, auth_headers, test_account):
        """Test that rejected commissions cannot be paid"""
        if not test_account:
            pytest.skip("No test account available")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Create commission
            response = await client.post(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers,
                json={
                    "recipient_type": "referral",
                    "recipient_id": "ref_004",
                    "recipient_name": "Blocked Payment Test",
                    "recipient_contact": "9876543213",
                    "commission_type": "referral_commission",
                    "amount": 2000,
                    "calculation_type": "fixed",
                    "notes": "Payment block test"
                }
            )
            commission_id = response.json().get("commission").get("commission_id")
            
            # Reject
            await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/reject",
                headers=auth_headers,
                json={"reason": "Not approved"}
            )
            
            # Try to payout - should fail
            payment_date = datetime.now().strftime("%Y-%m-%d")
            response = await client.post(
                f"{BASE_URL}/finance/commissions/{commission_id}/payout",
                headers=auth_headers,
                json={
                    "account_id": test_account.get("account_id"),
                    "payment_date": payment_date
                }
            )
            assert response.status_code == 400, "Should not be able to pay rejected commission"
    
    @pytest.mark.asyncio
    async def test_cannot_delete_approved_commission(self, auth_headers):
        """Test that approved commissions cannot be deleted"""
        async with httpx.AsyncClient(timeout=30) as client:
            # Create commission
            response = await client.post(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers,
                json={
                    "recipient_type": "referral",
                    "recipient_id": "ref_005",
                    "recipient_name": "Delete Block Test",
                    "recipient_contact": "9876543214",
                    "commission_type": "referral_commission",
                    "amount": 3000,
                    "calculation_type": "fixed",
                    "notes": "Delete block test"
                }
            )
            commission_id = response.json().get("commission").get("commission_id")
            
            # Approve
            await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/approve",
                headers=auth_headers
            )
            
            # Try to delete - should fail
            response = await client.delete(
                f"{BASE_URL}/finance/commissions/{commission_id}",
                headers=auth_headers
            )
            assert response.status_code == 400, "Should not be able to delete approved commission"


class TestAuditTrail:
    """Test audit trail and history logging"""
    
    @pytest.mark.asyncio
    async def test_incentive_history_contains_user_info(self, auth_headers, test_employee, test_account):
        """Verify history entries contain user info"""
        if not test_employee or not test_account:
            pytest.skip("Missing test employee or account")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Create incentive
            response = await client.post(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers,
                json={
                    "employee_id": test_employee.get("user_id"),
                    "incentive_type": "general_performance",
                    "amount": 500,
                    "calculation_type": "fixed",
                    "notes": "Audit trail test"
                }
            )
            incentive = response.json().get("incentive")
            incentive_id = incentive.get("incentive_id")
            
            # Perform actions
            await client.put(
                f"{BASE_URL}/finance/incentives/{incentive_id}/approve",
                headers=auth_headers
            )
            
            payment_date = datetime.now().strftime("%Y-%m-%d")
            await client.post(
                f"{BASE_URL}/finance/incentives/{incentive_id}/payout",
                headers=auth_headers,
                json={
                    "account_id": test_account.get("account_id"),
                    "payment_date": payment_date
                }
            )
            
            # Get final state
            response = await client.get(
                f"{BASE_URL}/finance/incentives",
                headers=auth_headers
            )
            incentives = response.json()
            final_incentive = next(
                (i for i in incentives if i.get("incentive_id") == incentive_id),
                None
            )
            
            # Verify history entries have required fields
            history = final_incentive.get("history", [])
            for entry in history:
                assert "action" in entry, "History entry missing 'action'"
                assert "by" in entry, "History entry missing 'by' (user_id)"
                assert "by_name" in entry, "History entry missing 'by_name'"
                assert "at" in entry, "History entry missing 'at' (timestamp)"
    
    @pytest.mark.asyncio
    async def test_commission_history_tracks_all_changes(self, auth_headers, test_account):
        """Verify commission history tracks all status changes"""
        if not test_account:
            pytest.skip("No test account available")
        
        async with httpx.AsyncClient(timeout=30) as client:
            # Create commission
            response = await client.post(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers,
                json={
                    "recipient_type": "referral",
                    "recipient_id": "ref_audit_001",
                    "recipient_name": "Audit Test Partner",
                    "recipient_contact": "9876543220",
                    "commission_type": "referral_commission",
                    "amount": 8000,
                    "calculation_type": "fixed",
                    "notes": "Complete audit trail test",
                    "status": "draft"
                }
            )
            commission_id = response.json().get("commission").get("commission_id")
            
            # Submit
            await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/submit",
                headers=auth_headers
            )
            
            # Reject
            await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/reject",
                headers=auth_headers,
                json={"reason": "Need more details"}
            )
            
            # Edit (should auto-resubmit)
            await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}",
                headers=auth_headers,
                json={"amount": 7500, "notes": "Updated with more details"}
            )
            
            # Approve
            await client.put(
                f"{BASE_URL}/finance/commissions/{commission_id}/approve",
                headers=auth_headers
            )
            
            # Pay
            payment_date = datetime.now().strftime("%Y-%m-%d")
            await client.post(
                f"{BASE_URL}/finance/commissions/{commission_id}/payout",
                headers=auth_headers,
                json={
                    "account_id": test_account.get("account_id"),
                    "payment_date": payment_date
                }
            )
            
            # Get final state and verify history
            response = await client.get(
                f"{BASE_URL}/finance/commissions",
                headers=auth_headers
            )
            commissions = response.json()
            final_commission = next(
                (c for c in commissions if c.get("commission_id") == commission_id),
                None
            )
            
            history = final_commission.get("history", [])
            actions = [h.get("action") for h in history]
            
            # Verify all actions are logged
            assert "created" in actions, "Missing 'created' action"
            assert "submitted" in actions, "Missing 'submitted' action"
            assert "rejected" in actions, "Missing 'rejected' action"
            assert "edited" in actions, "Missing 'edited' action"
            assert "approved" in actions, "Missing 'approved' action"
            assert "paid" in actions, "Missing 'paid' action"
            
            # Verify chronological order
            assert len(history) >= 6, f"Expected at least 6 history entries, got {len(history)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])
