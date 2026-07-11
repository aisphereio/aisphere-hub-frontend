# IAM & Authorization

## Overview

The platform has a comprehensive Identity and Access Management (IAM) system backed by **Casdoor** (identity provider) and **SpiceDB** (ReBAC authorization engine). The frontend provides management UIs for both.

## IAM Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Casdoor                           │
│  - Identity provider (OIDC)                         │
│  - Organizations, users, groups                     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              IAM API (/v1/iam/*, /v3/admin/iam/*)    │
│  - Directory: users, groups, organizations           │
│  - Control Plane: projects, capabilities, resources  │
│  - Grants: role templates, resource bindings         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              SpiceDB (/v1/authz/*)                   │
│  - ReBAC: relationship-based access control          │
│  - CheckPermission, LookupResources, LookupSubjects  │
│  - Relationship CRUD, Schema management              │
└─────────────────────────────────────────────────────┘
```

## IAM API Modules

The IAM API is split across several modules in `src/lib/api/index.ts`:

### `iamApi` — Legacy Local User Management
- `listUsers()`, `saveUser()`, `deleteUser()` — CRUD for local users
- Path: `/v3/admin/iam/users` (awaiting migration)

### `iamDirectoryApi` — Directory Services
- `listUsers(orgId)`, `getOrganization(orgId)`, `listGroups(orgId)`
- Path: `/v1/iam/directory/*`

### `iamProjectApi` — Control Plane
- Organizations: `listOrganizations()`, `getOrganization()`, `createOrganization()`, `updateOrganization()`, `deleteOrganization()`
- Projects: `listProjects()`, `getProject()`, `createProject()`, `updateProject()`, `deleteProject()`
- Capabilities: `listCapabilities()`, `getCapability()`, `createCapability()`, `updateCapability()`, `deleteCapability()`
- Resources: `listResources()`, `getResource()`, `createResource()`, `updateResource()`, `deleteResource()`
- Resource Types: `listResourceTypes()`
- Paths: `/v1/iam/cp/*`

### `iamResourceService` — Resource Bindings
- `listResourceBindings()`, `createResourceBinding()`, `deleteResourceBinding()`
- Path: `/v1/iam/resources/*/bindings`

### `iamGrantService` — Role Grants
- `listGrants()`, `createGrant()`, `deleteGrant()`
- Path: `/v1/iam/grants`

### `iamAuthApi` — Current User
- `getMe()` — Returns the current authenticated principal
- Path: `/v1/authn/me`

## Authorization API (SpiceDB ReBAC)

The `authzApi` module provides a full ReBAC interface backed by SpiceDB:

| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| CheckPermission | `POST /v1/authz/check` | Check if subject has permission on resource |
| WriteRelationships | `POST /v1/authz/relationships` | Create/update relationship tuples |
| DeleteRelationships | `DELETE /v1/authz/relationships` | Delete relationship tuples |
| ReadRelationships | `GET /v1/authz/relationships` | List relationship tuples |
| LookupResources | `GET /v1/authz/lookup-resources` | Find resources a subject can access |
| LookupSubjects | `GET /v1/authz/lookup-subjects` | Find subjects that can access a resource |
| ReadSchema | `GET /v1/authz/schema` | Read SpiceDB schema |
| WriteSchema | `PUT /v1/authz/schema` | Write SpiceDB schema |

### Legacy Access API (`accessApi`)

The old access management panel (`/v1/authz/overview`, `/v1/authz/resources`, `/v1/authz/links`, `/v1/authz/evaluate`) is **not implemented** in the new hub. These endpoints will 404 until the authz management UI is rebuilt on top of `/v1/authz/relationships` + `/v1/authz/lookup-subjects`.

## Sharing

Skills and other resources can be shared via grants:

### Share Model
```typescript
type ResourceGrant = {
  id: string;
  subjectType: 'user' | 'group' | 'organization';
  subjectId: string;
  subjectRelation?: string;
  role: 'viewer' | 'editor' | 'admin';
  resourceType: string;
  resourceId: string;
};

type AccessMode = 'private' | 'shared' | 'public';
```

### Share Hooks (`src/hooks/use-shares.ts`)
- `useResourceShares(type, id)` — List shares for a resource
- `useCreateShare()` — Create a new share grant
- `useDeleteShare()` — Remove a share grant
- `useSetPrivate()` — Remove all shares (set to private)

### Skill Sharing (`src/hooks/use-skill-sharing.ts`)
- `useSkillShares(skillName)` — List shares for a skill
- `useSkillShareTargets(open, query)` — Searchable user/group picker for sharing
- `useGrantSkillShare(skillName)` — Grant access to a skill
- `useRevokeSkillShare(skillName)` — Revoke access from a skill

The share target picker fetches users and groups from the IAM directory and filters them client-side by search query.

## Namespaces

Namespaces provide multi-tenant isolation:

### API (`namespaceApi`)
- `list()`, `save()`, `members()`, `saveMember()`, `deleteMember()`
- Path: `/v3/admin/namespaces` (awaiting migration)

### Hooks (`src/hooks/use-namespaces.ts`)
- `useNamespaces()` — List all namespaces
- `useNamespaceMembers(id)` — List members of a namespace
- `useNamespaceSave()` — Create/update namespace
- `useNamespaceSaveMember()` — Add/update namespace member
- `useNamespaceDeleteMember()` — Remove namespace member

## IAM Page (`src/components/pages/iam-page.tsx`)

The IAM management page (~38KB) is the largest page component. It provides:

- **Organization management** — Create, edit, delete organizations
- **Project management** — Create, edit, delete projects within organizations
- **User management** — List, create, edit, delete users
- **Group management** — List, create, edit, delete groups
- **Capability management** — Define capabilities and assign to projects
- **Resource management** — Define resource types and resources
- **Grant management** — Role template grants and bindings
- **Token management** — API token CRUD

## User Panel (`src/components/layout/user-panel-sheet.tsx`)

The user panel slide-out shows:
- Avatar with initials fallback
- Identity badge: subjectType + roles + groups
- Detail rows: subjectId (copyable), email, organization, project, token expiry
- Namespace badges
- Permissions list (max 50, overflow collapsed)
- Quick actions: Manage API Tokens (→ IAM), Sign out

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/api/index.ts` | All IAM and authz API modules |
| `src/lib/api/types.ts` | IAM types (IamPrincipal, IamUser, IamOrganization, etc.) |
| `src/hooks/use-iam.ts` | IAM React Query hooks |
| `src/hooks/use-auth.ts` | Auth hooks (useMe, useLogout) |
| `src/hooks/use-shares.ts` | Resource sharing hooks |
| `src/hooks/use-skill-sharing.ts` | Skill-specific sharing hooks |
| `src/hooks/use-namespaces.ts` | Namespace hooks |
| `src/hooks/use-access.ts` | Access evaluation hooks |
| `src/components/pages/iam-page.tsx` | IAM management page |
| `src/components/pages/access-page.tsx` | Access management page |
| `src/components/pages/namespaces-page.tsx` | Namespace management page |
| `src/components/layout/user-panel-sheet.tsx` | User profile panel |
| `src/components/aihub/resource-share-panel.tsx` | Resource share management |