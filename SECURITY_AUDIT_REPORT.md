# Full Application Security Audit Report
**Date:** February 20, 2026  
**Application:** Arkiflo - Interior Design Workflow System  
**Auditor:** AI Security Review  
**Scope:** Full Application (All Modules)

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 4 | 🔴 Immediate action required |
| **HIGH** | 6 | 🟠 Fix before launch |
| **MEDIUM** | 7 | 🟡 Fix in next sprint |
| **LOW** | 5 | 🟢 Backlog items |

---

## 🔴 CRITICAL VULNERABILITIES

### C1. Weak Password Hashing with Hardcoded Salt
**Location:** `/app/backend/server.py` lines 222-229  
**Affected:** All local login users

```python
def hash_password(password: str) -> str:
    salt = "arkiflo_local_salt_2024"  # HARDCODED SALT
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()
```

**Risk:** 
- SHA-256 is NOT suitable for password hashing (too fast, vulnerable to brute force)
- Hardcoded salt means all users share the same salt (rainbow table attack possible)
- If database is compromised, all passwords can be cracked quickly

**Recommendation:** 
- Use `bcrypt` or `argon2` with per-user random salt
- Migration script needed for existing passwords

---

### C2. Hardcoded Admin Credentials in Source Code
**Location:** `/app/backend/server.py` lines 1634-1635  
**Endpoint:** `POST /api/auth/setup-local-admin`

```python
admin_email = "thaha.pakayil@gmail.com"
admin_password = "password123"
```

**Risk:**
- Anyone can call this endpoint to create/reset admin account
- Password is exposed in source code
- No authentication required to call this endpoint

**Recommendation:**
- Remove hardcoded credentials
- Require existing admin to create new admins
- Use environment variables for initial setup only

---

### C3. CORS Wildcard Configuration
**Location:** `/app/backend/.env` and `/app/backend/server.py` line 41922  

```python
allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
```
```
CORS_ORIGINS="*"
```

**Risk:**
- Allows requests from ANY origin
- Cross-site request attacks possible
- Cookie stealing from malicious sites

**Recommendation:**
- Set explicit allowed origins: `CORS_ORIGINS="https://arkiflo.arkidots.com,https://app.arkiflo.com"`
- Remove wildcard before production

---

### C4. Missing Permission Check on Trial Balance
**Location:** `/app/backend/server.py` line 28286  
**Endpoint:** `GET /api/finance/trial-balance`

```python
@api_router.get("/finance/trial-balance")
async def get_trial_balance(request: Request, ...):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # NO PERMISSION CHECK - Any authenticated user can access!
```

**Risk:**
- Any logged-in user (even Designer, PreSales) can view complete financial data
- Sensitive financial information exposed

**Recommendation:**
- Add permission check: `finance.trial_balance.view` or role-based restriction

---

## 🟠 HIGH SEVERITY VULNERABILITIES

### H1. No Rate Limiting on Login Endpoint
**Location:** `/app/backend/server.py` line 1551  
**Endpoint:** `POST /api/auth/local-login`

**Risk:**
- Brute force attacks possible
- Credential stuffing attacks
- No protection against automated attacks

**Recommendation:**
- Implement rate limiting using `slowapi`
- Limit to 5 attempts per 15 minutes per IP
- Add exponential backoff after failures

---

### H2. No CSRF Protection
**Location:** Application-wide  

**Risk:**
- State-changing requests can be forged from malicious sites
- Session cookies sent automatically with cross-origin requests
- Financial transactions could be triggered without user consent

**Recommendation:**
- Implement CSRF tokens for all POST/PUT/DELETE requests
- Use `SameSite=Strict` for cookies (currently `SameSite=none`)

---

### H3. Public Service Request Endpoint (No Auth)
**Location:** `/app/backend/server.py` line 20261  
**Endpoint:** `POST /api/service-requests/from-google-form`

**Risk:**
- No authentication required
- Spam injection possible
- Data validation limited
- Potential DoS vector

**Recommendation:**
- Add rate limiting (IP-based)
- Implement CAPTCHA or webhook validation
- Validate Google Form origin

---

### H4. Dashboard Endpoints with Role-Only Checks
**Location:** Multiple dashboard endpoints  
**Endpoints:** `/dashboards/finance`, `/dashboards/sales`, `/dashboards/designer`

**Risk:**
- Uses role string matching instead of permission system
- Roles can be manipulated if user document is compromised
- Inconsistent with permission-based access model

**Recommendation:**
- Migrate to permission-based checks: `has_permission(user_doc, "dashboard.finance.view")`

---

### H5. Session Cookie SameSite=None
**Location:** `/app/backend/server.py` lines 1280, 1539, 1601

```python
response.set_cookie(
    key="session_token",
    httponly=True,
    secure=True,
    samesite="none",  # ALLOWS CROSS-SITE REQUESTS
)
```

**Risk:**
- Cookies sent on cross-origin requests
- CSRF attacks possible
- Session hijacking from third-party sites

**Recommendation:**
- Change to `samesite="strict"` or `samesite="lax"` for production

---

### H6. NoSQL Injection via Unescaped Regex
**Location:** Multiple search endpoints  
**Example:** `/app/backend/server.py` line 19791

