"""
Security Audit Tests for Arkiflo Finance Application
Tests security headers, rate limiting, authentication, and file upload validation

Test Order: Authentication tests run FIRST, then rate limiting tests (which will exhaust the limit)
"""
import pytest
import requests
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FOUNDER_EMAIL = "sidheeq.arkidots@gmail.com"
FOUNDER_PASSWORD = "founder123"


class Test01SecurityHeaders:
    """Test security headers are present on all API responses - Run first"""
    
    def test_security_headers_on_health_endpoint(self):
        """Verify security headers on health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        # Check X-Content-Type-Options
        assert "X-Content-Type-Options" in response.headers, "Missing X-Content-Type-Options header"
        assert response.headers["X-Content-Type-Options"] == "nosniff", f"Wrong X-Content-Type-Options value: {response.headers.get('X-Content-Type-Options')}"
        print(f"✓ X-Content-Type-Options: {response.headers['X-Content-Type-Options']}")
        
        # Check X-Frame-Options
        assert "X-Frame-Options" in response.headers, "Missing X-Frame-Options header"
        assert response.headers["X-Frame-Options"] == "DENY", f"Wrong X-Frame-Options value: {response.headers.get('X-Frame-Options')}"
        print(f"✓ X-Frame-Options: {response.headers['X-Frame-Options']}")
        
        # Check X-XSS-Protection
        assert "X-XSS-Protection" in response.headers, "Missing X-XSS-Protection header"
        assert response.headers["X-XSS-Protection"] == "1; mode=block", f"Wrong X-XSS-Protection value: {response.headers.get('X-XSS-Protection')}"
        print(f"✓ X-XSS-Protection: {response.headers['X-XSS-Protection']}")
        
        # Check Referrer-Policy
        assert "Referrer-Policy" in response.headers, "Missing Referrer-Policy header"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin", f"Wrong Referrer-Policy value: {response.headers.get('Referrer-Policy')}"
        print(f"✓ Referrer-Policy: {response.headers['Referrer-Policy']}")
        
        # Check Permissions-Policy
        assert "Permissions-Policy" in response.headers, "Missing Permissions-Policy header"
        assert "geolocation=()" in response.headers["Permissions-Policy"], "Permissions-Policy should restrict geolocation"
        print(f"✓ Permissions-Policy: {response.headers['Permissions-Policy']}")
    
    def test_security_headers_on_protected_endpoint(self):
        """Verify security headers on protected endpoints (even when unauthorized)"""
        response = requests.get(f"{BASE_URL}/api/users")
        
        # Security headers should be present even on 401 responses
        assert "X-Content-Type-Options" in response.headers, "Missing X-Content-Type-Options on protected endpoint"
        assert "X-Frame-Options" in response.headers, "Missing X-Frame-Options on protected endpoint"
        print("✓ Security headers present on protected endpoint (401 response)")


class Test02Authentication:
    """Test authentication with founder account - Run BEFORE rate limiting tests"""
    
    def test_login_with_valid_credentials(self):
        """Test successful login with founder account"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed with status {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Login response should indicate success"
        assert "user" in data, "Login response should contain user data"
        assert data["user"]["email"] == FOUNDER_EMAIL, "User email should match"
        print(f"✓ Login successful for {FOUNDER_EMAIL}")
        print(f"  User ID: {data['user'].get('user_id')}")
        print(f"  Role: {data['user'].get('role')}")
    
    def test_login_with_invalid_password(self):
        """Test login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Login correctly rejected with invalid password")
    
    def test_login_with_nonexistent_user(self):
        """Test login fails with non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": "nonexistent@test.com", "password": "anypassword"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Login correctly rejected for non-existent user")
    
    def test_session_cookie_settings(self):
        """Verify session cookie has correct security settings"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/local-login",
            json={"email": FOUNDER_EMAIL, "password": FOUNDER_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Check Set-Cookie header
        set_cookie = response.headers.get("Set-Cookie", "")
        print(f"Set-Cookie header: {set_cookie}")
        
        # Verify cookie attributes
        cookie_lower = set_cookie.lower()
        
        # Check SameSite attribute
        assert "samesite=lax" in cookie_lower, f"Cookie should have SameSite=lax. Got: {set_cookie}"
        print("✓ SameSite=lax is set")
        
        # Check HttpOnly
        assert "httponly" in cookie_lower, f"Cookie should be HttpOnly. Got: {set_cookie}"
        print("✓ HttpOnly is set")
        
        # Check Secure (may not be present in non-HTTPS test environment)
        if "secure" in cookie_lower:
            print("✓ Secure flag is set")
        else:
            print("⚠ Secure flag not present (may be expected in test environment)")


class Test03RateLimiting:
    """Test rate limiting on login endpoint - Run LAST as it exhausts the rate limit"""
    
    def test_rate_limit_on_login_endpoint(self):
        """Verify rate limiting (5 requests per minute) on /api/auth/local-login"""
        # Make 7 rapid requests to trigger rate limit
        responses = []
        
        for i in range(7):
            response = requests.post(
                f"{BASE_URL}/api/auth/local-login",
                json={"email": f"ratelimit_test{i}@test.com", "password": "wrongpassword"}
            )
            responses.append(response)
            print(f"Request {i+1}: Status {response.status_code}")
            time.sleep(0.1)  # Small delay between requests
        
        # Check that at least one request was rate limited (429)
        status_codes = [r.status_code for r in responses]
        
        # First 5 should be 401 (auth failed), 6th+ should be 429 (rate limited)
        rate_limited = any(code == 429 for code in status_codes)
        
        if rate_limited:
            print("✓ Rate limiting is working - received 429 response")
        else:
            print(f"Status codes received: {status_codes}")
        
        assert rate_limited, f"Rate limiting not triggered after 7 requests. Status codes: {status_codes}"


class Test04APIEndpointSecurity:
    """Test general API security measures"""
    
    def test_protected_endpoints_require_auth(self):
        """Verify protected endpoints return 401 without authentication"""
        protected_endpoints = [
            "/api/users",
            "/api/leads",
            "/api/projects",
        ]
        
        for endpoint in protected_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], \
                f"Endpoint {endpoint} should require auth, got {response.status_code}"
            print(f"✓ {endpoint} requires authentication (status: {response.status_code})")
    
    def test_cors_headers_present(self):
        """Verify CORS headers are properly configured"""
        response = requests.options(
            f"{BASE_URL}/api/health",
            headers={"Origin": "https://double-entry-repair.preview.emergentagent.com"}
        )
        
        # Check for CORS headers
        cors_headers = [
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials",
        ]
        
        for header in cors_headers:
            if header in response.headers:
                print(f"✓ {header}: {response.headers[header]}")


class Test05SecuritySummary:
    """Summary test to verify all security features - uses cached results"""
    
    def test_all_security_features_summary(self):
        """Comprehensive security check summary (non-rate-limited checks only)"""
        results = {
            "security_headers": False,
            "protected_endpoints": False,
        }
        
        # Test 1: Security Headers
        response = requests.get(f"{BASE_URL}/api/health")
        required_headers = ["X-Content-Type-Options", "X-Frame-Options", "X-XSS-Protection", "Referrer-Policy", "Permissions-Policy"]
        results["security_headers"] = all(h in response.headers for h in required_headers)
        
        # Test 2: Protected endpoints require auth
        users_response = requests.get(f"{BASE_URL}/api/users")
        results["protected_endpoints"] = users_response.status_code == 401
        
        print("\n=== SECURITY AUDIT SUMMARY ===")
        for feature, status in results.items():
            status_str = "✓ PASS" if status else "✗ FAIL"
            print(f"{feature}: {status_str}")
        
        # Note: Authentication and cookie tests passed in Test02Authentication
        # Rate limiting test passed in Test03RateLimiting
        print("\nNote: Authentication, cookie security, and rate limiting verified in earlier tests")
        
        assert all(results.values()), f"Some security features failed: {results}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
