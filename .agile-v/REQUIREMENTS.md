# Hub Frontend Requirements — Cycle C1

> Revision: C1 | Date: 2026-07-13 | Status: APPROVED
> Extracted by: Requirement Architect | Validated by: Logic Gatekeeper
> Human Gate 1: Approved

## 1. Purpose

These requirements define the expected behavior of the Aisphere Hub Frontend (SkillHub Console). Each requirement includes the frontend-backend API contract (HTTP method, path, request/response shape), UI behavior, constraints, and verification criteria.

## 2. Backend Targets

| Target | Env Var | Default | Function |
|--------|---------|---------|----------|
| **Hub API** | `NEXT_PUBLIC_HUB_URL` | `http://127.0.0.1:18001` | `request()` |
| **IAM API** | `NEXT_PUBLIC_IAM_URL` | `http://127.0.0.1:18080` | `iamRequest()` |

## 3. Requirement Status Legend

| Status | Meaning |
|--------|---------|
| `OBSERVED_IMPLEMENTED` | UI component and API integration exist |
| `PARTIAL_IMPLEMENTATION` | UI exists but some features missing |
| `CONTRACT_ONLY` | API defined but no UI |
| `ARCHITECTURE_REQUIRED` | Required by architecture but not implemented |
| `OBSOLETE` | Merged into another REQ |

## 4. Requirement Summary

| Domain | REQs | Priority | Status |
|--------|:----:|:--------:|--------|
| Authentication | 4 | P0 | ✅ |
| IAM Management | 15 | P0 | ✅ |
| Access Control | 6 | P0 | ⚠️ 2 merged |
| IAM Group Admin | 5 | P0 | ❌ API done, UI pending |
| IAM Authz Admin | 9 | P0 | ❌ API done, UI pending |
| IAM User Admin | 4 | P0 | ⚠️ Migration needed |
| Project Capabilities | 4 | P0 | ⚠️ API done, UI pending |
| Skills | 10 | P0 | ✅ |
| SkillSets | 6 | P0 | ✅ |
| Agents | 6 | P1 | ✅ |
| Tools | 6 | P1 | ✅ |
| Sandboxes | 6 | P1 | ✅ |
| Namespaces | 4 | P1 | ✅ |
| Governance | 6 | P1 | ✅ |
| Layout & Navigation | 15 | P0 | ✅ |
| Model Profiles | 3 | P1 | ✅ |
| Sandbox Profiles | 3 | P1 | ✅ |
| Operations | 5 | P1 | ✅ |
| Documentation | 1 | P2 | ✅ |
| Engineering | 5 | P2 | ✅ |

---

# 5. Authentication (P0)

## REQ-FE-AUTH-001 — OIDC Login via Gateway
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Frontend shall support OIDC login through Envoy Gateway. Gateway handles Casdoor OIDC session; frontend reads user info from Gateway-injected headers.
- **API:** No direct API call. Auth mode is configured via `NEXT_PUBLIC_AUTH_MODE=gateway_oidc`. The `request()` function sends `X-Requested-With: XMLHttpRequest` instead of `Authorization: Bearer`.
- **UI:** Login page redirects to Gateway login URL. No token management in frontend.
- **Constraint:** Gateway must inject `X-Aisphere-*` trusted headers after OIDC verification.
- **Verification:** 1. Login redirects to Gateway. 2. After Gateway callback, user info is available via `authApi.me()`.
- **Done criteria:** E2E test verifies OIDC login flow.

## REQ-FE-AUTH-002 — Browser Token Login
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Frontend shall support Bearer token login for local development. Token is stored in `localStorage` key `aihub_console_token` and sent as `Authorization: Bearer <token>`.
- **API:** No direct login API. Token is obtained via `iamAuthApi.exchangeCode()` or manually set.
- **UI:** Login page with token input field. Token persistence across page reloads.
- **Constraint:** Token mode is activated by `NEXT_PUBLIC_AUTH_MODE=token`.
- **Verification:** 1) Token input stores to localStorage. 2) Subsequent API calls include `Authorization: Bearer` header. 3) Page reload preserves session.
- **Done criteria:** Component test verifies token storage and header injection.

## REQ-FE-AUTH-003 — OAuth Callback Handler
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Frontend shall handle OAuth callback at `/auth/callback` to exchange authorization code for tokens.
- **API:** `POST /v1/iam/auth/exchange` → `{ code, redirect_uri }` → `{ accessToken, refreshToken, idToken, tokenType, expiresIn }`
- **UI:** Callback page reads `code` and `state` from URL query params, calls exchange API, stores token, redirects to home.
- **Verification:** 1) Callback page extracts code from URL. 2) Exchange API is called with correct params. 3) Token is stored. 4) Redirect to home.
- **Done criteria:** E2E test verifies callback flow.

## REQ-FE-AUTH-004 — Current User Display
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Top bar shall display current user's avatar, display name, and organization.
- **API:** `GET /v1/authn/me` → `Record<string, unknown>` (principal object with subjectId, subjectType, orgId, displayName, avatarUrl)
- **UI:** User avatar (fallback to initials), display name, org badge. Click opens UserPanelSheet.
- **Verification:** 1) User info renders correctly. 2) Unauthenticated state shows login button. 3) Loading state shows skeleton.
- **Done criteria:** Component test verifies render, loading, and unauthenticated states.

---

# 6. IAM Management (P0)

## REQ-FE-IAM-001 — Local User List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** IAM page "Local Users" tab shall display a table of all local users.
- **API:** `GET /v3/admin/iam/local-users/list` → `LocalUser[]` (legacy, to be migrated)
  - **Response:** `LocalUser = { username, subjectId, subjectType, roles, permissions, namespaces, status }`
- **UI:** Table with columns: username, subject ID, type (human/agent/service), roles, permissions, namespaces, status. Search input filtering by username. Loading skeleton. Empty state "No users found".
- **Constraint:** 需迁移到 `GET /v1/iam/orgs/{org_id}/users`（见 REQ-FE-USERADMIN-001）
- **Verification:** 1) Table renders all columns. 2) Search filters in real-time. 3) Loading shows skeleton. 4) Empty shows message.
- **Done criteria:** Component test verifies render, loading, empty, search.

## REQ-FE-IAM-002 — Local User CRUD
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** IAM page shall support creating, editing, and deleting local users via dialog forms.
- **API:**
  - Create/Update: `POST /v3/iam/local-users` → `{ username, password?, subjectType, roles, permissions, namespaces }` → `LocalUser`
  - Delete: `DELETE /v3/iam/local-users/{username}` → `{}`
- **UI:** "Add User" button opens create dialog. Edit button per row opens pre-filled dialog. Delete button with confirmation dialog. All with loading states and toast notifications.
- **Verification:** 1) Create form validates required fields. 2) Submit calls correct API. 3) Success refreshes list. 4) Delete shows confirmation.
- **Done criteria:** Component test verifies CRUD flow.

## REQ-FE-IAM-003 — Organization List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** IAM page "Organizations" tab shall list organizations.
- **API:** `GET /v1/iam/control-plane/orgs` → `{ organizations: IamCpOrganization[] }`
  - **Response:** `IamCpOrganization = { id, slug, displayName, status, casdoorOrg, plan, createdAt }`
- **UI:** Table with columns: slug, displayName, status, casdoorOrg, plan, createdAt. Search input. Loading skeleton.
- **Verification:** 1) Table renders. 2) Loading shows skeleton. 3) Empty shows message.
- **Done criteria:** Component test.