```python
{"pid": {"$regex": search, "$options": "i"}}
```

**Risk:**
- User input directly in regex pattern
- ReDoS (Regex Denial of Service) possible
- MongoDB regex injection

**Recommendation:**
- Escape user input: `re.escape(search)` before using in regex
- Add regex complexity limits

---

## 🟡 MEDIUM SEVERITY VULNERABILITIES

### M1. Missing Permission Check on General Ledger Accounts List
**Location:** `/app/backend/server.py`  
**Risk:** Mixed permission model (OR condition may be too permissive)

---

### M2. Audit Logging Gaps in Delete Operations
**Location:** Multiple delete endpoints  
**Risk:** 
- Notification deletions not logged
- Approval rule deletions not logged
- Difficult to track malicious deletions

**Recommendation:**
- Add audit logging to all delete operations

---

### M3. No File Content Validation
**Location:** `/app/backend/server.py` line 21186 (academy upload)  
**Risk:**
- Only extension is validated, not actual file content
- Malicious files could be uploaded with allowed extensions

**Recommendation:**
- Validate file magic bytes
- Scan uploaded files for malware
- Use dedicated file storage service

---

### M4. Session Expiry Set to 7 Days
**Location:** `/app/backend/server.py` lines 1266, 1516, 1582

**Risk:**
- Long session lifetime increases window for session theft
- No session rotation after sensitive actions

**Recommendation:**
- Reduce to 24 hours for standard sessions
- Implement session rotation after password change
- Add "remember me" option for extended sessions

---

### M5. MongoDB ObjectId Exposure in Some Queries
**Location:** Multiple find queries without `{"_id": 0}` projection  
**Risk:** Internal database IDs exposed in responses

---

### M6. Missing Input Length Validation
**Location:** Multiple Pydantic models  
**Risk:**
- Very long inputs could cause performance issues
- Potential buffer overflow in downstream processing

**Recommendation:**
- Add `max_length` constraints to string fields

---

### M7. Google Client Secret in .env (Not Encrypted)
**Location:** `/app/backend/.env`

```
GOOGLE_CLIENT_SECRET="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"
```

**Risk:**
- Secrets in plain text
- Could be exposed in logs or version control

**Recommendation:**
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Rotate credentials regularly

---

## 🟢 LOW SEVERITY VULNERABILITIES

### L1. Verbose Error Messages in Auth
**Location:** `/app/backend/server.py` line 1567, 1571  
**Issue:** "Invalid email or password" - reveals that email validation occurs separately
**Recommendation:** Generic "Authentication failed" message

---

### L2. No Request ID for Audit Trail
**Location:** Application-wide  
**Issue:** Cannot correlate logs across distributed systems
**Recommendation:** Add X-Request-ID header tracking

---

### L3. Missing Content-Security-Policy Header
**Location:** Frontend  
**Risk:** XSS attacks not mitigated at browser level
**Recommendation:** Add CSP headers

---

### L4. No API Versioning
**Location:** All endpoints  
**Risk:** Breaking changes affect all clients
**Recommendation:** Add `/api/v1/` prefix

---

### L5. Admin Import Endpoints Missing Full Validation
**Location:** Import endpoints  
**Risk:** Malformed data could corrupt database
**Recommendation:** Add schema validation before import

---

## ✅ SECURITY CONTROLS IN PLACE

| Control | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ | Session-based with secure cookies |
| Authorization | ⚠️ | Permission system exists but inconsistently applied |
| HTTPS | ✅ | Enforced via Kubernetes ingress |
| Password Hashing | ❌ | Weak (SHA-256 + hardcoded salt) |
| Session Management | ⚠️ | Works but SameSite too permissive |
| Input Validation | ⚠️ | Pydantic models but missing length limits |
| Output Encoding | ✅ | JSON responses (no HTML injection) |
| File Upload | ⚠️ | Extension validated, content not validated |
| Audit Logging | ⚠️ | Present for most finance operations, gaps exist |
| Rate Limiting | ❌ | Not implemented |
| CSRF Protection | ❌ | Not implemented |
| CORS | ❌ | Wildcard enabled |

---

## Priority Fix Order

### Phase 1: Before Launch (Critical + High)
1. **C1** - Replace SHA-256 with bcrypt for password hashing
2. **C2** - Remove hardcoded admin credentials
3. **C3** - Restrict CORS to specific origins
4. **C4** - Add permission check to Trial Balance
5. **H1** - Implement rate limiting on login
6. **H2** - Add CSRF protection
7. **H5** - Fix SameSite cookie attribute

### Phase 2: First Week Post-Launch
8. **H3** - Rate limit public endpoints
9. **H4** - Migrate dashboards to permission-based access
10. **H6** - Escape regex inputs

### Phase 3: Ongoing Hardening
11. Medium and Low severity items
12. Security monitoring and alerting
13. Penetration testing

---

## Appendix: Files Requiring Changes

| File | Changes Required | Priority |
|------|------------------|----------|
| `/app/backend/server.py` | Password hashing, permission checks, rate limiting | Critical |
| `/app/backend/.env` | CORS origins, secrets management | Critical |
| `/app/frontend/.env` | CSP headers | Medium |

---

**Report Generated:** February 20, 2026  
**Next Review:** Before production deployment
