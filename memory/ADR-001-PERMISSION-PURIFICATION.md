# ADR-001: Permission System Purification

**Status:** IN PROGRESS  
**Date:** February 3, 2026  
**Decision:** Eliminate role-name-based logic; make permissions the single source of truth

---

## Progress Tracker

### Completed ✅
| Component | Role Checks Removed | Status |
|-----------|---------------------|--------|
| Backend: User CRUD | 11 | ✅ Done |
| Backend: Permission Management | 4 | ✅ Done |
| Backend: User Listing (GET /api/users) | 1 | ✅ Done |
| Frontend: AuthContext.js | 1 (role shortcut) | ✅ Done |
| Frontend: Users.jsx | 7 | ✅ Done |
| Frontend: Sidebar.jsx | Permission-based additions | ✅ Done |

### Validation Results ✅ (Feb 3, 2026)

**Test Users Created:**
- `test.intern@arkiflo.com` (Designer role, no admin perms)
- `test.finance@arkiflo.com` (Accountant role, no admin perms)
- `test.customops@arkiflo.com` (OperationLead role, WITH `admin.manage_users`)

**Backend API Test Results:**
| Action | Admin | Intern | Finance | CustomOps | Result |
|--------|-------|--------|---------|-----------|--------|
| Create User | ✅ | ❌ | ❌ | ✅ | PASS |
| View Permissions | ✅ | ❌ | ❌ | ❌ | PASS |
| Update Permissions | ✅ | ❌ | ❌ | ❌ | PASS |
| Reset Password | ✅ | ❌ | ❌ | ✅ | PASS |
| Toggle Status | ✅ | ❌ | ❌ | ✅ | PASS |

**Key Validation:** CustomOps user (role: OperationLead) with `admin.manage_users` permission can successfully create users, reset passwords, and toggle status - proving permissions work independently of role names.

### Known Limitation (Frontend)
The sidebar navigation (`Sidebar.jsx`) still uses role-based logic to show/hide menu items. Users with custom permissions may have API access but no sidebar link. This is a P1 item for Phase 3 completion.

### Remaining (By Priority)
| Component | Role Checks | Priority |
|-----------|-------------|----------|
| Backend: Other endpoints | ~165 | P0 |
| Frontend: ProjectDetails.jsx | 23 | P0 |
| Frontend: Dashboard.jsx | 12 | P0 |
| Frontend: PreSales.jsx | 9 | P1 |
| Frontend: Leads.jsx | 9 | P1 |
| Frontend: Projects.jsx | 8 | P1 |
| Frontend: Other files | ~57 | P2 |

---

## Context

The system currently has **two sources of truth** for access control:
1. **Role names** - hardcoded checks like `if user.role == "Admin"`
2. **Permissions** - granular checks like `has_permission(user, "leads.update")`

This causes recurring issues when new roles are introduced:
- User has correct permissions but UI doesn't show features
- Backend allows action but frontend hides buttons
- Every new role requires code changes

**Current State:**
- 181 role-name checks in backend (`server.py`)
- 134 role-name checks in frontend (across 15+ files)
- 315 total checks to migrate

---

## Decision

**Permissions become the single source of truth.**

- Role = a label + default permission template
- Role name is NEVER checked for access control
- All `user.role === 'X'` checks replaced with `hasPermission('x.y')`

---

## Migration Plan

### Phase 1: Audit & Document ✅ (This Document)

### Phase 2: Backend Purification

**Priority Order:**
1. Admin-only endpoints (32 occurrences)
2. User management endpoints
3. Project/Lead CRUD operations
4. Finance operations

**New Permissions Required:**

| Current Check | New Permission | Description |
|---------------|----------------|-------------|
| `role == "Admin"` | `admin.full_access` | System administration |
| `role in MANAGER_ROLES` | `team.manage` | Team oversight |
| `role == "Designer" and not collaborator` | Keep as-is | This is ownership, not role |

### Phase 3: Frontend Purification

**Files by Priority (most role checks):**

| File | Role Checks | Priority |
|------|-------------|----------|
| ProjectDetails.jsx | 23 | P0 |
| Dashboard.jsx | 12 | P0 |
| PreSales.jsx | 9 | P1 |
| Leads.jsx | 9 | P1 |
| Projects.jsx | 8 | P1 |
| Users.jsx | 7 | P1 |
| LeadDetails.jsx | 5 | P2 |
| Calendar.jsx | 5 | P2 |
| Others | 57 | P2 |

---

## Backend Role Check Inventory

### Category 1: Admin-Only Operations (32 checks)
```
user.role != "Admin" → has_permission(user, "admin.*")
```

**Endpoints:**
- POST /users/invite
- POST /users/create-local
- PUT /users/{id}/permissions
- DELETE /users/{id}
- POST /auth/reset-password
- GET /permissions/available

**Migration:** Add `admin.users.create`, `admin.users.edit`, `admin.users.delete` permissions

### Category 2: Manager Operations (17+ checks)
```
user.role not in ["Admin", "Manager"] → has_permission(user, "team.manage")
```

**Endpoints:**
- Project collaborator management
- Lead reassignment
- Task assignment

**Migration:** Add `projects.manage_team`, `leads.reassign` permissions

