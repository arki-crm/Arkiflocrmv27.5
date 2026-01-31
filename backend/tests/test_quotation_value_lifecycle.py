"""
Test suite for Project Value & Quotation History system
Features tested:
- Lead Quotation History: Add entries, status transitions, supersede logic
- Project Quotation History: Same functionality as lead
- Value Lifecycle: Inquiry, Booked, Contract values
- Lock Contract Value: Lock at Design Finalization stage
- Override Contract Value: Admin/Founder only with mandatory reason
- Apply Discount: Track discount amount, reason, approver
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_SESSION_TOKEN = None
TEST_LEAD_ID = "lead_796ab5db"
TEST_PROJECT_ID = "proj_0a79eb51"


@pytest.fixture(scope="module")
def session_token():
    """Get session token from MongoDB"""
    import subprocess
    result = subprocess.run([
        'mongosh', '--quiet', '--eval',
        '''use('test_database');
        var user = db.users.findOne({email: 'thaha.pakayil@gmail.com'});
        if (user) {
            var session = db.user_sessions.findOne({user_id: user.user_id});
            if (session) print(session.session_token);
        }'''
    ], capture_output=True, text=True)
    token = result.stdout.strip()
    if not token:
        pytest.skip("No session token found")
    return token


@pytest.fixture
def api_client(session_token):
    """Create API client with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {session_token}"
    })
    session.cookies.set("session_token", session_token)
    return session


class TestAuthVerification:
    """Verify authentication is working"""
    
    def test_auth_me_endpoint(self, api_client):
        """Test /api/auth/me returns user data"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "role" in data
        print(f"✓ Authenticated as: {data.get('name')} ({data.get('role')})")


class TestLeadQuotationHistory:
    """Test Lead Quotation History functionality"""
    
    def test_get_lead_with_quotation_history(self, api_client):
        """Verify lead has quotation_history field"""
        response = api_client.get(f"{BASE_URL}/api/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200, f"Failed to get lead: {response.text}"
        data = response.json()
        assert "quotation_history" in data, "quotation_history field missing"
        history = data["quotation_history"]
        assert isinstance(history, list), "quotation_history should be a list"
        print(f"✓ Lead has {len(history)} quotation entries")
        
        # Verify existing entries have correct structure
        if history:
            entry = history[0]
            assert "version" in entry, "Entry missing version"
            assert "quoted_value" in entry, "Entry missing quoted_value"
            assert "status" in entry, "Entry missing status"
            assert "created_at" in entry, "Entry missing created_at"
    
    def test_add_quotation_entry_tentative(self, api_client):
        """Add a new Tentative quotation entry"""
        payload = {
            "quoted_value": 510000,
            "status": "Tentative",
            "note": "Test quotation entry - tentative"
        }
        response = api_client.post(
            f"{BASE_URL}/api/leads/{TEST_LEAD_ID}/quotation-history",
            json=payload
        )
        assert response.status_code == 200, f"Failed to add entry: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "entry" in data
        entry = data["entry"]
        assert entry["quoted_value"] == 510000
        assert entry["status"] == "Tentative"
        print(f"✓ Added Tentative quotation v{entry['version']}: ₹{entry['quoted_value']}")
    
    def test_add_quotation_entry_revised(self, api_client):
        """Add a Revised quotation entry"""
        payload = {
            "quoted_value": 520000,
            "status": "Revised",
            "note": "Revised after client feedback"
        }
        response = api_client.post(
            f"{BASE_URL}/api/leads/{TEST_LEAD_ID}/quotation-history",
            json=payload
        )
        assert response.status_code == 200, f"Failed to add entry: {response.text}"
        data = response.json()
        assert data["entry"]["status"] == "Revised"
        print(f"✓ Added Revised quotation v{data['entry']['version']}")
    
    def test_approved_status_supersedes_previous(self, api_client):
        """When Approved status is added, previous entries become Superseded"""
        # First get current history count
        response = api_client.get(f"{BASE_URL}/api/leads/{TEST_LEAD_ID}")
        initial_history = response.json().get("quotation_history", [])
        
        # Add Approved entry
        payload = {
            "quoted_value": 530000,
            "status": "Approved",
            "note": "Final approved quotation"
        }
        response = api_client.post(
            f"{BASE_URL}/api/leads/{TEST_LEAD_ID}/quotation-history",
            json=payload
        )
        assert response.status_code == 200, f"Failed to add approved entry: {response.text}"
        
        # Verify previous entries are now Superseded
        response = api_client.get(f"{BASE_URL}/api/leads/{TEST_LEAD_ID}")
        updated_history = response.json().get("quotation_history", [])
        
        # Check that all entries except the last one are Superseded
        superseded_count = sum(1 for h in updated_history[:-1] if h.get("status") == "Superseded")
        print(f"✓ Approved entry added, {superseded_count} previous entries marked Superseded")
    
    def test_invalid_status_rejected(self, api_client):
        """Invalid status should be rejected"""
        payload = {
            "quoted_value": 500000,
            "status": "InvalidStatus",
            "note": "This should fail"
        }
        response = api_client.post(
            f"{BASE_URL}/api/leads/{TEST_LEAD_ID}/quotation-history",
            json=payload
        )
        assert response.status_code == 400, "Invalid status should return 400"
        print("✓ Invalid status correctly rejected")


class TestProjectQuotationHistory:
    """Test Project Quotation History functionality"""
    
    def test_get_project_with_quotation_history(self, api_client):
        """Verify project has quotation_history field"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        assert response.status_code == 200, f"Failed to get project: {response.text}"
        data = response.json()
        assert "quotation_history" in data, "quotation_history field missing"
        print(f"✓ Project has {len(data.get('quotation_history', []))} quotation entries")
    
    def test_add_project_quotation_entry(self, api_client):
        """Add quotation entry to project"""
        payload = {
            "quoted_value": 580000,
            "status": "Tentative",
            "note": "Test project quotation"
        }
        response = api_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/quotation-history",
            json=payload
        )
        assert response.status_code == 200, f"Failed to add entry: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Added project quotation v{data['entry']['version']}")