## REQ-FE-IAM-004 — Organization Create
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Support creating organizations via dialog.
- **API:** `POST /v1/iam/control-plane/orgs` → `{ slug, displayName?, casdoorOrg? }` → `IamCpOrganization`
- **UI:** Dialog with slug (required, lowercase+hyphens), displayName, casdoorOrg fields. Submit with loading. Success toast.
- **Verification:** 1) Form validates slug format. 2) Submit calls correct API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-IAM-005 — Project List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** IAM page "Projects" tab shall list projects.
- **API:** `GET /v1/iam/control-plane/projects` → `{ projects: IamProject[] }`
  - **Response:** `IamProject = { id, slug, displayName, orgId, status, visibility, stats: { resourceCount }, createdAt }`
- **UI:** Table with columns: slug, displayName, org, status, visibility, resourceCount, createdAt. Search. Loading skeleton.
- **Verification:** 1) Table renders. 2) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-IAM-006 — Project Create
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Support creating projects with org selector.
- **API:** `POST /v1/iam/control-plane/orgs/{orgId}/projects` → `{ slug, displayName?, description? }` → `IamProject`
- **UI:** Dialog with org dropdown, slug, displayName, description fields. Validation. Loading.
- **Verification:** 1) Form renders. 2) Submit calls correct API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-IAM-007 — Role Template List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** IAM page "Grants & Roles" tab shall list role templates.
- **API:** `GET /v1/iam/control-plane/role-templates` → `{ roleTemplates: IamRoleTemplate[] }`
  - **Response:** `IamRoleTemplate = { roleKey, displayName, resourceType, relation, builtIn }`
- **UI:** Table with columns: roleKey, displayName, resourceType, relation, builtIn badge. Loading skeleton.
- **Verification:** 1) Table renders. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-IAM-008 — Grant List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** List active grants with resource, subject, role, createdBy, createdAt.
- **API:** `GET /v1/iam/control-plane/grants?resourceType=...&resourceId=...` → `{ grants: IamGrant[] }`
  - **Response:** `IamGrant = { id, resource: { type, id }, roleKey, subject: { type, id }, createdBy, createdAt, expiresAt? }`
- **UI:** Table with columns: resource, subject, role, createdBy, createdAt, actions (revoke). Loading skeleton.
- **Verification:** 1) Table renders. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-IAM-009 — Grant Access
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Form to grant access to a resource.
- **API:** `POST /v1/iam/control-plane/grants` → `{ resource: { type, id }, roleKey, subject: { type, id }, reason? }` → `IamGrant`
- **UI:** Dialog with: resourceType dropdown, resourceId text, subjectType dropdown (user/group/org/agent/service), subjectId text, role dropdown (viewer/consumer/editor/admin/owner), reason textarea. Validation. Loading. Success/error toast.
- **Constraint:** roleKey must match a registered RoleTemplate for the resource type.
- **Verification:** 1) Form renders all fields. 2) Submit calls correct API. 3) Success refreshes grant list. 4) Error shows toast.
- **Done criteria:** Component test.

## REQ-FE-IAM-010 — Revoke Access
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Revoke an active grant with confirmation.
- **API:** `POST /v1/iam/control-plane/grants/{grantId}/revoke` → `{}`
- **UI:** Revoke button per row. Confirmation dialog. Loading state. Success/error toast.
- **Verification:** 1) Revoke shows confirmation. 2) Confirm calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-IAM-011 — Resource Type List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** IAM page "Resources" tab shall list resource types.
- **API:** `GET /v1/iam/control-plane/resource-types` → `{ resourceTypes: IamResourceType[] }`
  - **Response:** `IamResourceType = { type, displayName, spicedbType, grantable, relations, permissions }`
- **UI:** Table with columns: type, displayName, spicedbType, grantable badge, relations count, permissions count. Loading skeleton.
- **Verification:** 1) Table renders. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-IAM-012 — Resource List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** IAM page "Resources" tab shall list resources filterable by type.
- **API:** `GET /v1/iam/control-plane/resources?resourceType=...&projectId=...` → `{ resources: IamResource[] }`
  - **Response:** `IamResource = { type, id, displayName, status, projectId, createdAt }`
- **UI:** Table with columns: type, id, displayName, status, project, createdAt. Resource type filter dropdown. Loading skeleton.
- **Verification:** 1) Table renders. 2) Filter works. 3) Loading state.
- **Done criteria:** Component test.

## REQ-FE-IAM-013 — Directory Users by Org
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Hook to list Casdoor directory users by organization.
- **API:** `GET /v1/iam/orgs/{orgId}/users` → `{ users: IamUser[] }`
  - **Response:** `IamUser = { id, username, displayName, email, phone, enabled }`
- **Hook:** `useIamDirectoryUsers(orgId)` — React Query, staleTime 30s, enabled when orgId is truthy.
- **Verification:** Hook returns users array. Loading/error states handled.
- **Done criteria:** Hook test.

## REQ-FE-IAM-014 — Directory Groups by Org
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Hook to list Casdoor directory groups by organization.
- **API:** `GET /v1/iam/orgs/{orgId}/groups` → `{ groups: IamGroup[] }`
  - **Response:** `IamGroup = { id, name, displayName, type, parentId, path, users }`
- **Hook:** `useIamDirectoryGroups(orgId)` — React Query, staleTime 30s.
- **Verification:** Hook returns groups.
- **Done criteria:** Hook test.

## REQ-FE-IAM-015 — Directory Organization Metadata
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Hook to read Casdoor organization metadata.
- **API:** `GET /v1/iam/orgs/{orgId}` → `IamOrganization = { id, name, displayName, createdTime }`
- **Hook:** `useIamDirectoryOrganization(orgId)` — React Query, staleTime 60s.
- **Verification:** Hook returns org metadata.
- **Done criteria:** Hook test.

---

# 7. Access Control (P0)

## REQ-FE-ACCESS-001 — Authorization Overview
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Access page shall display authorization provider overview.
- **API:** `GET /v1/authz/overview` → `AccessOverview = { provider, endpoint, permissionId, resolvedSubject, resources?, quickLinks? }`
- **UI:** 4 info cards: Authz Provider, Casdoor Endpoint, Permission ID, Resolved Subject. Loading skeleton.
- **Verification:** 1) Cards render with data. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-ACCESS-002 — Resource Action Catalog
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Display table of all known resource types and their actions.
- **API:** `GET /v1/authz/resources` → `Page<AccessResourceTemplate>`
  - **Response:** `AccessResourceTemplate = { area, object, action, description }`
- **UI:** Table with columns: area, object, action, description. Loading skeleton.
- **Verification:** Table renders.
- **Done criteria:** Component test.

## REQ-FE-ACCESS-003 — Casdoor Admin Links
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Quick links to external Casdoor admin console.
- **API:** `GET /v1/authz/links` → `Page<AccessQuickLink>`
  - **Response:** `AccessQuickLink = { title, url, description? }`
- **UI:** List of external link buttons. Each opens in new tab.
- **Verification:** Links render and are clickable.
- **Done criteria:** Component test.

## REQ-FE-ACCESS-004 — Permission Evaluation
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Form to evaluate a subject/object/action triple and show ALLOW/DENY.
- **API:** `POST /v1/authz/evaluate` → `{ subject, object, action }` → `AccessEvaluateResult = { allowed, effect, reason? }`
- **UI:** Form with subject, object, action text inputs. Evaluate button. Result display with ALLOW (green) / DENY (red) badge. Clickable example badges for common actions and objects.
- **Verification:** 1) Form submits. 2) Result displays correctly. 3) Example badges fill form.
- **Done criteria:** Component test.

