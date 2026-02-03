"""
Test GST handling for Purchase Invoices (Execution Ledger)
Tests:
1. Create purchase invoice with GST fields (hsn_code, cgst_percent, sgst_percent, igst_percent)
2. Verify GST amounts and grand_total are correctly calculated
3. Update purchase invoice and verify GST recalculations
4. Create purchase invoice without GST fields
5. Project Settings GST toggle for customer invoices
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_gst_1770118874400"
TEST_PROJECT_ID = "proj_126a928d"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Cookie": f"session_token={SESSION_TOKEN}"
    })
    return session


class TestAuthVerification:
    """Verify authentication is working"""
    
    def test_auth_me(self, api_client):
        """Test auth/me endpoint returns user data"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert "user_id" in data or "email" in data
        print(f"Auth verified: {data.get('email', data.get('name', 'Unknown'))}")


class TestPurchaseInvoiceGSTCreate:
    """Test creating purchase invoices with GST fields"""
    
    created_entry_id = None
    
    def test_create_invoice_with_gst(self, api_client):
        """Create a purchase invoice with GST fields on line items"""
        payload = {
            "project_id": TEST_PROJECT_ID,
            "vendor_name": "TEST_GST_Vendor_001",
            "invoice_no": "GST-INV-001",
            "invoice_date": "2026-02-01",
            "execution_date": "2026-02-01",
            "purchase_type": "credit",
            "items": [
                {
                    "category": "Modular Material",
                    "material_name": "Plywood 18mm",
                    "specification": "BWR Grade",
                    "brand": "Century",
                    "quantity": 10,
                    "unit": "pcs",
                    "rate": 1000,
                    "hsn_code": "4410",
                    "cgst_percent": 9,
                    "sgst_percent": 9,
                    "igst_percent": 0
                },
                {
                    "category": "Hardware & Accessories",
                    "material_name": "Hinges",
                    "specification": "Soft Close",
                    "brand": "Hettich",
                    "quantity": 20,
                    "unit": "pcs",
                    "rate": 150,
                    "hsn_code": "8302",
                    "cgst_percent": 9,
                    "sgst_percent": 9,
                    "igst_percent": 0
                }
            ],
            "remarks": "Test invoice with GST"
        }
        
        response = api_client.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        resp_data = response.json()
        # API returns {"success": true, "entry": {...}}
        assert resp_data.get("success") == True, f"Expected success=True, got {resp_data}"
        data = resp_data.get("entry", {})
        
        assert "execution_id" in data, f"No execution_id in response: {data}"
        TestPurchaseInvoiceGSTCreate.created_entry_id = data["execution_id"]
        print(f"Created invoice: {data['execution_id']}")
        
        # Verify GST calculations
        # Item 1: 10 * 1000 = 10000, CGST = 900, SGST = 900
        # Item 2: 20 * 150 = 3000, CGST = 270, SGST = 270
        # Total: 13000, Total CGST = 1170, Total SGST = 1170, Total GST = 2340
        # Grand Total = 13000 + 2340 = 15340
        
        assert data.get("gross_total") == 13000, f"Expected gross_total 13000, got {data.get('gross_total')}"
        assert data.get("total_cgst") == 1170, f"Expected total_cgst 1170, got {data.get('total_cgst')}"
        assert data.get("total_sgst") == 1170, f"Expected total_sgst 1170, got {data.get('total_sgst')}"
        assert data.get("total_gst") == 2340, f"Expected total_gst 2340, got {data.get('total_gst')}"
        assert data.get("grand_total") == 15340, f"Expected grand_total 15340, got {data.get('grand_total')}"
        
        print(f"GST calculations verified: gross={data.get('gross_total')}, gst={data.get('total_gst')}, grand={data.get('grand_total')}")
    
    def test_get_invoice_with_gst(self, api_client):
        """Verify GST data is persisted and returned correctly"""
        entry_id = TestPurchaseInvoiceGSTCreate.created_entry_id
        assert entry_id, "No entry ID from create test"
        
        response = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        assert response.status_code == 200, f"Get failed: {response.text}"
        
        data = response.json()
        
        # Verify line item GST fields
        items = data.get("items", [])
        assert len(items) == 2, f"Expected 2 items, got {len(items)}"
        
        item1 = items[0]
        assert item1.get("hsn_code") == "4410", f"Expected hsn_code 4410, got {item1.get('hsn_code')}"
        assert item1.get("cgst_percent") == 9, f"Expected cgst_percent 9, got {item1.get('cgst_percent')}"
        assert item1.get("sgst_percent") == 9, f"Expected sgst_percent 9, got {item1.get('sgst_percent')}"
        assert item1.get("cgst_amount") == 900, f"Expected cgst_amount 900, got {item1.get('cgst_amount')}"
        assert item1.get("sgst_amount") == 900, f"Expected sgst_amount 900, got {item1.get('sgst_amount')}"
        assert item1.get("line_total_with_gst") == 11800, f"Expected line_total_with_gst 11800, got {item1.get('line_total_with_gst')}"
        
        print(f"Line item GST verified: hsn={item1.get('hsn_code')}, cgst={item1.get('cgst_amount')}, sgst={item1.get('sgst_amount')}")


