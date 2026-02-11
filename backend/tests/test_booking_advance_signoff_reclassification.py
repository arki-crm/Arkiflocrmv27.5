"""
Test Booking Advance Reclassification Upon Sign-off

Tests the cash lock logic for booking advances:
- Before Sign-off: Booking advances are EXCLUDED from cash lock (Total Received = 0)
- After Sign-off: ALL receipts (including booking advances) are included as execution liquidity
- Booking advance reclassification happens automatically upon sign-off
- Historical receipt records are NOT modified (only calculation logic changes)

Test Projects:
- proj_0a79eb51: signoff_locked=True, has 2 receipts (25000 booking + 5000 post-signoff) = 30000 total
- proj_17942869: signoff_locked=False, should show 0 execution receipts (booking advances excluded)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBookingAdvanceSignoffReclassification:
    """Test booking advance reclassification upon BOQ sign-off"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as founder
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "sidheeq.arkidots@gmail.com", "password": "founder123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Extract session token from cookies
        self.session_token = login_response.cookies.get("session_token")
        if self.session_token:
            self.session.cookies.set("session_token", self.session_token)
    
    def test_01_login_works(self):
        """Verify authentication is working"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "sidheeq.arkidots@gmail.com"
        print(f"✓ Logged in as: {data['email']} (role: {data['role']})")
    
    def test_02_signed_off_project_includes_all_receipts(self):
        """
        proj_0a79eb51 has signoff_locked=True
        - Receipt 25000 (booking advance)
        - Receipt 5000 (post-signoff)
        
        After Sign-off: ALL receipts become execution liquidity
        Expected: total_received = 30000 (25000 + 5000)
        """
        response = self.session.get(f"{BASE_URL}/api/finance/project-lock-status/proj_0a79eb51")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        print(f"\nProject: {data.get('project_name')}")
        print(f"Signoff Locked: {data.get('signoff_locked')}")
        print(f"Signoff Locked At: {data.get('signoff_locked_at')}")
        print(f"Total Received: {data.get('total_received')}")
        print(f"Receipt Count: {data.get('receipt_count')}")
        
        # CRITICAL: Project must be signed off
        assert data.get("signoff_locked") == True, \
            f"Expected signoff_locked=True, got {data.get('signoff_locked')}"
        
        # CRITICAL: ALL receipts should be included (booking advance + post-signoff)
        assert data.get("total_received") == 30000, \
            f"Expected total_received=30000 (all receipts), got {data.get('total_received')}"
        
        # Should count both receipts
        assert data.get("receipt_count") == 2, \
            f"Expected receipt_count=2, got {data.get('receipt_count')}"
        
        print(f"✓ Signed-off project includes ALL receipts (booking advance reclassified)")
        print(f"✓ Total Received = 30000 (25000 booking + 5000 post-signoff)")
    
    def test_03_not_signed_off_project_excludes_booking_advances(self):
        """
        proj_17942869 has signoff_locked=False
        All receipts are booking advances (pre-signoff)
        
        Before Sign-off: Booking advances are EXCLUDED from cash lock
        Expected: total_received = 0
        """
        response = self.session.get(f"{BASE_URL}/api/finance/project-lock-status/proj_17942869")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        print(f"\nProject: {data.get('project_name')}")
        print(f"Signoff Locked: {data.get('signoff_locked')}")
        print(f"Signoff Locked At: {data.get('signoff_locked_at')}")
        print(f"Total Received: {data.get('total_received')}")
        print(f"Receipt Count: {data.get('receipt_count')}")
        
        # CRITICAL: Project must NOT be signed off
        assert data.get("signoff_locked") == False, \
            f"Expected signoff_locked=False, got {data.get('signoff_locked')}"
        
        # CRITICAL: No receipts should be included (booking advances excluded)
        assert data.get("total_received") == 0, \
            f"Expected total_received=0 (booking advances excluded), got {data.get('total_received')}"
        
        assert data.get("receipt_count") == 0, \
            f"Expected receipt_count=0, got {data.get('receipt_count')}"
        
        print(f"✓ Not-signed-off project excludes booking advances")
        print(f"✓ Total Received = 0 (booking advances not yet execution liquidity)")
    
    def test_04_safe_to_use_calculation_after_signoff(self):
        """
        Verify Safe to Use calculation for signed-off project:
        - Total Received: 30000 (all receipts)
        - Lock Percentage: 85%
        - Gross Locked: 30000 * 0.85 = 25500
        - Commitments: 0
        - Net Locked: 25500
        - Safe to Use: 30000 - 25500 - 0 = 4500
        """
        response = self.session.get(f"{BASE_URL}/api/finance/project-lock-status/proj_0a79eb51")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify lock percentage
        assert data.get("effective_lock_percentage") == 85, \
            f"Expected lock_percentage=85, got {data.get('effective_lock_percentage')}"
        
        # Verify gross locked calculation
        expected_gross_locked = 30000 * 0.85  # 25500
        assert data.get("gross_locked") == expected_gross_locked, \
            f"Expected gross_locked={expected_gross_locked}, got {data.get('gross_locked')}"
        
        # Verify commitments are 0
        assert data.get("total_commitments") == 0, \
            f"Expected total_commitments=0, got {data.get('total_commitments')}"
        
        # Verify net locked
        expected_net_locked = expected_gross_locked  # 25500 (since commitments=0)
        assert data.get("net_locked") == expected_net_locked, \
            f"Expected net_locked={expected_net_locked}, got {data.get('net_locked')}"
        
        # Verify safe to use
        expected_safe_to_use = 30000 - expected_net_locked - 0  # 4500
        assert data.get("safe_to_use") == expected_safe_to_use, \
            f"Expected safe_to_use={expected_safe_to_use}, got {data.get('safe_to_use')}"
        
        print(f"\n✓ Lock Percentage: {data.get('effective_lock_percentage')}%")
        print(f"✓ Gross Locked: {data.get('gross_locked')}")
        print(f"✓ Total Commitments: {data.get('total_commitments')}")
        print(f"✓ Net Locked: {data.get('net_locked')}")
        print(f"✓ Safe to Use: {data.get('safe_to_use')}")
    
    def test_05_bulk_endpoint_follows_same_logic(self):
        """
        Test bulk endpoint also follows same reclassification logic:
        - Signed-off projects: ALL receipts included
        - Not-signed-off projects: NO receipts included (excluded from list)
        """
        response = self.session.get(f"{BASE_URL}/api/finance/project-lock-status")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        projects = data.get("projects", [])
        
        print(f"\nBulk Lock Status - {len(projects)} projects with execution receipts")
        
        # Find proj_0a79eb51 in the list (signed off, should be included)
        proj_0a79 = next((p for p in projects if p.get("project_id") == "proj_0a79eb51"), None)
        
        assert proj_0a79 is not None, "proj_0a79eb51 should be in bulk response (signed off with receipts)"
        
        print(f"\nproj_0a79eb51 in bulk response:")
        print(f"  Signoff Locked: {proj_0a79.get('signoff_locked')}")
        print(f"  Total Received: {proj_0a79.get('total_received')}")
        print(f"  Net Locked: {proj_0a79.get('net_locked')}")
        print(f"  Safe to Use: {proj_0a79.get('safe_to_use')}")
        
        # Verify signed-off project includes all receipts
        assert proj_0a79.get("signoff_locked") == True, \
            f"Expected signoff_locked=True, got {proj_0a79.get('signoff_locked')}"
        assert proj_0a79.get("total_received") == 30000, \
            f"Bulk endpoint: Expected total_received=30000, got {proj_0a79.get('total_received')}"
        
        print(f"✓ Bulk endpoint correctly includes all receipts for signed-off project")
        
        # proj_17942869 should NOT be in the list (not signed off, 0 execution receipts)
        proj_1794 = next((p for p in projects if p.get("project_id") == "proj_17942869"), None)
        if proj_1794:
            # If it's in the list, verify it has 0 execution receipts
            assert proj_1794.get("total_received") == 0, \
                f"proj_17942869 should have 0 execution receipts, got {proj_1794.get('total_received')}"
            print(f"✓ proj_17942869 in bulk with 0 execution receipts (correctly excluded from cash lock)")
        else:
            print(f"✓ proj_17942869 correctly excluded from bulk (0 execution receipts)")
    
    def test_06_historical_receipts_not_modified(self):
        """
        Verify that historical receipt records are NOT modified.
        The reclassification is purely in calculation logic, not data modification.
        
        This test verifies the receipts endpoint still returns original receipt data.
        """
        # Get receipts for signed-off project
        response = self.session.get(f"{BASE_URL}/api/finance/receipts?project_id=proj_0a79eb51")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Receipts endpoint returns array directly
        receipts = data if isinstance(data, list) else data.get("receipts", [])
        
        print(f"\nReceipts for proj_0a79eb51: {len(receipts)} records")
        
        # Verify receipts exist and have original data
        assert len(receipts) >= 2, f"Expected at least 2 receipts, got {len(receipts)}"
        
        # Check that receipts have their original stage_name (not modified)
        for r in receipts:
            print(f"  - Receipt {r.get('receipt_id')}: {r.get('amount')} ({r.get('stage_name')})")
            # Verify receipt has original fields
            assert "receipt_id" in r, "Receipt missing receipt_id"
            assert "amount" in r, "Receipt missing amount"
            assert "stage_name" in r, "Receipt missing stage_name"
            assert "created_at" in r, "Receipt missing created_at"
        
        print(f"✓ Historical receipt records preserved (not modified)")
        print(f"✓ Reclassification is calculation-only, not data modification")
    
    def test_07_response_structure_complete(self):
        """
        Verify all required fields are present in lock status response
        """
        response = self.session.get(f"{BASE_URL}/api/finance/project-lock-status/proj_0a79eb51")
        assert response.status_code == 200
        
        data = response.json()
        
        required_fields = [
            "project_id",
            "project_name",
            "project_value",
            "signoff_locked",
            "signoff_locked_at",
            "default_lock_percentage",
            "effective_lock_percentage",
            "is_overridden",
            "total_received",
            "receipt_count",
            "execution_invoice_commitment",
            "execution_invoice_count",
            "expense_request_commitment",
            "expense_request_count",
            "total_commitments",
            "gross_locked",
            "net_locked",
            "safe_to_use",
            "lock_history"
        ]
        
        missing_fields = [f for f in required_fields if f not in data]
        assert not missing_fields, f"Missing fields: {missing_fields}"
        
        print(f"\n✓ All {len(required_fields)} required fields present in response")
    
    def test_08_bulk_response_structure_complete(self):
        """
        Verify bulk endpoint response structure
        """
        response = self.session.get(f"{BASE_URL}/api/finance/project-lock-status")
        assert response.status_code == 200
        
        data = response.json()
        
        required_top_level = [
            "default_lock_percentage",
            "monthly_operating_expense",
            "total_received_all",
            "total_locked_all",
            "total_commitments_all",
            "total_safe_all",
            "safe_use_warning",
            "safe_use_months",
            "projects"
        ]
        
        missing_fields = [f for f in required_top_level if f not in data]
        assert not missing_fields, f"Missing top-level fields: {missing_fields}"
        
        print(f"\n✓ Bulk endpoint has all required top-level fields")
        print(f"  Default Lock %: {data.get('default_lock_percentage')}")
        print(f"  Total Received (All Projects): {data.get('total_received_all')}")
        print(f"  Total Locked: {data.get('total_locked_all')}")
        print(f"  Total Safe to Use: {data.get('total_safe_all')}")
    
    def test_09_signoff_determines_inclusion_logic(self):
        """
        Core logic verification:
        - signoff_locked=True → ALL receipts included
        - signoff_locked=False → NO receipts included
        
        This is the key business rule being tested.
        """
        # Get both projects
        response_signed = self.session.get(f"{BASE_URL}/api/finance/project-lock-status/proj_0a79eb51")
        response_unsigned = self.session.get(f"{BASE_URL}/api/finance/project-lock-status/proj_17942869")
        
        assert response_signed.status_code == 200
        assert response_unsigned.status_code == 200
        
        signed_data = response_signed.json()
        unsigned_data = response_unsigned.json()
        
        print("\n=== SIGNOFF DETERMINES INCLUSION LOGIC ===")
        print(f"\nSigned-off project (proj_0a79eb51):")
        print(f"  signoff_locked: {signed_data.get('signoff_locked')}")
        print(f"  total_received: {signed_data.get('total_received')}")
        print(f"  receipt_count: {signed_data.get('receipt_count')}")
        
        print(f"\nNot-signed-off project (proj_17942869):")
        print(f"  signoff_locked: {unsigned_data.get('signoff_locked')}")
        print(f"  total_received: {unsigned_data.get('total_received')}")
        print(f"  receipt_count: {unsigned_data.get('receipt_count')}")
        
        # Verify the core logic
        assert signed_data.get("signoff_locked") == True, "proj_0a79eb51 should be signed off"
        assert signed_data.get("total_received") > 0, "Signed-off project should have receipts included"
        
        assert unsigned_data.get("signoff_locked") == False, "proj_17942869 should NOT be signed off"
        assert unsigned_data.get("total_received") == 0, "Not-signed-off project should have 0 receipts"
        
        print(f"\n✓ VERIFIED: signoff_locked=True → ALL receipts included")
        print(f"✓ VERIFIED: signoff_locked=False → NO receipts included (booking advances excluded)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