## REQ-FE-ACCESS-005 — Permission Test Examples
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Clickable example badges for common actions and objects.
- **UI:** Badge list: `skill:admin:read`, `skill:admin:write`, `skill:publish`, `skill:read`, `access:admin:read`, `notification:read`, `system:admin`. Object examples: `skill:*`, `group:*`, `proposal:*`, `access:*`, `notification:*`, `system:*`.
- **Verification:** Clicking a badge fills the corresponding form field.
- **Done criteria:** Component test.

## REQ-FE-ACCESS-006 — SpiceDB Relationship Management (merged)
- **Priority:** P0 | **Status:** `OBSOLETE`
- **Note:** Merged into REQ-FE-AUTHZADMIN-004~006. Use `iamAuthzAdminApi` instead of `authzApi`.

---

# 8. IAM Group Admin (P0) — ❌ UI Pending

## REQ-FE-GROUP-001 — Group List
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** IAM page shall display a list of Casdoor groups.
- **API:** `GET /v1/iam/orgs/{org_id}/groups` → `{ groups: Group[] }`
  - **Response:** `Group = { id, name, displayName, type, parentId, path, users: string[] }`
- **UI:** Table with columns: name, displayName, type (folder/group), parentGroup, memberCount, status. Search by name. Loading skeleton. Empty state.
- **Constraint:** org_id from current user's principal.
- **Verification:** 1) Table renders. 2) Search filters. 3) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-GROUP-002 — Group Create
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Dialog form to create a new group.
- **API:** `POST /v1/iam/groups` → `{ org_id, group: { name, displayName, type?, parentId? } }` → `Group`
- **UI:** Dialog with: name (required, `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`), displayName (required), type dropdown (folder/group), parentGroup tree selector (optional). Validation. Submit loading. Success/error toast.
- **Verification:** 1) Form validates name format. 2) Submit calls correct API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-GROUP-003 — Group Update
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Edit group displayName, type, parent.
- **API:** `PATCH /v1/iam/groups/{group_id}` → `{ org_id, group_id, group: { displayName?, type?, parentId? } }` → `Group`
- **UI:** Edit button per row opens pre-filled dialog. Save with loading. Success toast.
- **Verification:** 1) Edit dialog pre-fills. 2) Submit calls correct API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-GROUP-004 — Group Delete
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Delete group with confirmation. Option to recursively delete children.
- **API:** `DELETE /v1/iam/groups/{group_id}` → `{ org_id, recursive }` → `{}`
- **UI:** Delete button per row. Confirmation dialog with "Also delete child groups" checkbox. Loading. Success toast.
- **Constraint:** Recursive delete is irreversible.
- **Verification:** 1) Confirmation shows. 2) Submit calls correct API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-GROUP-005 — Group Membership Management
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Assign/remove users to/from a group.
- **API:**
  - Assign: `POST /v1/iam/groups/{group_id}/users/{user_id}` → `{ org_id }` → `{}`
  - Remove: `DELETE /v1/iam/groups/{group_id}/users/{user_id}` → `{ org_id }` → `{}`
- **UI:** Member list with user badges. "Add User" button opens user selector. "Remove" button per member with confirmation.
- **Constraint:** User must exist in same organization.
- **Verification:** 1) Member list renders. 2) Add calls assign API. 3) Remove shows confirmation then calls remove API. 4) Operations refresh list.
- **Done criteria:** Component test.

---

# 8. IAM Authz Admin (P0) — ❌ UI Pending

## REQ-FE-AUTHZADMIN-001 — Authorization Schema Viewer
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Display the active SpiceDB authorization schema.
- **API:** `GET /v1/iam/authz/schema` → `{ text: string, version: string }`
- **UI:** Code block with syntax highlighting showing schema text. Version badge. Copy button. Loading skeleton.
- **Permission:** `view_schema` on `iam_authz:global`
- **Verification:** 1) Schema renders. 2) Version displays. 3) Loading state.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-002 — Authorization Schema Validate
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Validate a proposed schema change before publishing.
- **API:** `POST /v1/iam/authz/schema:validate` → `{ text }` → `{ valid: boolean, error?: string }`
- **UI:** Textarea for schema text. "Validate" button. Result: green "Valid" or red error message. Loading state.
- **Permission:** `publish_schema` on `iam_authz:global`
- **Verification:** 1) Textarea accepts input. 2) Validate calls API. 3) Valid/invalid result displays.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-003 — Authorization Schema Publish
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Publish a new authorization schema version.
- **API:** `POST /v1/iam/authz/schema:publish` → `{ text }` → `{ published: boolean }`
- **UI:** "Publish" button (disabled until validated). Confirmation dialog. Loading state. Success/error toast.
- **Permission:** `publish_schema` on `iam_authz:global`
- **Constraint:** Schema must be validated before publishing.
- **Verification:** 1) Publish button disabled before validation. 2) Confirmation shows. 3) Submit calls API. 4) Success refreshes schema.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-004 — Relationship List
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** List SpiceDB relationships with filter support.
- **API:** `GET /v1/iam/authz/relationships?resourceType=...&resourceId=...&relation=...&subjectType=...&subjectId=...` → `{ relationships: Relationship[] }`
  - **Response:** `Relationship = { resource: { type, id }, relation, subject: { type, id, relation? } }`
- **UI:** Table with columns: resourceType, resourceId, relation, subjectType, subjectId. Filter inputs for each column. Loading skeleton. Empty state.
- **Permission:** `view_relationships` on `iam_authz:global`
- **Verification:** 1) Table renders. 2) Filters work. 3) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-005 — Relationship Write
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Write new SpiceDB relationships.
- **API:** `POST /v1/iam/authz/relationships` → `{ relationships: [{ resource: { type, id }, relation, subject: { type, id, relation? } }] }` → `{ written: number, consistencyToken? }`
- **UI:** Form with: resourceType, resourceId, relation, subjectType, subjectId, subjectRelation (optional). "Add" button. Submit with loading. Success/error toast.
- **Permission:** `repair_relationships` on `iam_authz:global`
- **Verification:** 1) Form renders. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-006 — Relationship Delete
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Delete SpiceDB relationships by filter.
- **API:** `POST /v1/iam/authz/relationships:delete` → `{ filter: { resourceType?, resourceId?, relation?, subjectType?, subjectId? } }` → `{ deleted: number, consistencyToken? }`
- **UI:** Delete button per row. Confirmation dialog. Loading. Success/error toast.
- **Permission:** `repair_relationships` on `iam_authz:global`
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-007 — Permission Check Tool
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Check a subject/resource/permission triple against SpiceDB.
- **API:** `POST /v1/iam/authz/permissions:check` → `{ subject: { type, id }, resource: { type, id }, permission }` → `{ allowed: boolean, effect: string, reason?: string, consistencyToken?: string }`
- **UI:** Form with: subjectType, subjectId, resourceType, resourceId, permission. Submit button. Result: ALLOW (green) / DENY (red) with reason. Loading state.
- **Permission:** `view_relationships` on `iam_authz:global`
- **Verification:** 1) Form renders. 2) Submit calls API. 3) Result displays correctly.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-008 — Permission Explanation
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Explain why a permission was allowed or denied.
- **API:** `POST /v1/iam/authz/permissions:explain` → `{ subject: { type, id }, resource: { type, id }, permission }` → `{ allowed, effect, reason, steps?: string[] }`
- **UI:** Same form as Check. Additional "Explain" button. Result shows graph path steps.
- **Permission:** `view_relationships` on `iam_authz:global`
- **Verification:** 1) Explain button works. 2) Steps display. 3) Result shows.
- **Done criteria:** Component test.

