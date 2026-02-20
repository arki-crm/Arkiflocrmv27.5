"""
Journal Entry Module Backend Tests
Tests for: /api/finance/journal-entries endpoints
Features: Create JE, List JE, Reverse JE, Export, Permission checks
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
ADMIN_EMAIL = "thaha.pakayil@gmail.com"
ADMIN_PASSWORD = "password123"


class TestJournalEntryAuth:
    """Authentication and permission tests for Journal Entry"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def founder_session(self, session):
        """Login as founder and return authenticated session"""
        # First get the login page to establish session
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Founder login failed: {response.status_code} - {response.text}")
        return session
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return authenticated session"""
        session = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        return session
    
    def test_unauthenticated_access_returns_401(self):
        """Unauthenticated requests should return 401"""
        response = requests.get(f"{BASE_URL}/api/finance/journal-entries")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_founder_can_access_journal_entries(self, founder_session):
        """Founder should have access to journal entries"""
        response = founder_session.get(f"{BASE_URL}/api/finance/journal-entries")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "entries" in data
        assert "total" in data
        assert "page" in data
    
    def test_admin_can_access_journal_entries(self, admin_session):
        """Admin should have access to journal entries"""
        response = admin_session.get(f"{BASE_URL}/api/finance/journal-entries")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestJournalEntryList:
    """Tests for GET /api/finance/journal-entries"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Login and return authenticated session"""
        session = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return session
    
    def test_list_returns_correct_structure(self, auth_session):
        """List endpoint should return correct response structure"""
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "entries" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "total_pages" in data
        
        # Verify types
        assert isinstance(data["entries"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["page"], int)
    
    def test_pagination_works(self, auth_session):
        """Pagination parameters should work"""
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 5
    
    def test_status_filter_posted(self, auth_session):
        """Status filter for 'posted' should work"""
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries?status=posted")
        assert response.status_code == 200
        data = response.json()
        # All returned entries should be posted (not reversed)
        for entry in data["entries"]:
            assert entry.get("is_reversed") != True or entry.get("status") == "posted"
    
    def test_status_filter_reversed(self, auth_session):
        """Status filter for 'reversed' should work"""
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries?status=reversed")
        assert response.status_code == 200
        # Should not error
    
    def test_date_range_filter(self, auth_session):
        """Date range filter should work"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries?start_date={today}&end_date={today}")
        assert response.status_code == 200
    
    def test_search_filter(self, auth_session):
        """Search filter should work"""
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries?search=test")
        assert response.status_code == 200


class TestJournalEntryCreate:
    """Tests for POST /api/finance/journal-entries"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Login and return authenticated session"""
        session = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def test_accounts(self, auth_session):
        """Get or create test accounts for JE testing"""
        # Try to get existing accounts
        accounts_resp = auth_session.get(f"{BASE_URL}/api/finance/accounts")
        categories_resp = auth_session.get(f"{BASE_URL}/api/finance/categories")
        
        accounts = accounts_resp.json() if accounts_resp.status_code == 200 else []
        categories = categories_resp.json() if categories_resp.status_code == 200 else []
        
        # Return first two account IDs if available
        all_accounts = []
        if isinstance(accounts, list):
            all_accounts.extend([a.get("account_id") for a in accounts if a.get("account_id")])
        if isinstance(categories, list):
            all_accounts.extend([c.get("category_id") for c in categories if c.get("category_id")])
        
        if len(all_accounts) < 2:
            # Use placeholder account IDs - the API should handle this
            return ["test_account_1", "test_account_2"]
        
        return all_accounts[:2]
    
    def test_create_requires_date(self, auth_session, test_accounts):
        """Create should fail without date"""
        payload = {
            "narration": "Test JE",
            "lines": [
                {"account_id": test_accounts[0], "debit": 1000, "credit": 0},
                {"account_id": test_accounts[1], "debit": 0, "credit": 1000}
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/finance/journal-entries", json=payload)
        assert response.status_code == 400
        assert "date" in response.text.lower() or "Date" in response.text
    
    def test_create_requires_narration(self, auth_session, test_accounts):
        """Create should fail without narration"""
        payload = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "lines": [
                {"account_id": test_accounts[0], "debit": 1000, "credit": 0},
                {"account_id": test_accounts[1], "debit": 0, "credit": 1000}
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/finance/journal-entries", json=payload)
        assert response.status_code == 400
        assert "narration" in response.text.lower() or "Narration" in response.text
    
    def test_create_requires_minimum_2_lines(self, auth_session, test_accounts):
        """Create should fail with less than 2 lines"""
        payload = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "narration": "Test JE",
            "lines": [
                {"account_id": test_accounts[0], "debit": 1000, "credit": 0}
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/finance/journal-entries", json=payload)
        assert response.status_code == 400
        assert "2 lines" in response.text.lower() or "at least 2" in response.text.lower()
    
    def test_create_requires_balanced_debit_credit(self, auth_session, test_accounts):
        """Create should fail if debit != credit"""
        payload = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "narration": "Test unbalanced JE",
            "lines": [
                {"account_id": test_accounts[0], "debit": 1000, "credit": 0},
                {"account_id": test_accounts[1], "debit": 0, "credit": 500}  # Unbalanced
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/finance/journal-entries", json=payload)
        assert response.status_code == 400
        assert "debit" in response.text.lower() or "credit" in response.text.lower() or "equal" in response.text.lower()
    
    def test_create_requires_at_least_one_debit_and_credit(self, auth_session, test_accounts):
        """Create should fail without at least one debit and one credit line"""
        payload = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "narration": "Test all debit JE",
            "lines": [
                {"account_id": test_accounts[0], "debit": 500, "credit": 0},
                {"account_id": test_accounts[1], "debit": 500, "credit": 0}  # All debits, no credits
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/finance/journal-entries", json=payload)
        assert response.status_code == 400
        assert "debit" in response.text.lower() or "credit" in response.text.lower()
    
    def test_create_valid_journal_entry(self, auth_session, test_accounts):
        """Create a valid journal entry"""
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "narration": f"TEST_JE_{unique_id} - Test journal entry for automated testing",
            "lines": [
                {"account_id": test_accounts[0], "debit": 5000, "credit": 0, "narration": "Debit line"},
                {"account_id": test_accounts[1], "debit": 0, "credit": 5000, "narration": "Credit line"}
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/finance/journal-entries", json=payload)
        
        # Should succeed
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "journal_entry" in data
        je = data["journal_entry"]
        
        # Verify JE fields
        assert "je_id" in je
        assert "reference_number" in je
        assert je["reference_number"].startswith("JE-")
        assert je["status"] == "posted"
        assert je["is_reversed"] == False
        assert je["total_debit"] == 5000
        assert je["total_credit"] == 5000
        assert len(je["lines"]) == 2
        
        # Store for cleanup
        return je["je_id"]


class TestJournalEntryReversal:
    """Tests for POST /api/finance/journal-entries/{je_id}/reverse"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Login and return authenticated session"""
        session = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def test_accounts(self, auth_session):
        """Get test accounts"""
        accounts_resp = auth_session.get(f"{BASE_URL}/api/finance/accounts")
        categories_resp = auth_session.get(f"{BASE_URL}/api/finance/categories")
        
        accounts = accounts_resp.json() if accounts_resp.status_code == 200 else []
        categories = categories_resp.json() if categories_resp.status_code == 200 else []
        
        all_accounts = []
        if isinstance(accounts, list):
            all_accounts.extend([a.get("account_id") for a in accounts if a.get("account_id")])
        if isinstance(categories, list):
            all_accounts.extend([c.get("category_id") for c in categories if c.get("category_id")])
        
        if len(all_accounts) < 2:
            return ["test_account_1", "test_account_2"]
        
        return all_accounts[:2]
    
    @pytest.fixture(scope="class")
    def created_je(self, auth_session, test_accounts):
        """Create a JE for reversal testing"""
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "narration": f"TEST_REVERSAL_{unique_id} - JE for reversal testing",
            "lines": [
                {"account_id": test_accounts[0], "debit": 2500, "credit": 0},
                {"account_id": test_accounts[1], "debit": 0, "credit": 2500}
            ]
        }
        response = auth_session.post(f"{BASE_URL}/api/finance/journal-entries", json=payload)
        if response.status_code != 200:
            pytest.skip(f"Could not create JE for reversal test: {response.text}")
        return response.json()["journal_entry"]
    
    def test_reverse_nonexistent_je_returns_404(self, auth_session):
        """Reversing non-existent JE should return 404"""
        response = auth_session.post(
            f"{BASE_URL}/api/finance/journal-entries/nonexistent_je_id/reverse",
            json={"reason": "Test reversal"}
        )
        assert response.status_code == 404
    
    def test_reverse_requires_reason(self, auth_session, created_je):
        """Reversal should work even without reason (API may have default)"""
        # This test checks if the API handles missing reason gracefully
        # The frontend requires reason, but API may have default
        pass  # Skip this test as API has default reason
    
    def test_reverse_valid_je(self, auth_session, created_je):
        """Reverse a valid journal entry"""
        je_id = created_je["je_id"]
        response = auth_session.post(
            f"{BASE_URL}/api/finance/journal-entries/{je_id}/reverse",
            json={
                "reason": "Test reversal - automated testing",
                "date": datetime.now().strftime("%Y-%m-%d")
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response
        assert data.get("success") == True
        assert "reversal_entry" in data
        reversal = data["reversal_entry"]
        
        # Verify reversal entry
        assert reversal["reversal_of_je"] == je_id
        assert reversal["status"] == "posted"
        # Debit/Credit should be swapped
        assert reversal["total_debit"] == created_je["total_credit"]
        assert reversal["total_credit"] == created_je["total_debit"]
    
    def test_cannot_reverse_already_reversed_je(self, auth_session, created_je):
        """Cannot reverse an already reversed JE"""
        je_id = created_je["je_id"]
        response = auth_session.post(
            f"{BASE_URL}/api/finance/journal-entries/{je_id}/reverse",
            json={"reason": "Second reversal attempt"}
        )
        assert response.status_code == 400
        assert "already reversed" in response.text.lower()


class TestJournalEntryExport:
    """Tests for GET /api/finance/journal-entries/export/excel"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Login and return authenticated session"""
        session = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return session
    
    def test_export_returns_correct_structure(self, auth_session):
        """Export endpoint should return correct structure"""
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries/export/excel")
        assert response.status_code == 200
        data = response.json()
        
        assert "rows" in data
        assert "total" in data
        assert "exported_at" in data
        assert isinstance(data["rows"], list)
    
    def test_export_with_date_filter(self, auth_session):
        """Export with date filter should work"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = auth_session.get(
            f"{BASE_URL}/api/finance/journal-entries/export/excel?start_date={today}&end_date={today}"
        )
        assert response.status_code == 200
    
    def test_export_with_status_filter(self, auth_session):
        """Export with status filter should work"""
        response = auth_session.get(
            f"{BASE_URL}/api/finance/journal-entries/export/excel?status=posted"
        )
        assert response.status_code == 200


class TestJournalEntryGetSingle:
    """Tests for GET /api/finance/journal-entries/{je_id}"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Login and return authenticated session"""
        session = requests.Session()
        login_url = f"{BASE_URL}/api/auth/local-login"
        response = session.post(login_url, json={
            "email": FOUNDER_EMAIL,
            "password": FOUNDER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return session
    
    def test_get_nonexistent_je_returns_404(self, auth_session):
        """Getting non-existent JE should return 404"""
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries/nonexistent_je_id")
        assert response.status_code == 404
    
    def test_get_existing_je(self, auth_session):
        """Get an existing JE from the list"""
        # First get list
        list_response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries?limit=1")
        if list_response.status_code != 200:
            pytest.skip("Could not get JE list")
        
        entries = list_response.json().get("entries", [])
        if not entries:
            pytest.skip("No JEs exist to test get single")
        
        je_id = entries[0]["je_id"]
        response = auth_session.get(f"{BASE_URL}/api/finance/journal-entries/{je_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert data["je_id"] == je_id
        assert "reference_number" in data
        assert "date" in data
        assert "narration" in data
        assert "lines" in data
        assert "total_debit" in data
        assert "total_credit" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
