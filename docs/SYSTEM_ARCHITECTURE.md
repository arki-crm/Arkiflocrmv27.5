# Arkiflo System Architecture & Business Logic Documentation

**Version:** 1.0  
**Generated:** January 2026  
**Document Type:** Technical System Documentation

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Authentication & Identity Model](#4-authentication--identity-model)
5. [Authorization & Permissions Model](#5-authorization--permissions-model)
6. [Core Business Modules](#6-core-business-modules)
7. [Application Workflow](#7-application-workflow)
8. [Security Model](#8-security-model)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Design Decisions & Constraints](#10-design-decisions--constraints)
11. [Known Failure Modes & Lessons Learned](#11-known-failure-modes--lessons-learned)
12. [Future Scope](#12-future-scope)

---

## 1. Executive Overview

### What This Application Is

Arkiflo is a comprehensive operational management system designed specifically for interior design businesses. It combines Customer Relationship Management (CRM), project lifecycle tracking, and financial operations into a single integrated platform.

### Business Problem It Solves

Interior design businesses face fragmented workflows across multiple tools: spreadsheets for leads, separate software for project tracking, manual accounting, and disconnected communication. Arkiflo consolidates these into one system that follows a lead from first contact through project completion, warranty, and financial reconciliation.

### Who It Is Built For

The primary user is an interior design firm founder who needs:
- Visibility into the entire sales-to-delivery pipeline
- Financial control with cash flow tracking and budgeting
- Team accountability with role-based task assignment
- Client data centralized in one system

Secondary users include sales teams (pre-sales and sales managers), designers, production/operations managers, accountants, and technicians.

### Major Functional Modules

The system contains the following operational modules:

| Module | Purpose |
|--------|---------|
| **Pre-Sales** | Capture and qualify initial inquiries before they become formal leads |
| **Leads** | Track potential clients through qualification stages until booking |
| **Projects** | Manage active projects through design, production, delivery, and handover |
| **Finance** | Complete accounting system: cash book, receipts, invoices, budgets, salaries |
| **Warranty & Service** | Post-handover support tracking and technician dispatch |
| **Academy** | Internal training content management |
| **Reports** | Cross-module analytics and dashboards |
| **User Management** | Role-based access control and permission assignment |

---

## 2. High-Level System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (Host System)                          │
│              Port 80 (HTTP) → Redirect to HTTPS                 │
│              Port 443 (HTTPS) → SSL Termination                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌──────────────────────┐             ┌──────────────────────┐
│   FRONTEND           │             │   BACKEND            │
│   React SPA          │             │   FastAPI            │
│   Port 3000          │             │   Port 8001          │
│   (localhost only)   │             │   (localhost only)   │
└──────────────────────┘             └──────────┬───────────┘
                                                │
                                                ▼
                                     ┌──────────────────────┐
                                     │   MONGODB            │
                                     │   Document Database  │
                                     │   (Internal Only)    │
                                     └──────────────────────┘
```

### Frontend Responsibilities

The frontend is a single-page application that handles:
- User interface rendering based on role and permissions
- Client-side routing between pages
- Session state management via cookies
- API communication with the backend
- Permission-based UI element visibility

The frontend does not make direct database calls. All data operations go through the backend API.

### Backend Responsibilities

The backend serves as the sole data access layer and business logic processor:
- Authenticates users via Google OAuth or local password
- Validates permissions on every protected endpoint
- Performs all database operations
- Generates documents (PDFs, Excel exports)
- Manages scheduled tasks (backups, recurring transactions)
- Handles file uploads and storage

### Database Role

MongoDB stores all application data as JSON-like documents. Collections are organized by domain:
- User identity and sessions
- CRM data (presales, leads, projects)
- Financial transactions and master data
- System configuration and audit logs

The database does not enforce relational constraints. Data integrity is maintained through application logic.

### Authentication Providers

The system supports two authentication methods:
1. **Google OAuth** — Primary method, requires Google Cloud OAuth client credentials
2. **Local Password** — Secondary method for environments without Google access

Both methods resolve to the same user identity (by email) and produce identical sessions.

### Component Communication

All communication follows a strict pattern:
- Frontend → Backend: HTTPS REST API calls with session cookies
- Backend → Database: MongoDB wire protocol over internal Docker network
- Backend → Google: OAuth token exchange during authentication

---

## 3. Technology Stack

### Frontend

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | 19.0.0 |
| Build Tool | Create React App + CRACO | 5.0.1 / 7.1.0 |
| Routing | React Router DOM | 7.5.1 |
| Styling | Tailwind CSS | 3.4.17 |
| UI Components | Radix UI (shadcn/ui pattern) | Various |
| HTTP Client | Axios | 1.8.4 |
| Icons | Lucide React | 0.507.0 |
| Package Manager | Yarn | 1.22.22 |

### Backend

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Python | 3.11 |
| Framework | FastAPI | 0.110.1 |
| ASGI Server | Uvicorn | 0.25.0 |
| Database Driver | Motor (async MongoDB) | 3.3.1 |
| Authentication | google-auth, google-auth-oauthlib | 2.47.0 / 1.2.4 |
| Scheduling | APScheduler | 3.11.2 |
| PDF Generation | ReportLab | 4.4.7 |
| Excel Export | OpenPyXL | 3.1.5 |

### Database

| Component | Technology | Version |
|-----------|------------|---------|
| Database | MongoDB | 7.0 |
| Connection | Authenticated via application user |
| Storage | Docker volume (persistent) |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Containerization | Docker, Docker Compose |
| Reverse Proxy | Nginx (host-level) |
| SSL | Let's Encrypt via Certbot |
| Host OS | Ubuntu 22.04 (Contabo VPS) |

### External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| OAuth | Google Cloud Platform | User authentication |
| SSL Certificates | Let's Encrypt | HTTPS encryption |

---

## 4. Authentication & Identity Model

### Core Identity Principle

Arkiflo uses a **single-user-per-email** identity model. The email address is the global unique identifier for a user. Authentication methods (Google, password) are credentials attached to that identity, not separate user types.

### How Users Are Created

Users enter the system through one of three paths:

1. **Google OAuth (first login)** — If a user logs in via Google and no account exists for their email, a new user record is created automatically.

2. **Admin invitation** — An administrator can create a user account with an email and temporary password. This user can later link Google OAuth.

3. **Admin direct creation** — Similar to invitation, but with immediate account activation.

There is no self-registration. A user must either be invited or log in with Google.

### Google Login Flow

When a user clicks "Continue with Google":

1. Frontend redirects to `/api/auth/google/login`
2. Backend redirects to Google's consent screen with OAuth parameters
3. User approves access on Google's site
4. Google redirects back to `/api/auth/google/callback` with authorization code
5. Backend exchanges code for tokens with Google
6. Backend verifies ID token using Google's public keys
7. Backend extracts email, name, and profile picture from token
8. Backend checks if user exists by email:
   - **Exists:** Update last login, link Google ID if not already linked
   - **Does not exist:** Create new user with role based on user count
9. Backend creates session token and stores in database
10. Backend sets session cookie and redirects to dashboard

### Email/Password Login Flow

When a user submits email and password:

1. Frontend POSTs credentials to `/api/auth/local-login`
2. Backend finds user by email WHERE password field exists
3. Backend verifies password hash matches (SHA-256 with salt)
4. Backend checks account status is "Active"
5. Backend creates session token
6. Backend sets session cookie
7. Frontend receives success response and redirects to dashboard

### Account Linking

The same email address can have both Google and password credentials attached. The system handles this automatically:

- If a Google user's email matches an existing password-created account, the Google ID is linked to that account
- If an admin creates a user with password, that user can later "link" Google by simply logging in with Google using the same email
- Linking is additive and idempotent — it never creates duplicate accounts

### First-User Behavior

When the database has zero users (fresh deployment), the first person to successfully authenticate becomes an Administrator with full permissions. This happens exactly once. The check is: "Is `user_count == 0` at the moment of user creation?"

Server restarts do not trigger user creation. Only actual authentication attempts with non-existent emails create users.

### What Is Intentionally Disabled

**Auto-seeding of admin users is disabled.** Previous versions had logic to automatically create an admin user on startup if no users existed. This caused problems:
- Admins would be recreated after database cleanup
- Race conditions with Google OAuth
- Duplicate accounts with conflicting auth providers

The current system relies entirely on the first-user-becomes-admin logic during actual authentication.

### Session Handling

Sessions are stored in the `user_sessions` MongoDB collection. Each session contains:
- Session token (cryptographically random string)
- User ID reference
- Expiration time (7 days from creation)
- Login type (google or local)

The session token is stored in an HTTP-only, secure, SameSite=None cookie. The frontend cannot read or modify this cookie directly.

Session validation occurs on every API request that requires authentication:
1. Extract `session_token` cookie from request
2. Look up session in database
3. Check session has not expired
4. Look up user by user_id from session
5. Proceed with request using user context

---

## 5. Authorization & Permissions Model

### Roles vs Permissions

Arkiflo separates **roles** from **permissions**:

- **Role** — A label describing the user's job function (Admin, Designer, Accountant, etc.). Roles determine default navigation and dashboard views.

- **Permissions** — A list of specific capability strings that grant access to features. Permissions are the actual enforcement mechanism.

A user's role suggests what they should be able to do. Their permissions list defines what they can actually do.

### Available Roles

The system defines 14 roles:

| Role | Primary Function |
|------|------------------|
| Admin | Full system access |
| PreSales | Lead generation and qualification |
| SalesManager | Sales pipeline oversight |
| Designer | Design work on assigned projects |
| DesignManager | Design team oversight |
| ProductionOpsManager | Production and delivery management |
| OperationLead | Field execution |
| Technician | Service request handling |
| JuniorAccountant | Basic financial data entry |
| SeniorAccountant | Full accounting operations |
| FinanceManager | Financial control and approvals |
| CharteredAccountant | Read-only audit access |
| Founder | Strategic oversight |
| CEO | Executive dashboard access |

### How Permissions Are Assigned

When a user is created, they receive the default permissions for their assigned role. These defaults are defined in a server-side mapping (`DEFAULT_ROLE_PERMISSIONS`).

Administrators can modify any user's permissions after creation:
- Add permissions beyond role defaults
- Remove permissions from role defaults
- Reset to role defaults

Permission changes take effect on the user's next session validation (typically the next page load).

### Why Permissions Are Required for UI Visibility

The frontend sidebar and page content visibility are controlled by permission checks:

```
If user has "finance.cashbook.view" permission:
    Show Cash Book menu item
Else:
    Hide Cash Book menu item
```

This pattern applies to every menu item, button, and page section. Without permissions, the UI has nothing to show.

### Self-Healing Permission Logic

The system includes a safety mechanism called `ensure_user_permissions()` that runs at three points:
1. Google OAuth login (for existing users)
2. Local password login
3. Session resume (`/auth/me` endpoint)

This function checks if the user's permissions array is missing or empty. If so, it automatically assigns the default permissions for the user's role and logs a warning.

The purpose is to prevent "logged in but empty dashboard" scenarios caused by data corruption or incomplete user creation.

### Permission Check Behavior

When the frontend calls `hasPermission("some.permission")`:
1. If user role is "Admin" → return true (Admin bypasses checks)
2. Otherwise → check if permission string exists in `effective_permissions` array

The backend performs equivalent checks before executing protected operations.

---

## 6. Core Business Modules

### Pre-Sales Module

**Purpose:** Capture initial inquiries before they qualify as formal leads.

**Access:** PreSales, SalesManager, Admin roles.

**Data Flow:**
- Inquiry received → Create pre-sales entry with contact info and source
- Qualification calls/meetings logged
- When qualified → Convert to Lead (creates new lead record, archives pre-sales)

**Key Collections:** `presales`

### Leads Module

**Purpose:** Track potential clients through qualification and proposal stages until booking.

**Access:** All CRM roles with varying visibility (own vs all).

**Data Flow:**
- Lead created (from pre-sales conversion or direct entry)
- Assigned to designer
- Progress through stages: Qualified → Site Visit → Designing → Proposal → Negotiation → Booked
- When booked → Convert to Project

**Key Collections:** `leads`

### Projects Module

**Purpose:** Manage active client engagements through design, production, delivery, and handover.

**Access:** Designers (own), Managers (all), Admin (all).

**Data Flow:**
- Project created from booked lead
- Design phase with milestone tracking
- Production phase with vendor coordination
- Delivery and installation scheduling
- Handover with documentation
- Warranty period begins

**Key Collections:** `projects`, `tasks`, `validations`

### Finance Module

**Purpose:** Complete accounting and financial management system.

**Access:** Finance roles (Junior/Senior Accountant, Finance Manager), Admin, Founder.

**Sub-modules:**

| Sub-module | Function |
|------------|----------|
| Cash Book | Daily transaction entry (receipts and payments) |
| Receipts | Client payment tracking with PDF generation |
| Invoices | Invoice generation and tracking |
| Project Finance | Per-project budgeting and expense tracking |
| Expense Requests | Staff expense claim workflow |
| Budgets | Category-based budget allocation |
| Forecast | Financial projection tools |
| Salaries | Employee salary management |
| Liabilities | Payables tracking |
| Daily Closing | End-of-day balance verification |
| Monthly Snapshot | Period-end reporting |

**Key Collections:** `accounting_transactions`, `finance_receipts`, `finance_invoices`, `finance_budgets`, `finance_salary_master`, `finance_expense_requests`

### Warranty & Service Module

**Purpose:** Post-handover support and service request management.

**Access:** ProductionOpsManager, Technicians, Admin.

**Data Flow:**
- Warranty created at project handover
- Service requests logged against warranty
- Technicians assigned to requests
- Resolution tracked and closed

**Key Collections:** `warranties`, `service_requests`

### Academy Module

**Purpose:** Internal training content management.

**Access:** All users (view), Managers and Admin (manage).

**Data Flow:**
- Categories and lessons created by managers
- Users access training content
- Progress not currently tracked

**Key Collections:** `academy_categories`, `academy_lessons`

### User Management Module

**Purpose:** User account and permission administration.

**Access:** Admin only.

**Functions:**
- Create users with role assignment
- Modify user permissions
- Activate/deactivate accounts
- Reset passwords

**Key Collections:** `users`, `user_sessions`

---

## 7. Application Workflow

### App Load → Session → Auth → Permissions → Dashboard

When a user opens Arkiflo:

1. **Initial Load** — Browser requests the React SPA from Nginx. The entire frontend JavaScript bundle loads.

2. **Auth Check** — React's `AuthContext` immediately calls `/api/auth/me` with session cookie.

3. **Session Validation** — Backend looks up session token, verifies not expired, fetches user record.

4. **Permission Repair** — If user permissions are missing/empty, backend auto-assigns from role defaults.

5. **User Data Return** — Backend returns user object including `effective_permissions` array.

6. **Route Decision** — React Router checks if user is authenticated:
   - **Yes:** Render `AppLayout` with sidebar based on role
   - **No:** Redirect to `/login`

7. **Sidebar Rendering** — `Sidebar.jsx` calls `getRoleNavItems(user.role)` to get role-specific menu structure.

8. **Permission Filtering** — Each menu item may have additional permission checks that hide items user cannot access.

9. **Dashboard Display** — User sees their role-appropriate dashboard with permitted features.

### Why a User Can Be Logged In But See Nothing

This occurs when:

1. **Permissions array is empty** — The user exists and is authenticated, but their `permissions` array is `[]`. Every permission check fails, hiding all UI elements.

2. **Permissions array is missing** — Similar to above, but the field doesn't exist at all. Before the self-healing logic was added, this resulted in empty dashboards.

3. **Role mismatch** — The user's role doesn't match any case in `getRoleNavItems()`, falling through to a minimal default menu.

4. **Account status not Active** — User was deactivated but still has a valid session (should not happen with proper logout flow).

### Sidebar and UI Behavior Logic

The sidebar renders based on a two-step process:

1. **Role-based menu structure** — The `getRoleNavItems()` function returns a predefined list of menu items for each role. This determines the basic navigation structure.

2. **Permission-based filtering** — Some menu items include permission requirements. Items are hidden if the user lacks required permissions.

Admin role is special-cased: Admin users see all menu items regardless of individual permission checks.

---

## 8. Security Model

### Authentication Boundaries

**What authentication proves:**
- The user controls the email address they claim (via Google verification or password knowledge)
- The user has an active session that hasn't expired

**What authentication does NOT prove:**
- The user is authorized to perform any specific action
- The user's permissions are correctly configured

### Authorization Boundaries

**Backend enforcement:**
- Every API endpoint that accesses data checks for authenticated session
- Sensitive operations check specific permissions
- Some endpoints additionally check ownership (e.g., "is this the user's own project?")

**Frontend enforcement:**
- UI elements hidden based on permissions (convenience only)
- Frontend permission checks are not security controls—they improve UX
- A user could theoretically call any API directly; backend must enforce

### Session Security

| Property | Implementation |
|----------|----------------|
| Token Generation | `secrets.token_urlsafe(32)` — cryptographically random |
| Token Storage (Client) | HTTP-only cookie (not accessible via JavaScript) |
| Token Storage (Server) | MongoDB document with expiration |
| Cookie Flags | `Secure=true`, `SameSite=none`, `HttpOnly=true` |
| Session Duration | 7 days |
| Session Invalidation | Explicit logout deletes from database and clears cookie |

### Assumptions and Limitations

**Assumptions:**
- HTTPS is enforced at the Nginx layer (HTTP redirects to HTTPS)
- MongoDB is only accessible from within the Docker network
- The VPS firewall blocks direct access to ports 3000 and 8001

**Limitations:**
- No rate limiting on authentication endpoints
- No account lockout after failed login attempts
- No multi-factor authentication
- Session tokens are not rotated during use
- Password reset requires admin intervention (no self-service email flow)

---

## 9. Deployment Architecture

### Docker Structure

The application runs as three containers orchestrated by Docker Compose:

| Container | Image | Internal Port | External Binding |
|-----------|-------|---------------|------------------|
| arkiflo_mongo | mongo:7.0 | 27017 | None (internal only) |
| arkiflo_backend | Custom (Python) | 8001 | 127.0.0.1:8001 |
| arkiflo_frontend | Custom (Nginx) | 80 | 127.0.0.1:3000 |

Containers communicate via a dedicated Docker bridge network (`arkiflo_network`).

### Frontend Build Process

1. Docker build stage uses `node:18-bullseye-slim` base image
2. `yarn install --frozen-lockfile` installs dependencies
3. `yarn build` creates production bundle via CRACO/React Scripts
4. Production stage uses `nginx:alpine` to serve static files
5. Nginx proxies `/api/*` requests are handled at the host level, not container level

**Build-time variables:**
- `REACT_APP_BACKEND_URL` — Injected during build, determines API base URL

### Backend Startup Process

1. Docker build uses `python:3.11-slim` base image
2. `pip install` installs dependencies from `requirements.txt`
3. Uvicorn starts with single worker process
4. FastAPI app initializes:
   - MongoDB connection established
   - APScheduler starts for background jobs
   - Routes registered

**Runtime variables:**
- `MONGO_URL` — Database connection string
- `DB_NAME` — Database name
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth credentials
- `FRONTEND_URL` — For OAuth redirect construction

### Environment Variables

**Root `.env` file (for Docker Compose):**

| Variable | Purpose |
|----------|---------|
| MONGO_ROOT_USER | MongoDB admin username |
| MONGO_ROOT_PASSWORD | MongoDB admin password |
| MONGO_APP_USER | Application database user |
| MONGO_APP_PASSWORD | Application database password |
| SEED_ADMIN_EMAIL | (Legacy) Initial admin email |
| SEED_ADMIN_PASSWORD | (Legacy) Initial admin password |
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| REACT_APP_BACKEND_URL | Public URL of the application |

### Known Dependency Constraints

**Node.js:**
- Must use Node 18 (Node 20+ has breaking changes with current dependencies)
- Alpine images cause native module compilation issues; Debian-slim required
- Memory limit needed for build (`NODE_OPTIONS=--max-old-space-size=4096`)

**Python:**
- Python 3.11 required (3.12+ has compatibility issues with some packages)
- Native dependencies require `gcc` in Docker image

**MongoDB:**
- Authentication must specify `authSource=admin` in connection string
- Application user must be created in `admin` database with grants on `arkiflo` database

---

## 10. Design Decisions & Constraints

### Why Certain Mechanisms Exist

**Single-file backend (`server.py`):**
The entire backend is in one 25,000+ line file. This was an iterative development pattern where features were added incrementally. While not ideal for maintainability, it works and changing it risks introducing bugs.

**Permission arrays instead of role-based access:**
Roles alone were insufficient because interior design businesses have varied team structures. The permission system allows fine-grained customization per user while roles provide sensible defaults.

**Self-healing permissions:**
Added after repeated incidents of "logged in but empty dashboard." Rather than requiring manual database fixes, the system auto-repairs on login.

**Disabled auto-seeding:**
The original seed mechanism caused more problems than it solved, particularly in scenarios involving database cleanup and server restarts.

**Session cookies vs JWT:**
Cookies with server-side sessions were chosen for simplicity. JWTs would require token refresh logic and offer no practical benefit for this single-deployment scenario.

### Why Some Features Are Disabled

**Admin auto-seeding:** Caused duplicate users and race conditions with OAuth. First-user-becomes-admin provides the same bootstrapping without the problems.

**Legacy Emergent OAuth:** The application previously used a third-party OAuth proxy. This was replaced with direct Google OAuth for full control and to eliminate external dependencies.

### What Should NOT Be Casually Changed

| Component | Risk of Change |
|-----------|----------------|
| Password hashing (salt value) | Changing breaks all existing passwords |
| Session cookie configuration | Changing may break authentication on all clients |
| Permission string format | Changing may hide/break UI features |
| First-user-admin logic | Changing may create security holes or lock out deployments |
| MongoDB connection string format | Changing may break database connectivity |
| Docker port bindings | Changing may break Nginx proxy configuration |

---

## 11. Known Failure Modes & Lessons Learned

### Common Break Scenarios

**Empty Dashboard After Login**

*Symptom:* User logs in successfully but sees minimal or no UI elements.

*Cause:* User's `permissions` array is empty or missing.

*Resolution:* The self-healing logic should fix this automatically on next login. If not, manually run the permission repair script or have admin reset user permissions.

**Google Login Works But Password Login Fails**

*Symptom:* User can authenticate via Google but password login returns "Invalid credentials."

*Cause:* User was created via Google OAuth and never had a password set. The `local_password` field doesn't exist.

*Resolution:* Admin must set a password for the user, or user must continue using Google.

**Multiple Admins Created**

*Symptom:* Database shows multiple user records with Admin role, some unexpected.

*Cause:* (Historical) Auto-seed logic ran after database cleanups. No longer occurs with current code.

*Resolution:* Delete unwanted admin accounts; ensure only one Admin exists.

**Frontend Build Fails with AJV/Schema Errors**

*Symptom:* Docker build fails during `yarn install` or `yarn build` with cryptic module errors.

*Cause:* Node Alpine image has musl libc incompatibility with some native modules.

*Resolution:* Use `node:18-bullseye-slim` instead of `node:18-alpine`.

**MongoDB Authentication Failed**

*Symptom:* Backend cannot connect to database; logs show authentication errors.

*Cause:* `authSource` mismatch — user created in one database but connection string doesn't specify correct auth database.

*Resolution:* Ensure connection string includes `?authSource=admin` and user was created in admin database.

### Dependency Issues

| Dependency | Issue | Solution |
|------------|-------|----------|
| React 19 | Breaking changes with some UI libraries | Pin specific versions in package.json |
| Node 20 | OpenSSL changes break builds | Use Node 18 |
| CRACO | Compatibility with newer CRA versions | Pin CRACO 7.1.0 |

### Permission-Related UI Failures

*Pattern:* A feature appears to exist (menu item visible) but clicking shows empty or error page.

*Cause:* Menu visibility is role-based but page content is permission-based. User has role but not specific permissions.

*Resolution:* Admin should verify user's permission list includes required permissions for the feature.

---

## 12. Future Scope

### Planned or Implied Modules

Based on existing code structure and data models:

**Execution Ledger:**
A detailed tracking system for project materials and vendor payments at the line-item level. Basic implementation exists but is not fully integrated.

**Quotation Builder:**
System for creating client proposals with itemized pricing. Referenced in requirements but not yet implemented.

**Cutlist Generator:**
Tool for generating production cutting lists from design specifications. Referenced in requirements but not yet implemented.

**Email Notifications:**
Infrastructure exists (`email_templates` collection, notification system) but email sending is mocked. Integration with email service provider pending.

### Scalability Considerations

**Current Limitations:**

- Single backend instance (no horizontal scaling)
- Single MongoDB instance (no replication)
- File uploads stored on local volume (not cloud storage)
- Scheduled jobs run in-process (no job queue)

**If Scaling Required:**

- Backend: Add load balancer, multiple Uvicorn workers or container replicas
- Database: MongoDB replica set or managed service (Atlas)
- Files: Migrate to S3 or equivalent object storage
- Jobs: Extract to Celery or similar distributed task queue
- Sessions: Move to Redis for shared session store

**Recommended Order of Scaling Investment:**

1. Database (most critical for data safety)
2. File storage (for reliability)
3. Backend instances (for performance)
4. Job processing (for reliability)

---

## Appendix A: MongoDB Collections Reference

| Collection | Purpose |
|------------|---------|
| users | User accounts and authentication data |
| user_sessions | Active login sessions |
| presales | Pre-qualification inquiries |
| leads | Qualified potential clients |
| projects | Active client engagements |
| tasks | Project task tracking |
| validations | Design validation records |
| accounting_transactions | Cash book entries |
| accounting_accounts | Chart of accounts |
| accounting_categories | Transaction categories |
| finance_receipts | Client payment records |
| finance_invoices | Invoice records |
| finance_budgets | Budget allocations |
| finance_expense_requests | Staff expense claims |
| finance_salary_master | Employee salary records |
| finance_vendors | Vendor master data |
| warranties | Post-handover warranty records |
| service_requests | Service/repair requests |
| academy_categories | Training categories |
| academy_lessons | Training content |
| notifications | User notifications |
| settings | System configuration |

---

## Appendix B: API Route Summary

The backend exposes approximately 370 API endpoints grouped by domain:

| Prefix | Domain | Example Endpoints |
|--------|--------|-------------------|
| /api/auth | Authentication | login, logout, me, google/login, google/callback |
| /api/users | User Management | list, create, update, permissions |
| /api/presales | Pre-Sales | CRUD, convert |
| /api/leads | Leads | CRUD, stages, convert, collaborators |
| /api/projects | Projects | CRUD, stages, milestones, files, notes |
| /api/finance | Finance | cashbook, receipts, invoices, budgets |
| /api/settings | Configuration | company, branding, stages, milestones |
| /api/notifications | Notifications | list, read, clear |
| /api/reports | Reporting | various analytical endpoints |

---

## Appendix C: Role-Permission Matrix Summary

| Role | Permissions Count | Primary Access |
|------|-------------------|----------------|
| Admin | ~100 | Everything |
| FinanceManager | ~70 | Full finance, no CRM management |
| SeniorAccountant | ~50 | Finance operations, no approvals |
| JuniorAccountant | ~30 | Finance view and basic entry |
| ProductionOpsManager | ~25 | Projects, service, limited finance |
| SalesManager | ~20 | Leads, projects (view), reports |
| DesignManager | ~15 | Projects, leads (view), reports |
| Designer | ~10 | Assigned leads/projects only |
| PreSales | ~8 | Pre-sales and lead creation |
| Technician | ~5 | Service requests only |
| CharteredAccountant | ~20 | Finance read-only |

---

*End of Document*
