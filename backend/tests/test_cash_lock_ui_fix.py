"""
Test Cash Lock UI Fix - Backward Compatibility for outflow_count field
Issue: Cash Lock UI disappeared after financial baseline patch
Root Cause: Frontend expected 'outflow_count' but backend was returning 'execution_invoice_count'
Fix: Added backward compatibility aliases in backend response
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCashLockUIFix:
    """Test Cash Lock API returns all required fields for UI rendering"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token via cookies"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "sidheeq.arkidots@gmail.com", "password": "founder123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        # Session token is set as cookie automatically
        
    def test_01_cash_lock_api_returns_outflow_count(self):
        """Test that Cash Lock API returns outflow_count field for backward compatibility"""
        # Test project: proj_0a79eb51 (signed off with total_received=30000)
        project_id = "proj_0a79eb51"
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/project-lock-status/{project_id}"
        )
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        # Verify outflow_count field exists (backward compatibility)
        assert "outflow_count" in data, f"Missing outflow_count field. Response: {data}"
        print(f"✓ outflow_count field present: {data['outflow_count']}")
        
    def test_02_cash_lock_api_returns_all_required_fields(self):
        """Test that all required fields for UI rendering are present"""
        project_id = "proj_0a79eb51"
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/project-lock-status/{project_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All required fields for Cash Lock UI
        required_fields = [
            "total_received",
            "receipt_count",
            "outflow_count",  # Backward compatibility alias
            "expense_request_count",
            "total_commitments",
            "net_locked",
            "safe_to_use",
            "effective_lock_percentage",
            "is_overridden"
        ]
        
        missing_fields = [f for f in required_fields if f not in data]
        assert not missing_fields, f"Missing required fields: {missing_fields}"
        
        print(f"✓ All required fields present:")
        for field in required_fields:
            print(f"  - {field}: {data[field]}")
            
    def test_03_cash_lock_ui_renders_when_total_received_positive(self):
        """Test that lockStatus.total_received > 0 for signed-off project"""
        project_id = "proj_0a79eb51"
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/project-lock-status/{project_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # UI renders when total_received > 0
        total_received = data.get("total_received", 0)
        assert total_received > 0, f"total_received should be > 0 for signed-off project, got: {total_received}"
        
        print(f"✓ total_received = {total_received} (UI should render)")
        
    def test_04_signoff_locked_project_has_receipts(self):
        """Test that signed-off project includes all receipts in cash lock"""
        project_id = "proj_0a79eb51"
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/project-lock-status/{project_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify project is signed off
        assert data.get("signoff_locked") == True, "Project should be signed off"
        
        # Verify total_received matches expected value (30000)
        total_received = data.get("total_received", 0)
        assert total_received == 30000, f"Expected total_received=30000, got: {total_received}"
        
        print(f"✓ Signed-off project has total_received = {total_received}")
        
    def test_05_backward_compatibility_aliases_match(self):
        """Test that backward compatibility aliases match new field names"""
        project_id = "proj_0a79eb51"
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/project-lock-status/{project_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # outflow_count should equal execution_invoice_count
        outflow_count = data.get("outflow_count")
        execution_invoice_count = data.get("execution_invoice_count")
        
        assert outflow_count == execution_invoice_count, \
            f"Alias mismatch: outflow_count={outflow_count}, execution_invoice_count={execution_invoice_count}"
        
        # outflow_commitment should equal execution_invoice_commitment
        outflow_commitment = data.get("outflow_commitment")
        execution_invoice_commitment = data.get("execution_invoice_commitment")
        
        assert outflow_commitment == execution_invoice_commitment, \
            f"Alias mismatch: outflow_commitment={outflow_commitment}, execution_invoice_commitment={execution_invoice_commitment}"
        
        print(f"✓ Backward compatibility aliases match:")
        print(f"  - outflow_count = execution_invoice_count = {outflow_count}")
        print(f"  - outflow_commitment = execution_invoice_commitment = {outflow_commitment}")
        
    def test_06_safe_to_use_calculation(self):
        """Test safe_to_use calculation is correct"""
        project_id = "proj_0a79eb51"
        
        response = self.session.get(
            f"{BASE_URL}/api/finance/project-lock-status/{project_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        total_received = data.get("total_received", 0)
        net_locked = data.get("net_locked", 0)
        total_commitments = data.get("total_commitments", 0)
        safe_to_use = data.get("safe_to_use", 0)
        
        # safe_to_use = total_received - net_locked - total_commitments (capped at 0)
        expected_safe = max(0, total_received - net_locked - total_commitments)
        
        assert safe_to_use == expected_safe, \
            f"safe_to_use calculation wrong: got {safe_to_use}, expected {expected_safe}"
        
        print(f"✓ safe_to_use calculation correct:")
        print(f"  - total_received: {total_received}")
        print(f"  - net_locked: {net_locked}")
        print(f"  - total_commitments: {total_commitments}")
        print(f"  - safe_to_use: {safe_to_use}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