class TestPurchaseInvoiceGSTUpdate:
    """Test updating purchase invoices with GST recalculations"""
    
    def test_update_invoice_gst_fields(self, api_client):
        """Update invoice and verify GST recalculations"""
        entry_id = TestPurchaseInvoiceGSTCreate.created_entry_id
        assert entry_id, "No entry ID from create test"
        
        # Update with different GST rates (IGST for inter-state)
        payload = {
            "items": [
                {
                    "category": "Modular Material",
                    "material_name": "Plywood 18mm Updated",
                    "specification": "BWR Grade",
                    "brand": "Century",
                    "quantity": 5,
                    "unit": "pcs",
                    "rate": 2000,
                    "hsn_code": "4410",
                    "cgst_percent": 0,
                    "sgst_percent": 0,
                    "igst_percent": 18
                }
            ]
        }
        
        response = api_client.put(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}", json=payload)
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        resp_data = response.json()
        # API returns {"success": true, "entry": {...}}
        data = resp_data.get("entry", resp_data)
        
        # Verify recalculated GST
        # Item: 5 * 2000 = 10000, IGST = 1800
        # Grand Total = 10000 + 1800 = 11800
        
        assert data.get("gross_total") == 10000, f"Expected gross_total 10000, got {data.get('gross_total')}"
        assert data.get("total_igst") == 1800, f"Expected total_igst 1800, got {data.get('total_igst')}"
        assert data.get("total_gst") == 1800, f"Expected total_gst 1800, got {data.get('total_gst')}"
        assert data.get("grand_total") == 11800, f"Expected grand_total 11800, got {data.get('grand_total')}"
        
        print(f"Update GST recalculation verified: gross={data.get('gross_total')}, igst={data.get('total_igst')}, grand={data.get('grand_total')}")


class TestPurchaseInvoiceWithoutGST:
    """Test creating purchase invoices without GST fields"""
    
    created_entry_id = None
    
    def test_create_invoice_without_gst(self, api_client):
        """Create a purchase invoice without any GST fields"""
        payload = {
            "project_id": TEST_PROJECT_ID,
            "vendor_name": "TEST_NoGST_Vendor_001",
            "invoice_no": "NO-GST-INV-001",
            "invoice_date": "2026-02-01",
            "execution_date": "2026-02-01",
            "purchase_type": "cash",
            "items": [
                {
                    "category": "Site Expense",
                    "material_name": "Labour Charges",
                    "quantity": 1,
                    "unit": "lot",
                    "rate": 5000
                    # No GST fields
                }
            ],
            "remarks": "Test invoice without GST"
        }
        
        response = api_client.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        resp_data = response.json()
        assert resp_data.get("success") == True
        data = resp_data.get("entry", {})
        
        assert "execution_id" in data
        TestPurchaseInvoiceWithoutGST.created_entry_id = data["execution_id"]
        
        # Verify no GST applied
        assert data.get("gross_total") == 5000, f"Expected gross_total 5000, got {data.get('gross_total')}"
        assert data.get("total_gst", 0) == 0, f"Expected total_gst 0, got {data.get('total_gst')}"
        assert data.get("grand_total") == 5000, f"Expected grand_total 5000, got {data.get('grand_total')}"
        
        print(f"Invoice without GST created: gross={data.get('gross_total')}, grand={data.get('grand_total')}")
    
    def test_get_invoice_without_gst(self, api_client):
        """Verify invoice without GST is returned correctly"""
        entry_id = TestPurchaseInvoiceWithoutGST.created_entry_id
        assert entry_id, "No entry ID from create test"
        
        response = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
        assert response.status_code == 200, f"Get failed: {response.text}"
        
        data = response.json()
        items = data.get("items", [])
        assert len(items) == 1
        
        item = items[0]
        # GST fields should be None or 0
        assert item.get("hsn_code") is None, f"Expected hsn_code None, got {item.get('hsn_code')}"
        assert item.get("cgst_percent") is None or item.get("cgst_percent") == 0
        assert item.get("sgst_percent") is None or item.get("sgst_percent") == 0
        assert item.get("igst_percent") is None or item.get("igst_percent") == 0
        
        print("Invoice without GST verified - no GST fields set")