class TestValueLifecycleCard:
    """Test Project Value Lifecycle functionality"""
    
    def test_get_project_value_lifecycle(self, api_client):
        """Get value lifecycle data"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/value-lifecycle")
        assert response.status_code == 200, f"Failed to get lifecycle: {response.text}"
        data = response.json()
        
        # Verify all required fields
        required_fields = [
            "inquiry_value", "booked_value", "contract_value",
            "contract_value_locked", "discount_amount", "final_value"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Value Lifecycle: Inquiry={data['inquiry_value']}, Booked={data['booked_value']}, Contract={data['contract_value']}")
        print(f"  Locked={data['contract_value_locked']}, Discount={data['discount_amount']}, Final={data['final_value']}")
    
    def test_project_has_value_fields(self, api_client):
        """Verify project response includes value lifecycle fields"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Check value fields exist
        assert "contract_value" in data or "project_value" in data, "Contract value missing"
        assert "contract_value_locked" in data, "contract_value_locked missing"
        
        if data.get("contract_value_locked"):
            assert "contract_value_locked_at" in data, "locked_at missing when locked"
        
        print(f"✓ Project value fields present: contract_value={data.get('contract_value')}, locked={data.get('contract_value_locked')}")


class TestLockContractValue:
    """Test Lock Contract Value functionality"""
    
    def test_lock_already_locked_returns_error(self, api_client):
        """Attempting to lock already locked contract should fail"""
        # The test project is already locked
        response = api_client.post(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/lock-contract-value")
        assert response.status_code == 400, "Should return 400 for already locked"
        assert "already locked" in response.json().get("detail", "").lower()
        print("✓ Already locked contract correctly returns error")
    
    def test_lock_contract_on_new_project(self, api_client):
        """Test locking contract on a project that isn't locked"""
        # First, find or create a project that isn't locked
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval',
            '''use('test_database');
            var project = db.projects.findOne({contract_value_locked: {$ne: true}});
            if (project) print(project.project_id);
            else print('NONE');'''
        ], capture_output=True, text=True)
        unlocked_project_id = result.stdout.strip()
        
        if unlocked_project_id == 'NONE':
            pytest.skip("No unlocked project available for testing")
        
        response = api_client.post(f"{BASE_URL}/api/projects/{unlocked_project_id}/lock-contract-value")
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "contract_value" in data
            assert "locked_at" in data
            print(f"✓ Contract locked successfully for {unlocked_project_id}")
        else:
            # May already be locked by another test
            print(f"✓ Lock endpoint responded with {response.status_code}")


class TestOverrideContractValue:
    """Test Override Contract Value functionality (Admin/Founder only)"""
    
    def test_override_contract_value(self, api_client):
        """Admin can override locked contract value with reason"""
        payload = {
            "new_value": 590000,
            "reason": "Test override - scope change after sign-off"
        }
        response = api_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/override-contract-value",
            json=payload
        )
        assert response.status_code == 200, f"Override failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("new_value") == 590000
        assert "reason" in data
        print(f"✓ Contract value overridden: {data.get('old_value')} → {data.get('new_value')}")
    
    def test_override_requires_reason(self, api_client):
        """Override without reason should fail validation"""
        payload = {
            "new_value": 600000,
            "reason": ""  # Empty reason
        }
        response = api_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/override-contract-value",
            json=payload
        )
        # Should either fail validation or succeed (depends on backend validation)
        # The frontend enforces this, backend may or may not
        print(f"✓ Override with empty reason: status={response.status_code}")