## REQ-FE-AUTHZADMIN-009 — Effective Permissions Viewer
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Display effective permissions for a subject on a resource.
- **API:** `GET /v1/iam/authz/effective-permissions?subjectType=...&subjectId=...&resourceType=...&resourceId=...&permissions=...` → `Record<string, { allowed: boolean, effect: string }>`
- **UI:** Form with subjectType, subjectId, resourceType, resourceId, permissions (comma-separated). Submit. Result table: permission → allowed/denied. Loading skeleton.
- **Permission:** `view_relationships` on `iam_authz:global`
- **Verification:** 1) Form renders. 2) Submit calls API. 3) Result table renders.
- **Done criteria:** Component test.

---

# 9. IAM User Admin (P0) — ⚠️ Migration Needed

## REQ-FE-USERADMIN-001 — User List (via IAM API)
- **Priority:** P0 | **Status:** `ARCHITECTURE_REQUIRED`
- **Requirement:** Migrate user list from legacy `GET /v3/admin/iam/local-users/list` to `GET /v1/iam/orgs/{org_id}/users`.
- **API:** `GET /v1/iam/orgs/{org_id}/users` → `{ users: IamUser[] }`
- **Hook:** `useIamDirectoryUsers(orgId)` already exists.
- **Verification:** 1) New API returns users. 2) UI renders correctly with new data shape.
- **Done criteria:** Migration complete, legacy API removed.

## REQ-FE-USERADMIN-002 — User Create (via IAM API)
- **Priority:** P0 | **Status:** `ARCHITECTURE_REQUIRED`
- **Requirement:** Migrate user creation from `POST /v3/admin/iam/local-users` to `POST /v1/iam/orgs/{org_id}/users`.
- **API:** `POST /v1/iam/orgs/{org_id}/users` → `{ org_id, user: { username, displayName, email, phone, enabled } }` → `User`
- **Permission:** `manage_users` on `zone:{org_id}`
- **Impact:** New API requires org_id. UI needs org selector.
- **Done criteria:** Migration complete, legacy API removed.

## REQ-FE-USERADMIN-003 — User Update (via IAM API)
- **Priority:** P0 | **Status:** `ARCHITECTURE_REQUIRED`
- **Requirement:** Migrate user update to `PUT /v1/iam/orgs/{org_id}/users/{user_id}`.
- **API:** `PUT /v1/iam/orgs/{org_id}/users/{user_id}` → `{ org_id, user_id, user: { displayName?, email?, phone?, enabled? } }` → `User`
- **Permission:** `manage_users` on `zone:{org_id}`
- **Done criteria:** Migration complete.

## REQ-FE-USERADMIN-004 — User Disable
- **Priority:** P0 | **Status:** `CONTRACT_ONLY`
- **Requirement:** Support disabling/enabling users.
- **API:** `POST /v1/iam/orgs/{org_id}/users/{user_id}:disable` → `{ org_id, user_id }` → `{}`
- **UI:** Toggle switch or "Disable/Enable" button per user row. Confirmation dialog. Loading. Success toast.
- **Permission:** `manage_users` on `zone:{org_id}`
- **Verification:** 1) Toggle calls correct API. 2) Status updates in list.
- **Done criteria:** Component test.

---

# 10. Project Capabilities (P0) — ⚠️ UI Pending

## REQ-FE-PROJCAP-001 — Project Update
- **Priority:** P0 | **Status:** `PARTIAL_IMPLEMENTATION`
- **Requirement:** Support updating project displayName, description, visibility.
- **API:** `PATCH /v1/iam/control-plane/projects/{project_id}` → `{ displayName?, description?, visibility? }` → `IamProject`
- **UI:** Edit button per project row opens pre-filled dialog. Save with loading. Success toast.
- **Permission:** `manage` on `project:{project_id}`
- **Verification:** 1) Edit dialog pre-fills. 2) Submit calls correct API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-PROJCAP-002 — Project Archive
- **Priority:** P0 | **Status:** `PARTIAL_IMPLEMENTATION`
- **Requirement:** Archive a project with confirmation.
- **API:** `POST /v1/iam/control-plane/projects/{project_id}/archive` → `{ reason? }` → `IamProject`
- **UI:** Archive button per row. Confirmation dialog with reason textarea. Loading. Success toast.
- **Permission:** `manage` on `project:{project_id}`
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-PROJCAP-003 — Capability Enable/Disable
- **Priority:** P0 | **Status:** `PARTIAL_IMPLEMENTATION`
- **Requirement:** Enable/disable capabilities on a project.
- **API:**
  - Enable: `POST /v1/iam/control-plane/projects/{project_id}/capabilities/{capability_id}:enable` → `{ config?, quota? }` → `ProjectCapability`
  - Disable: `POST /v1/iam/control-plane/projects/{project_id}/capabilities/{capability_id}:disable` → `{ reason? }` → `ProjectCapability`
- **UI:** Project detail view shows list of capabilities with enable/disable toggles. Loading. Success toast.
- **Permission:** `manage` on `project:{project_id}`
- **Verification:** 1) Toggle calls correct API. 2) State updates.
- **Done criteria:** Component test.

## REQ-FE-PROJCAP-004 — Capability Register
- **Priority:** P0 | **Status:** `PARTIAL_IMPLEMENTATION`
- **Requirement:** Register new capabilities.
- **API:** `POST /v1/iam/control-plane/capabilities` → `{ name, displayName?, ownerService? }` → `IamCapability`
- **UI:** "Register Capability" button opens dialog with name, displayName, ownerService fields. Validation. Loading. Success toast.
- **Permission:** `manage` on `iam:capability`
- **Verification:** 1) Form validates. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

---

# 11. Skills (P0)

## REQ-FE-SKILL-001 — Skill List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Skills page shall list all skills with search, filter, and pagination.
- **API:** `GET /v1/skills?pageSize=...&pageToken=...&q=...&status=...&visibility=...` → `Page<Skill>`
  - **Response:** `Skill = { name, displayName, description, version, status, visibility, tags, versions, owner, createdAt }`
- **UI:** Grid/list view toggle. Search input. Filter by status/visibility. Pagination. Loading skeleton. Empty state.
- **Verification:** 1) Grid/list toggle works. 2) Search filters. 3) Pagination works. 4) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-SKILL-002 — Skill Create
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Create a globally named Skill only in an IAM Project where the authenticated Zone member has `create_skill` permission.
- **API:** `POST /v1/skills` → `{ name, displayName, description, version, orgId, projectId }` → `Skill`
- **UI:** Dialog with name validation and a required Project selector populated from `GET /v1/iam/orgs/{principal.orgId}/projects`. Submission is disabled when the Principal has no Zone or no Project is selected.
- **Verification:** 1) Form validates. 2) Project list is scoped to the Principal's Zone. 3) Submit includes `orgId` and `projectId`. 4) Success navigates to detail.
- **Done criteria:** Component test.