### Category 3: Sales Operations (9 checks)
```
user.role not in ["Admin", "SalesManager"] → has_permission(user, "sales.*")
```

**Endpoints:**
- Lead conversion
- Pipeline management
- Sales reports

**Migration:** Already have `leads.convert`, add `sales.pipeline.view`

### Category 4: Designer Restrictions (29 checks)
```
user.role == "PreSales" → has_permission(user, "presales.*")
user.role == "Designer" → check project collaboration OR has_permission
```

**Note:** Designer checks often include `and user.user_id not in collaborators` - this is ownership logic, NOT role logic. Keep as-is.

### Category 5: Finance Operations
```
user.role in FINANCE_ROLES → has_permission(user, "finance.*")
```

**Status:** Already mostly permission-based ✅

### Category 6: Technician Operations (4 checks)
```
user.role == "Technician" → has_permission(user, "service.technician")
```

---

## Frontend Role Check Inventory

### Pattern 1: Conditional Rendering
```jsx
// BEFORE
{user?.role === 'Admin' && <Button>Delete</Button>}

// AFTER
{hasPermission('admin.users.delete') && <Button>Delete</Button>}
```

### Pattern 2: Navigation Guards
```jsx
// BEFORE
if (!['Admin', 'SalesManager'].includes(user?.role)) return;

// AFTER
if (!hasPermission('leads.view_all')) return;
```

### Pattern 3: Feature Flags
```jsx
// BEFORE
const canEdit = user?.role === 'Admin' || user?.role === 'Manager';

// AFTER
const canEdit = hasPermission('projects.edit');
```

---

## New Permissions to Add

| Permission ID | Description | Replaces Role Check |
|---------------|-------------|---------------------|
| `admin.users.create` | Create new users | `role == "Admin"` |
| `admin.users.edit` | Edit user details | `role == "Admin"` |
| `admin.users.delete` | Delete users | `role == "Admin"` |
| `admin.permissions.manage` | Manage user permissions | `role == "Admin"` |
| `team.manage` | Manage team members | `role in MANAGER_ROLES` |
| `projects.manage_team` | Add/remove collaborators | `role in ["Admin", "Manager"]` |
| `leads.reassign` | Reassign leads to others | `role in SALES_MANAGER_ROLES` |
| `sales.pipeline.view` | View sales pipeline | `role == "SalesManager"` |
| `service.technician` | Technician-specific actions | `role == "Technician"` |
| `reports.view_all` | View all reports | `role in MANAGER_ROLES` |

---

## Implementation Order

### Batch 1: User Management (Backend)
- [ ] Add new admin permissions to AVAILABLE_PERMISSIONS
- [ ] Update DEFAULT_ROLE_PERMISSIONS for Admin role
- [ ] Replace role checks in user CRUD endpoints
- [ ] Test: Create user with custom admin permissions

### Batch 2: User Management (Frontend)
- [ ] Update Users.jsx to use hasPermission
- [ ] Update UserEdit.jsx
- [ ] Test: Non-Admin with admin.users.create can create users

### Batch 3: Project Operations (Backend)
- [ ] Replace role checks in project endpoints
- [ ] Keep ownership checks (collaborator-based)
- [ ] Test: Custom role can manage projects with correct permissions

### Batch 4: Project Operations (Frontend)
- [ ] Update ProjectDetails.jsx (23 checks - highest priority)
- [ ] Update Projects.jsx
- [ ] Test: UI reflects permissions, not role names

### Batch 5: Lead/PreSales Operations
- [ ] Backend: leads.py role checks
- [ ] Frontend: Leads.jsx, PreSales.jsx, LeadDetails.jsx

### Batch 6: Remaining Files
- [ ] Dashboard.jsx
- [ ] Calendar.jsx
- [ ] ServiceRequestDetails.jsx
- [ ] MeetingModal.jsx

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing users | Add permissions to existing users during migration |
| Missing edge cases | Comprehensive testing with test users |
| Frontend/Backend mismatch | Migrate in pairs (backend + frontend together) |

---

## Success Criteria

1. Zero `user.role ==` checks in codebase (except for display purposes)
2. New role "Intern" works correctly with assigned permissions
3. Admin can create any role combination via permission editor
4. No code changes required for new roles

---

## Files to Modify

### Backend
- `/app/backend/server.py` - Main file with 181 role checks

### Frontend (by priority)
- `/app/frontend/src/pages/ProjectDetails.jsx` (23)
- `/app/frontend/src/pages/Dashboard.jsx` (12)
- `/app/frontend/src/pages/PreSales.jsx` (9)
- `/app/frontend/src/pages/Leads.jsx` (9)
- `/app/frontend/src/pages/Projects.jsx` (8)
- `/app/frontend/src/pages/Users.jsx` (7)
- `/app/frontend/src/pages/LeadDetails.jsx` (5)
- `/app/frontend/src/pages/Calendar.jsx` (5)
- `/app/frontend/src/components/MeetingModal.jsx` (4)
- `/app/frontend/src/pages/UserEdit.jsx` (3)
- `/app/frontend/src/pages/ServiceRequestDetails.jsx` (3)
- `/app/frontend/src/pages/Reports.jsx` (3)
- `/app/frontend/src/pages/PreSalesDetail.jsx` (3)
- `/app/frontend/src/components/layout/Header.jsx` (3)