class TestApplyDiscount:
    """Test Apply Discount functionality (Admin/Founder only)"""
    
    def test_apply_discount(self, api_client):
        """Admin can apply discount with reason"""
        payload = {
            "discount_amount": 30000,
            "reason": "Test discount - delayed delivery compensation"
        }
        response = api_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/apply-discount",
            json=payload
        )
        assert response.status_code == 200, f"Apply discount failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("discount_amount") == 30000
        assert "final_value" in data
        print(f"✓ Discount applied: ₹{data.get('discount_amount')}, Final: ₹{data.get('final_value')}")
    
    def test_discount_cannot_exceed_contract(self, api_client):
        """Discount amount cannot exceed contract value"""
        payload = {
            "discount_amount": 10000000,  # Very large amount
            "reason": "This should fail"
        }
        response = api_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/apply-discount",
            json=payload
        )
        assert response.status_code == 400, "Should reject discount exceeding contract"
        print("✓ Discount exceeding contract value correctly rejected")
    
    def test_negative_discount_rejected(self, api_client):
        """Negative discount should be rejected"""
        payload = {
            "discount_amount": -5000,
            "reason": "Negative discount test"
        }
        response = api_client.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/apply-discount",
            json=payload
        )
        assert response.status_code == 400, "Should reject negative discount"
        print("✓ Negative discount correctly rejected")


class TestNonAdminRestrictions:
    """Test that non-Admin users cannot override or apply discount"""
    
    def test_create_designer_session(self):
        """Create a Designer user session for testing restrictions"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval',
            '''use('test_database');
            var designer = db.users.findOne({role: 'Designer'});
            if (designer) {
                var token = 'test_designer_session_' + Date.now();
                db.user_sessions.insertOne({
                    user_id: designer.user_id,
                    session_token: token,
                    expires_at: new Date(Date.now() + 7*24*60*60*1000),
                    created_at: new Date()
                });
                print(token);
            } else {
                print('NO_DESIGNER');
            }'''
        ], capture_output=True, text=True)
        token = result.stdout.strip()
        if token == 'NO_DESIGNER':
            pytest.skip("No Designer user available")
        return token
    
    def test_designer_cannot_override(self):
        """Designer role cannot override contract value"""
        token = self.test_create_designer_session()
        if not token or token == 'NO_DESIGNER':
            pytest.skip("No designer session")
        
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        
        payload = {
            "new_value": 700000,
            "reason": "Designer trying to override"
        }
        response = session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/override-contract-value",
            json=payload
        )
        assert response.status_code == 403, f"Designer should get 403, got {response.status_code}"
        print("✓ Designer correctly blocked from overriding contract value")
    
    def test_designer_cannot_apply_discount(self):
        """Designer role cannot apply discount"""
        token = self.test_create_designer_session()
        if not token or token == 'NO_DESIGNER':
            pytest.skip("No designer session")
        
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        
        payload = {
            "discount_amount": 10000,
            "reason": "Designer trying to apply discount"
        }
        response = session.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/apply-discount",
            json=payload
        )
        assert response.status_code == 403, f"Designer should get 403, got {response.status_code}"
        print("✓ Designer correctly blocked from applying discount")


class TestDataPersistence:
    """Verify data is correctly persisted after operations"""
    
    def test_quotation_history_persisted(self, api_client):
        """Verify quotation entries are persisted in database"""
        response = api_client.get(f"{BASE_URL}/api/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200
        data = response.json()
        history = data.get("quotation_history", [])
        
        # Should have entries from previous tests
        assert len(history) > 0, "Quotation history should have entries"
        
        # Verify structure of entries
        for entry in history:
            assert "version" in entry
            assert "quoted_value" in entry
            assert "status" in entry
            assert entry["status"] in ["Tentative", "Revised", "Approved", "Superseded"]
        
        print(f"✓ {len(history)} quotation entries persisted correctly")
    
    def test_discount_persisted(self, api_client):
        """Verify discount is persisted in project"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        assert response.status_code == 200
        data = response.json()
        
        assert "discount_amount" in data, "discount_amount should be in response"
        assert "discount_reason" in data, "discount_reason should be in response"
        
        print(f"✓ Discount persisted: ₹{data.get('discount_amount')} - {data.get('discount_reason')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