## REQ-FE-SKILL-003 — Skill Detail View
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Show skill detail with metadata, versions, file tree.
- **API:** `GET /v1/skills/{name}` + `GET /v1/skills/{name}/versions` → `Skill` (merged)
- **UI:** Detail sheet/panel with: metadata section, version timeline, file tree browser. Loading skeleton.
- **Verification:** 1) Detail renders. 2) Version timeline shows. 3) File tree loads.
- **Done criteria:** Component test.

## REQ-FE-SKILL-004 — Skill File Editor
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** CodeMirror editor for editing skill files with syntax highlighting.
- **API:**
  - Read: `GET /v1/skills/{name}/draft/file?version=...&path=...` → `SkillFileContent`
  - Save: `PUT /v1/skills/{name}/draft/file` → `{ version, path, type, content, commitMsg }` → `SkillFileContent`
- **UI:** CodeMirror editor with language-specific syntax highlighting. Save button. Unsaved changes warning. Loading state.
- **Verification:** 1) Editor loads file content. 2) Save calls API. 3) Syntax highlighting matches file type.
- **Done criteria:** Component test.

## REQ-FE-SKILL-005 — Skill Version Management
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Manage Skill versions as Git-native development refs and immutable SemVer releases.
- **API:**
  - Resolve one ref: `GET /v1/skills/{name}/refs:resolve?ref=...`
  - Refs: `GET /v1/skills/{name}/refs`
  - Commits: `GET /v1/skills/{name}/commits?ref=...`
  - Publish: `POST /v1/skills/{name}/releases`
  - Releases: `GET /v1/skills/{name}/releases`
  - Resolve: `GET /v1/skills/{name}/releases/{version}:resolve`
  - Restore: `POST /v1/skills/{name}:restore`
- **UI:** Git version panel with branch selector and server-provided HEAD, immutable release publishing, stale-HEAD refresh guidance, complete release provenance/integrity metadata, commit history, and an explicit auditable restore confirmation.
- **Verification:** 1) Publish automatically sends the selected branch HEAD as `expectedCommitSha` and surfaces `SKILL_RELEASE_STALE` as a refresh-and-retry prompt. 2) Releases preserve backend SemVer order and show publisher, notes, commit/tree/manifest hashes and publication time. 3) Restore creates a new commit with CAS instead of moving a Tag.
- **Done criteria:** Component test.

## REQ-FE-SKILL-006 — Skill Sharing
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Share skills with other users/groups via grants.
- **API:**
  - List: `GET /v1/skills/{name}/shares` → `ShareListResponse`
  - Create: `POST /v1/skills/{name}/shares` → `{ relation, subjectType, subjectId }` → `ResourceGrant`
  - Delete: `DELETE /v1/skills/{name}/shares/{subjectType}/{subjectId}` → `{}`
- **UI:** Share panel with current shares list. "Add Share" form with subjectType, subjectId, role dropdown. Remove button per share.
- **Verification:** 1) Shares list renders. 2) Add calls create API. 3) Remove calls delete API.
- **Done criteria:** Component test.

## REQ-FE-SKILL-007 — Skill Search
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Search skills by name, description, and type.
- **API:** `GET /v1/skills?q=...` (search query parameter)
- **UI:** Search input with debounce. Results update in real-time. Clear button. Loading indicator.
- **Verification:** 1) Search input works. 2) Results update. 3) Clear resets.
- **Done criteria:** Component test.

## REQ-FE-SKILL-008 — Skill Delete
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Delete skills with confirmation.
- **API:** `DELETE /v1/skills/{name}` → `string`
- **UI:** Delete button. Confirmation dialog. Loading. Success toast. Redirect to list.
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success redirects.
- **Done criteria:** Component test.

## REQ-FE-SKILL-009 — Skill File Tree
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** File tree for skill versions with create/rename/delete operations.
- **API:**
  - List: `GET /v1/skills/{name}/versions/{version}/files` → `SkillFileList`
  - Create dir: `POST /v1/skills/{name}/draft/dir` → `{ version, path }`
  - Rename: `POST /v1/skills/{name}/draft/path:move` → `{ version, oldPath, newPath }`
  - Delete: `DELETE /v1/skills/{name}/draft/path?version=...&path=...&recursive=true`
- **UI:** Tree view with expand/collapse. Context menu: new file, new folder, rename, delete. Loading state.
- **Verification:** 1) Tree renders. 2) Create/rename/delete operations work.
- **Done criteria:** Component test.

## REQ-FE-SKILL-010 — Skill Version Diff
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Compare any two Git branch, Tag, or commit refs using the backend's canonical diff.
- **API:** `GET /v1/skills/{name}/compare?baseRef=...&targetRef=...`
- **UI:** Base and target ref selectors, per-file status/addition/deletion summary, commit SHAs, unified patch, and a truncation notice when the server bounds a large patch.
- **Verification:** 1) Both selectors are populated from the refs API. 2) Compare sends exact refs. 3) File stats and unified patch render, including truncation state.
- **Done criteria:** Component test.

---

# 12. SkillSets (P0)

## REQ-FE-SKILLSET-001 — SkillSet List
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** List all skill groups with member count and labels.
- **API:** `GET /v1/skillsets?params...` → `Page<SkillSet>`
  - **Response:** `SkillSet = { name, displayName, description, memberCount, labels, createdAt }`
- **UI:** Card/list view. Search. Loading skeleton. Empty state.
- **Verification:** 1) List renders. 2) Search works. 3) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-SKILLSET-002 — SkillSet Create
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Create new skill groups.
- **API:** `POST /v1/skillsets` → `SkillSet` → `unknown`
- **UI:** Dialog with name, displayName, description fields. Validation. Loading. Success toast.
- **Verification:** 1) Form validates. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-SKILLSET-003 — SkillSet Detail
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Show detail view with member skills list.
- **API:** `GET /v1/skillsets/{name}` → `SkillSet`
- **UI:** Detail sheet/panel with metadata, member skills list, settings. Loading skeleton.
- **Verification:** 1) Detail renders. 2) Member list shows.
- **Done criteria:** Component test.

## REQ-FE-SKILLSET-004 — SkillSet Member Management
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Bind/unbind Skills while pinning every member to an exact immutable Skill Release.
- **API:**
  - Bind: `POST /v1/skillsets/{name}/members` → `SkillSetMember`
  - Unbind: `DELETE /v1/skillsets/{name}/members/{skillName}` → `{}`
  - Update member: `PUT /v1/skillsets/{name}/members/{skillName}` → `Partial<SkillSetMember>` → `SkillSetMember`
- **UI:** Member list with add/remove controls, Skill search, required Release selector, resolved Commit display, and in-place Release updates.
- **Verification:** 1) Add stays disabled until a Skill and exact Release are selected. 2) Bind/update sends the selected SemVer Tag. 3) Returned Commit and unresolved legacy state are visible.
- **Done criteria:** Component test.

## REQ-FE-SKILLSET-005 — SkillSet Delete
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Delete skill groups with confirmation.
- **API:** `DELETE /v1/skillsets/{name}` → `{}`
- **UI:** Delete button. Confirmation dialog. Loading. Success toast.
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-SKILLSET-006 — SkillSet Immutable Lock Snapshot
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Validate and expose a reproducible SkillSet snapshot for Runtime consumption.
- **API:** `GET /v1/skillsets/{name}:resolve` → `{ schemaVersion, skillSet: { name, revision }, skills: [{ skillName, version, commitSha, treeSha, manifestSha256 }], resolvedAt }`
- **UI:** "校验锁" action, unresolved-member warning, and a reviewable JSON lock snapshot.
- **Verification:** 1) Unresolved members block snapshot generation and are clearly identified. 2) Resolve returns exact Tag/Commit/Tree/manifest hashes for all members. 3) Snapshot revision and members render for review.
- **Done criteria:** Component test.