class TestProjectGSTSettings:
    """Test Project Settings GST toggle for customer invoices"""
    
    def test_get_project_settings(self, api_client):
        """Get project and verify GST settings fields exist"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        assert response.status_code == 200, f"Get project failed: {response.text}"
        
        data = response.json()
        # GST settings should be present (may be false/null initially)
        print(f"Project GST settings: gst_applicable={data.get('gst_applicable')}, gst_number={data.get('gst_number')}")
    
    def test_enable_gst_toggle(self, api_client):
        """Enable GST toggle for project"""
        payload = {
            "gst_applicable": True,
            "gst_number": "22AAAAA0000A1Z5"
        }
        
        response = api_client.put(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/settings", json=payload)
        assert response.status_code == 200, f"Update settings failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print("GST toggle enabled successfully")
    
    def test_verify_gst_settings_persisted(self, api_client):
        """Verify GST settings are persisted"""
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        assert response.status_code == 200, f"Get project failed: {response.text}"
        
        data = response.json()
        assert data.get("gst_applicable") == True, f"Expected gst_applicable True, got {data.get('gst_applicable')}"
        assert data.get("gst_number") == "22AAAAA0000A1Z5", f"Expected gst_number 22AAAAA0000A1Z5, got {data.get('gst_number')}"
        
        print(f"GST settings persisted: gst_applicable={data.get('gst_applicable')}, gst_number={data.get('gst_number')}")
    
    def test_invalid_gst_number_format(self, api_client):
        """Test invalid GST number format is rejected"""
        payload = {
            "gst_applicable": True,
            "gst_number": "INVALID123"
        }
        
        response = api_client.put(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/settings", json=payload)
        assert response.status_code == 400, f"Expected 400 for invalid GST, got {response.status_code}"
        
        data = response.json()
        assert "Invalid GST number format" in data.get("detail", "")
        print("Invalid GST number format correctly rejected")
    
    def test_disable_gst_toggle(self, api_client):
        """Disable GST toggle for project"""
        payload = {
            "gst_applicable": False,
            "gst_number": None
        }
        
        response = api_client.put(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/settings", json=payload)
        assert response.status_code == 200, f"Update settings failed: {response.text}"
        
        # Verify disabled
        response = api_client.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}")
        data = response.json()
        assert data.get("gst_applicable") == False, f"Expected gst_applicable False, got {data.get('gst_applicable')}"
        
        print("GST toggle disabled successfully")


class TestPurchaseInvoiceGSTWithDiscount:
    """Test GST calculations with discount applied"""
    
    created_entry_id = None
    
    def test_create_invoice_with_gst_and_discount(self, api_client):
        """Create invoice with GST and flat discount"""
        payload = {
            "project_id": TEST_PROJECT_ID,
            "vendor_name": "TEST_GST_Discount_Vendor",
            "invoice_no": "GST-DISC-001",
            "invoice_date": "2026-02-01",
            "execution_date": "2026-02-01",
            "purchase_type": "credit",
            "items": [
                {
                    "category": "Modular Material",
                    "material_name": "MDF Board",
                    "quantity": 10,
                    "unit": "pcs",
                    "rate": 1000,
                    "hsn_code": "4411",
                    "cgst_percent": 9,
                    "sgst_percent": 9,
                    "igst_percent": 0
                }
            ],
            "discount_type": "flat",
            "discount_value": 500,
            "remarks": "Test invoice with GST and discount"
        }
        
        response = api_client.post(f"{BASE_URL}/api/finance/execution-ledger", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        resp_data = response.json()
        assert resp_data.get("success") == True
        data = resp_data.get("entry", {})
        
        TestPurchaseInvoiceGSTWithDiscount.created_entry_id = data["execution_id"]
        
        # Calculations:
        # Gross: 10 * 1000 = 10000
        # Discount: 500
        # Net Taxable: 10000 - 500 = 9500
        # GST is calculated on line items (before discount): CGST = 900, SGST = 900, Total GST = 1800
        # Grand Total = Net Taxable + GST = 9500 + 1800 = 11300
        
        assert data.get("gross_total") == 10000, f"Expected gross_total 10000, got {data.get('gross_total')}"
        assert data.get("discount_amount") == 500, f"Expected discount_amount 500, got {data.get('discount_amount')}"
        assert data.get("net_taxable") == 9500, f"Expected net_taxable 9500, got {data.get('net_taxable')}"
        assert data.get("total_gst") == 1800, f"Expected total_gst 1800, got {data.get('total_gst')}"
        assert data.get("grand_total") == 11300, f"Expected grand_total 11300, got {data.get('grand_total')}"
        
        print(f"GST with discount verified: gross={data.get('gross_total')}, discount={data.get('discount_amount')}, net={data.get('net_taxable')}, gst={data.get('total_gst')}, grand={data.get('grand_total')}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_entries(self, api_client):
        """Delete test entries created during testing"""
        # Get all entries for the project
        response = api_client.get(f"{BASE_URL}/api/finance/execution-ledger/project/{TEST_PROJECT_ID}")
        if response.status_code == 200:
            data = response.json()
            entries = data.get("entries", [])
            
            deleted_count = 0
            for entry in entries:
                vendor_name = entry.get("vendor_name", "")
                if vendor_name.startswith("TEST_"):
                    entry_id = entry.get("execution_id")
                    del_response = api_client.delete(f"{BASE_URL}/api/finance/execution-ledger/{entry_id}")
                    if del_response.status_code == 200:
                        deleted_count += 1
            
            print(f"Cleaned up {deleted_count} test entries")
        else:
            print("Could not fetch entries for cleanup")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