---

# 13. Agents (P1)

## REQ-FE-AGENT-001 — Agent List
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** List all agents with search and filter.
- **API:** `GET /v3/aihub/agents?params...` → `Page<AgentListItem>`
- **UI:** Table/card view. Search. Filter by status. Loading skeleton. Empty state.
- **Verification:** 1) List renders. 2) Search/filter works. 3) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-AGENT-002 — Agent Create
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/agents` → `AgentUpsertRequest` → `AgentResponse`
- **UI:** Dialog with agent configuration fields. Validation. Loading. Success toast.
- **Verification:** 1) Form validates. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-AGENT-003 — Agent Edit
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `PUT /v3/aihub/agents/{id}` → `AgentUpsertRequest` → `AgentResponse`
- **UI:** Edit button per row opens pre-filled dialog. Save with loading. Success toast.
- **Verification:** 1) Edit dialog pre-fills. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-AGENT-004 — Agent Delete
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `DELETE /v3/aihub/agents/{id}` → `{}`
- **UI:** Delete button. Confirmation dialog. Loading. Success toast.
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-AGENT-005 — Agent Runtime Resolution
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/runtime/agents/{id}/resolve` → `{ runtimeId?, sessionId?, version?, label?, policy? }` → `AgentRuntimeSnapshot`
- **UI:** "Resolve" button. Loading state. Result display with runtime info.
- **Verification:** 1) Resolve calls API. 2) Result displays.
- **Done criteria:** Component test.

## REQ-FE-AGENT-006 — Agent Status Display
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Display agent runtime status with 3 states: online (green), offline (gray), error (red).
- **UI:** Color-coded status badges per agent row. Status derived from runtime snapshot.
- **Verification:** 1) Status badge renders. 2) Color matches state.
- **Done criteria:** Component test.

---

# 14. Tools (P1)

## REQ-FE-TOOL-001 — Tool List
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/aihub/tools?params...` → `Page<ToolListItem>`
- **UI:** Table/card. Search. Filter by status. Loading skeleton. Empty state.
- **Verification:** 1) List renders. 2) Search/filter works. 3) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-TOOL-002 — Tool Create
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/tools` → `ToolUpsertRequest` → `ToolResponse`
- **UI:** Dialog with tool configuration. Validation. Loading. Success toast.
- **Verification:** 1) Form validates. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-TOOL-003 — Tool Edit
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `PUT /v3/aihub/tools/{id}` → `ToolUpsertRequest` → `ToolResponse`
- **UI:** Edit dialog pre-filled. Save with loading. Success toast.
- **Verification:** 1) Edit dialog pre-fills. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-TOOL-004 — Tool Delete
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `DELETE /v3/aihub/tools/{id}` → `{}`
- **UI:** Delete button. Confirmation dialog. Loading. Success toast.
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-TOOL-005 — Tool Runtime Resolution
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/runtime/tools/{id}/resolve` → `{ runtimeId?, sessionId?, version?, label? }` → `ToolRuntimeSnapshot`
- **UI:** "Resolve" button. Loading state. Result display.
- **Verification:** 1) Resolve calls API. 2) Result displays.
- **Done criteria:** Component test.

## REQ-FE-TOOL-006 — Tool Failure Records
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Display failure records for each tool (most recent 50).
- **API:** `GET /v3/aihub/tool-failures?params...` → `Page<ToolFailureRecord>`
  - **Response:** `ToolFailureRecord = { timestamp, errorMessage, retryCount, status }`
- **UI:** Table with columns: timestamp (relative), errorMessage, retryCount, status (resolved/unresolved). Sortable by timestamp. Filterable by status.
- **Verification:** 1) Table renders. 2) Sort works. 3) Filter works.
- **Done criteria:** Component test.

---

# 15. Sandboxes (P1)

## REQ-FE-SANDBOX-001 — Sandbox List
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/aihub/runtime/sandboxes?params...` → `Page<SandboxStatus>`
- **UI:** Table with status indicators. Loading skeleton. Empty state.
- **Verification:** 1) List renders. 2) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-SANDBOX-002 — Sandbox Create
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/runtime/sandboxes` → `SandboxEnsureRequest` → `SandboxStatus`
- **UI:** "Create/Ensure" button. Loading state. Success toast.
- **Verification:** 1) Create calls API. 2) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-SANDBOX-003 — Sandbox Restart
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/runtime/sandboxes/{id}/restart` → `SandboxStatus`
- **UI:** "Restart" button. Confirmation dialog. Loading. Success toast.
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-SANDBOX-004 — Sandbox Delete
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `DELETE /v3/aihub/runtime/sandboxes/{id}?deleteWorkspace=...` → `{}`
- **UI:** Delete button. Confirmation dialog with "Delete workspace" checkbox. Loading. Success toast.
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-SANDBOX-005 — Sandbox Tool View
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/aihub/runtime/sandboxes/{id}/tools` → `SandboxToolListResponse`
- **UI:** Tool list within sandbox detail. Loading skeleton.
- **Verification:** 1) Tool list renders. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-SANDBOX-006 — Sandbox Tool Call
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/runtime/sandboxes/{id}/tools/call` → `SandboxToolCallRequest` → `SandboxToolCallResult`
- **UI:** Tool call form with input parameters. Execute button. Result display. Loading state.
- **Verification:** 1) Form renders. 2) Execute calls API. 3) Result displays.
- **Done criteria:** Component test.

---

# 16. Namespaces (P1)

## REQ-FE-NS-001 — Namespace List
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/admin/namespaces` → `NamespaceInfo[]`
- **UI:** Table. Loading skeleton. Empty state.
- **Verification:** 1) Table renders. 2) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-NS-002 — Namespace Create
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/admin/namespaces` → `Record<string, unknown>` → `unknown`
- **UI:** Dialog with namespace configuration. Validation. Loading. Success toast.
- **Verification:** 1) Form validates. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-NS-003 — Namespace Member Management
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:**
  - List: `GET /v3/admin/namespaces/{namespaceId}/members` → `NamespaceMember[]`
  - Add: `POST /v3/admin/namespaces/{namespaceId}/members` → `Record<string, unknown>` → `unknown`
  - Remove: `DELETE /v3/admin/namespaces/{namespaceId}/members/{subjectId}` → `{}`
- **UI:** Member list with add/remove controls. User selector dialog.
- **Verification:** 1) Member list renders. 2) Add/remove works.
- **Done criteria:** Component test.

## REQ-FE-NS-004 — Namespace Delete
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** (no dedicated delete API found — likely `DELETE /v3/admin/namespaces/{id}`)
- **UI:** Delete button. Confirmation dialog. Loading. Success toast.
- **Verification:** 1) Confirmation shows. 2) Submit calls API. 3) Success refreshes list.
- **Done criteria:** Component test.

---

# 17. Governance (P1)

## REQ-FE-GOV-001 — Proposal List
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/admin/ai/skill-proposals/list?params...` → `Page<Proposal>`
- **UI:** Table with status badges. Search/filter. Loading skeleton. Empty state.
- **Verification:** 1) Table renders. 2) Search/filter works. 3) Loading/empty states.
- **Done criteria:** Component test.

## REQ-FE-GOV-002 — Proposal Detail
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/admin/ai/skill-proposals/{id}` → `Proposal`
- **UI:** Detail sheet/panel with review status, delta, evidence. Loading skeleton.
- **Verification:** 1) Detail renders. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-GOV-003 — Proposal Validate
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/admin/ai/skill-proposals/{id}/validate` → `unknown`
- **UI:** "Validate" button. Loading state. Result display (valid/invalid).
- **Verification:** 1) Validate calls API. 2) Result displays.
- **Done criteria:** Component test.

## REQ-FE-GOV-004 — Proposal Approve/Reject
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:**
  - Approve: `POST /v3/admin/ai/skill-proposals/{id}/approve` → `{ options }` → `unknown`
  - Reject: `POST /v3/admin/ai/skill-proposals/{id}/reject` → `{ reason }` → `unknown`
- **UI:** Approve/Reject buttons. Reject requires reason input. Confirmation dialog. Loading. Success toast.
- **Verification:** 1) Approve calls API. 2) Reject shows reason input. 3) Submit calls API. 4) Success refreshes list.
- **Done criteria:** Component test.

## REQ-FE-GOV-005 — Audit Log Viewer
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v1/audit/records?params...` → `{ records: AuditLog[], total }`
  - **Response:** `AuditLog = { action, resource, operator, timestamp }`
- **UI:** Table with columns: action, resource, operator, relative time. Pagination. Loading skeleton.
- **Verification:** 1) Table renders. 2) Pagination works. 3) Loading state.
- **Done criteria:** Component test.

## REQ-FE-GOV-006 — Metrics Display
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/admin/metrics` → `MetricsSnapshot`
- **UI:** Raw JSON preview or formatted stat cards. Loading skeleton.
- **Verification:** 1) Metrics display. 2) Loading state.
- **Done criteria:** Component test.

---

# 18. Layout & Navigation (P0)

## REQ-FE-UI-001 — App Shell with Tab Navigation
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** App shell with tab-based navigation supporting 14 tabs: skills, skillsets, agents, tools, model-profiles, sandbox-profiles, sandboxes, namespaces, governance, ops, proposals, iam, access, docs.
- **UI:** Tab bar with active indicator. Tab content switching. AnimatePresence transitions. SkillEditor overlay via context.
- **Verification:** 1) All tabs render. 2) Tab switching works. 3) Editor overlay opens.
- **Done criteria:** Component test.

## REQ-FE-UI-002 — Collapsible Sidebar
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Collapsible sidebar with animated width transition (56px collapsed, 240px expanded). Tooltips on collapsed items. Active tab indicator with animated gradient bar.
- **UI:** Sidebar with 4 sections: Registry, Governance, Access, Operations. Collapse/expand toggle. Tooltips. Active indicator.
- **Verification:** 1) Sidebar collapses/expands. 2) Tooltips show when collapsed. 3) Active tab highlighted.
- **Done criteria:** Component test.

## REQ-FE-UI-003 — Role-based Navigation Visibility
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Access and IAM tabs only visible to users with admin roles.
- **UI:** `isAccessAdmin()` checks `roles`, `externalRoles`, `permissions` arrays for admin-like values.
- **Verification:** 1) Admin user sees Access/IAM tabs. 2) Non-admin user does not.
- **Done criteria:** Component test.

## REQ-FE-UI-004 — Mobile Responsive Layout
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Mobile-responsive layout with hamburger menu, overlay sidebar with backdrop blur, close button.
- **UI:** `MobileSidebar` component. Hamburger button in top bar. Overlay with backdrop blur.
- **Verification:** 1) Mobile sidebar opens/closes. 2) Backdrop blur shows.
- **Done criteria:** Component test.

## REQ-FE-UI-005 — Top Bar with Breadcrumb
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Top bar with breadcrumb navigation, search button (Cmd+K), language toggle, notification bell with unread count, access space badge.
- **UI:** Breadcrumb (tab name > editor mode). Search button with keyboard shortcut hint. Language dropdown (zh/en). Notification bell with count badge (capped at "9+").
- **Verification:** 1) Breadcrumb displays. 2) Search button shows shortcut. 3) Language toggle works. 4) Notification count displays.
- **Done criteria:** Component test.

## REQ-FE-UI-006 — User Profile Panel
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** User profile slide-out panel showing identity info, namespaces, permissions, quick actions.
- **UI:** `UserPanelSheet` component. Avatar, display name, org, role badge, username, theme toggle, logout button.
- **Verification:** 1) Panel opens. 2) User info displays. 3) Logout works.
- **Done criteria:** Component test.

## REQ-FE-UI-007 — Global Command Palette
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Global command palette (Cmd+K / Ctrl+K) for searchable navigation across all tabs.
- **UI:** Command palette dialog with search input. Tab list grouped by section. Fuzzy search. Keyboard navigation.
- **Verification:** 1) Cmd+K opens palette. 2) Search filters tabs. 3) Click navigates to tab.
- **Done criteria:** Component test.

## REQ-FE-UI-008 — Theme Switching
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Dark/light/system theme switching via next-themes.
- **UI:** Theme toggle in sidebar (Sun/Moon icons). CSS class-based theming via Tailwind.
- **Verification:** 1) Theme toggle switches. 2) Dark/light modes render correctly.
- **Done criteria:** Component test.

## REQ-FE-UI-009 — Internationalization
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Chinese (zh) and English (en) locales with localStorage persistence, browser language detection, parameter interpolation.
- **API:** No API call. Locale stored in `localStorage` under `aihub_locale`.
- **UI:** Language toggle in top bar. `useT()` hook for translations. Fallback to English.
- **Verification:** 1) Language toggle switches locale. 2) Translation keys resolve. 3) Fallback works.
- **Done criteria:** Component test.

## REQ-FE-UI-010 — Toast Notification System
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Toast notifications for success/error/info states via sonner.
- **UI:** `Toaster` component in root layout. `toast.success()`, `toast.error()`, `toast.info()`.
- **Verification:** 1) Toast displays. 2) Auto-dismisses. 3) Multiple toasts stack.
- **Done criteria:** Component test.

## REQ-FE-UI-011 — Confirmation Dialog
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Reusable confirmation dialog with default and destructive variants.
- **UI:** `ConfirmDialog` component wrapping `AlertDialog`. `variant` prop: `default` or `destructive`. Customizable title, description, confirm/cancel labels.
- **Verification:** 1) Dialog opens. 2) Variants render correctly. 3) Confirm/cancel callbacks work.
- **Done criteria:** Component test.

## REQ-FE-UI-012 — Empty State Component
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Empty state component with icon, title, description, optional action slot.
- **UI:** `EmptyState` component. Centered layout with icon, title, description, optional children (action button).
- **Verification:** 1) Empty state renders. 2) Action slot renders.
- **Done criteria:** Component test.

## REQ-FE-UI-013 — Loading Skeleton Components
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** 3 loading skeleton variants: CardGridSkeleton (3x3 grid), ListSkeleton (5 rows), TableSkeleton (header + 5 rows). Animated pulse effect.
- **UI:** `CardGridSkeleton`, `ListSkeleton`, `TableSkeleton` components.
- **Verification:** 1) Each skeleton renders. 2) Pulse animation plays.
- **Done criteria:** Component test.

## REQ-FE-UI-014 — Stat Card Component
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Stat card with icon, label, value, optional trend, accent color variants.
- **UI:** `StatCard` component. Color variants: violet, emerald, amber, sky, rose. Trend indicator (up/down).
- **Verification:** 1) Card renders. 2) Color variants work. 3) Trend displays.
- **Done criteria:** Component test.

## REQ-FE-UI-015 — Skill Editor Overlay
- **Priority:** P0 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Skill editor overlay openable from any page via context.
- **UI:** `SkillEditorContext` provider. `AnimatePresence` transitions. Editor replaces current tab content.
- **Verification:** 1) Editor opens from any page. 2) Editor closes. 3) Transition animates.
- **Done criteria:** Component test.

---

# 19. Model Profiles (P1)

## REQ-FE-MODEL-001 — Model Profile List
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/aihub/model-profiles` → `ModelProfile[]`
- **UI:** Table with provider, endpoint, model mapping, raw JSON preview. Loading skeleton.
- **Verification:** 1) Table renders. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-MODEL-002 — Model Profile CRUD
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/model-profiles` → `ModelProfile` → `ModelProfile` | `PUT /v3/aihub/model-profiles/{id}` → `ModelProfile` → `ModelProfile` | `DELETE /v3/aihub/model-profiles/{id}` → `string`
- **UI:** JSON editor for create/update. Delete button with confirmation. Loading. Success toast.
- **Verification:** 1) Create/update/delete work. 2) JSON editor accepts input.
- **Done criteria:** Component test.

## REQ-FE-MODEL-003 — Default Model Profile
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Default profile for DeepSeek V4 Agent with vLLM provider.
- **UI:** Pre-filled form when creating new profile.
- **Verification:** 1) Default values pre-fill.
- **Done criteria:** Component test.

---

# 20. Sandbox Profiles (P1)

## REQ-FE-SBPROFILE-001 — Sandbox Profile List
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/aihub/sandbox-profiles` → `SandboxProfile[]`
- **UI:** Table with driver, network mode, resource limits, capabilities. Loading skeleton.
- **Verification:** 1) Table renders. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-SBPROFILE-002 — Sandbox Profile CRUD
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `POST /v3/aihub/sandbox-profiles` → `SandboxProfile` → `SandboxProfile` | `PUT /v3/aihub/sandbox-profiles/{id}` → `SandboxProfile` → `SandboxProfile` | `DELETE /v3/aihub/sandbox-profiles/{id}` → `string`
- **UI:** JSON editor for create/update. Delete with confirmation. Loading. Success toast.
- **Verification:** 1) CRUD works. 2) JSON editor accepts input.
- **Done criteria:** Component test.

## REQ-FE-SBPROFILE-003 — Default Sandbox Profile
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Default profile for Python offline sandbox with agent-sandbox driver.
- **UI:** Pre-filled form when creating new profile.
- **Verification:** 1) Default values pre-fill.
- **Done criteria:** Component test.

---

# 21. Operations (P1)

## REQ-FE-OPS-001 — Operations Dashboard
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** 4 stat cards: total metrics count, total error count, active token count, audit log count (last 24h).
- **API:** `GET /v3/admin/metrics` → `MetricsSnapshot`
- **UI:** 4 `StatCard` components with icons, values, optional trends. Loading skeleton.
- **Verification:** 1) 4 cards render. 2) Values display. 3) Loading state.
- **Done criteria:** Component test.

## REQ-FE-OPS-002 — Audit Log Table
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v1/audit/records?params...` → `{ records: AuditLog[], total }`
- **UI:** Table with columns: action, resource, operator, relative time. Pagination. Loading skeleton.
- **Verification:** 1) Table renders. 2) Pagination works. 3) Loading state.
- **Done criteria:** Component test.

## REQ-FE-OPS-003 — Metrics Display
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:** `GET /v3/admin/metrics` → `MetricsSnapshot`
- **UI:** Raw JSON preview. Loading skeleton.
- **Verification:** 1) JSON displays. 2) Loading state.
- **Done criteria:** Component test.

## REQ-FE-OPS-004 — API Token Management
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:**
  - List: `GET /v3/admin/iam/tokens?subjectId=...` → `TokenInfo[]`
  - Create: `POST /v3/admin/iam/tokens` → `Record<string, unknown>` → `TokenInfo`
  - Delete: `DELETE /v3/admin/iam/tokens/{keyId}` → `{}`
- **UI:** Token list table. Create button opens dialog with name, subjectId, subjectType, permissions, namespaces. Delete with confirmation. Token value shown once after creation.
- **Verification:** 1) List renders. 2) Create works. 3) Delete works.
- **Done criteria:** Component test.

## REQ-FE-OPS-005 — Notifications Management
- **Priority:** P1 | **Status:** `OBSERVED_IMPLEMENTED`
- **API:**
  - List: `GET /v3/admin/notifications?params...` → `Notification[]`
  - Mark read: `POST /v3/admin/notifications/{id}/read` → `{}`
- **UI:** Notification table with title, message, target, read/unread status. Mark-as-read button per row. "Mark all read" button.
- **Verification:** 1) List renders. 2) Mark read works. 3) Unread count updates.
- **Done criteria:** Component test.

---

# 22. Documentation (P2)

## REQ-FE-DOCS-001 — Documentation Page
- **Priority:** P2 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Static documentation page with feature descriptions, API endpoint reference, deployment notes.
- **UI:** Markdown-rendered documentation. Sections: Skills, SkillSets, Access/IAM, Governance, API Reference, Deployment.
- **Verification:** 1) Page renders. 2) Sections display.
- **Done criteria:** Component test.

---

# 23. Engineering (P2)

## REQ-FE-ENG-001 — Build and Deploy
- **Priority:** P2 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** CI/CD pipeline (build, lint, docker, deploy).
- **Implementation:** `.github/workflows/ci.yml` — triggered on PR/push to `main` and `feat/**`. Steps: checkout, setup Bun, install, lint, build, docker build.
- **Verification:** CI passes on PR.

## REQ-FE-ENG-002 — TypeScript Strict Mode
- **Priority:** P2 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** TypeScript strict mode for type safety.
- **Implementation:** `tsconfig.json` — `"strict": true`
- **Verification:** `tsc --noEmit` passes.

## REQ-FE-ENG-003 — Docker Multi-stage Build
- **Priority:** P2 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Multi-stage Docker build (Bun install/build → Node.js runtime). Non-root user. Standalone output.
- **Implementation:** `Dockerfile` — `oven/bun:1.3.4-alpine` for build, `node:22-alpine` for runtime. Port 3000. `nextjs` user (uid/gid 1001).
- **Verification:** `docker build` succeeds.

## REQ-FE-ENG-004 — Environment Variable Configuration
- **Priority:** P2 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** Runtime configuration via environment variables.
- **Variables:** `NEXT_PUBLIC_HUB_URL` (default `:18001`), `NEXT_PUBLIC_IAM_URL` (default `:18080`), `NEXT_PUBLIC_AUTH_MODE` (gateway_oidc/token), `NEXT_PUBLIC_GATEWAY_LOGOUT_PATH` (default `/logout`), `NEXT_PUBLIC_AUTH_CALLBACK_PATH` (default `/auth/callback`).
- **Implementation:** `next.config.ts`, `.env`, `Dockerfile` build args.
- **Verification:** Env vars are read correctly at build time.

## REQ-FE-ENG-005 — ESLint Code Quality
- **Priority:** P2 | **Status:** `OBSERVED_IMPLEMENTED`
- **Requirement:** ESLint configuration for code quality enforcement.
- **Implementation:** `eslint.config.mjs` — flat config with TypeScript and React rules.
- **Verification:** `eslint .` passes.
