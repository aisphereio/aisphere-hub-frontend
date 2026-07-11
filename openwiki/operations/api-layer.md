# API Layer

## Architecture

The frontend communicates **directly** with the hub backend API. There are no Next.js rewrites. The API layer is in `src/lib/api/` and consists of:

```
src/lib/api/
├── client.ts    # Core request function, auth, URL building
├── index.ts     # All API modules (authApi, skillApi, authzApi, etc.)
└── types.ts     # TypeScript types for all domain models
```

## Core Request Function (`client.ts`)

The `request<T>(url, init)` function is the foundation:

1. **URL building** — `apiUrl(path)` prepends `HUB_URL` to relative paths
2. **Auth headers** — In token mode, adds `Authorization: Bearer <token>`. In gateway_oidc mode, adds `X-Requested-With: XMLHttpRequest`
3. **Content-Type** — Auto-sets `application/json` for non-FormData bodies
4. **Credentials** — Defaults to `same-origin`
5. **Error handling** — On 401 in gateway_oidc mode, throws without clearing token (avoids redirect loops). On other errors, parses JSON error body or falls back to status text
6. **Response parsing** — Handles JSON, binary (zip/octet-stream), and text responses

### Key Exports

| Export | Purpose |
|--------|---------|
| `HUB_URL` | Hub base URL (from env or default) |
| `AUTH_MODE` | Current auth mode |
| `IS_GATEWAY_OIDC` | Boolean flag for gateway_oidc mode |
| `getToken()` / `setToken()` / `clearToken()` | Token management (localStorage) |
| `getAccessSpace()` / `setAccessSpace()` | Access space selection |
| `apiUrl(path)` | Build full API URL |
| `request<T>(url, init)` | Core request function |
| `toQuery(params)` | Build URL query string |
| `asItems(page)` | Extract items array from paginated response |

## API Modules (`index.ts`)

### Auth API (`authApi`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `exchange()` | `POST /v1/authn/exchange` | Exchange OAuth code for tokens |
| `loginUrl()` | `GET /v1/authn/login-url` | Get Casdoor login URL |
| `login()` | — | Returns gateway login URL (gateway_oidc mode) |
| `refresh()` | `POST /v1/authn/refresh` | Refresh access token |
| `logoutUrl()` | `GET /v1/authn/logout-url` | Get Casdoor logout URL |
| `logout()` | — | Returns gateway logout path |
| `me()` | `GET /v1/authn/me` | Get current principal |

### Skills Module (`skillApi`)

See [Skills Domain](../domain/skills.md) for full details.

### SkillSets Module (`skillSetApi`)

See [SkillSets Domain](../domain/skillsets.md) for full details.

### Authorization Module (`authzApi`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `check()` | `POST /v1/authz/check` | Check permission |
| `writeRelationships()` | `POST /v1/authz/relationships` | Write relationship tuples |
| `deleteRelationships()` | `DELETE /v1/authz/relationships` | Delete relationship tuples |
| `readRelationships()` | `GET /v1/authz/relationships` | Read relationship tuples |
| `lookupResources()` | `GET /v1/authz/lookup-resources` | Find accessible resources |
| `lookupSubjects()` | `GET /v1/authz/lookup-subjects` | Find accessing subjects |
| `readSchema()` | `GET /v1/authz/schema` | Read SpiceDB schema |
| `writeSchema()` | `PUT /v1/authz/schema` | Write SpiceDB schema |

### Other Modules

| Module | Base Path | Status |
|--------|-----------|--------|
| `accessApi` | `/v1/authz/*` | Legacy, will 404 on new hub |
| `sharesApi` | `/v1/skills/{name}/shares` | ✅ Migrated |
| `auditApi` | `/v1/audit/records` | ✅ Migrated |
| `agentApi` | `/v3/aihub/agents/*` | ⏳ Awaiting migration |
| `toolApi` | `/v3/aihub/tools/*` | ⏳ Awaiting migration |
| `sandboxApi` | `/v3/aihub/runtime/sandboxes/*` | ⏳ Awaiting migration |
| `proposalApi` | `/v3/admin/ai/skill-proposals/*` | ⏳ Awaiting migration |
| `iamApi` | `/v3/admin/iam/*` | ⏳ Awaiting migration |
| `namespaceApi` | `/v3/admin/namespaces/*` | ⏳ Awaiting migration |
| `socialApi` | `/v3/admin/ai/skills/social/*` | ⏳ Awaiting migration |
| `tokenApi` | `/v3/admin/iam/tokens/*` | ⏳ Awaiting migration |
| `metricsApi` | `/v3/admin/metrics` | ⏳ Awaiting migration |
| `notificationApi` | `/v3/admin/notifications/*` | ⏳ Awaiting migration |
| `sandboxProfileApi` | `/v3/aihub/sandbox-profiles/*` | ⏳ Awaiting migration |
| `modelProfileApi` | `/v3/aihub/model-profiles/*` | ⏳ Awaiting migration |

## Response Normalization

The API layer normalizes backend responses to handle inconsistencies:

- **`normalizeSkill()`** — Merges tags, sorts versions, derives version fields, extracts labels/metadata from manifestJson
- **`normalizeSkillPage()`** — Applies `normalizeSkill()` to all items in a page
- **`asItems()`** — Extracts items from various response shapes (`items`, `skills`, `versions`, `files`, `shares`, `records`, `list`, `data`, `pageItems`, or raw array)
- **`deriveAccessMode()`** — Computes access mode from grants list
- **`fileToBase64()`** — Converts File to base64 for upload

## Query Key Conventions

React Query hooks follow consistent key patterns for cache management:

| Pattern | Example |
|---------|---------|
| `[domain, 'list', params]` | `['skills', 'list', { q: 'test' }]` |
| `[domain, 'detail', id]` | `['skills', 'detail', skillName]` |
| `[domain, 'files', name, version]` | `['skills', 'files', name, ver]` |
| `[domain, 'file', name, version, path]` | `['skills', 'file', name, ver, path]` |
| `[domain, 'shares', id]` | `['skills', 'shares', skillName]` |

## TypeScript Types (`types.ts`)

The types file defines all domain models:

- **Core**: `Skill`, `SkillVersion`, `SkillFileInfo`, `SkillFileContent`, `SkillDraft`
- **SkillSets**: `SkillSet`, `SkillSetMember`, `SkillSetUpdate`
- **Agents**: `AgentListItem`, `AgentResponse`, `AgentRuntimeSnapshot`, `AgentUpsertRequest`
- **Tools**: `ToolListItem`, `ToolResponse`, `ToolRuntimeSnapshot`, `ToolUpsertRequest`
- **Sandboxes**: `SandboxStatus`, `SandboxEnsureRequest`, `SandboxToolCallRequest`
- **IAM**: `IamPrincipal`, `IamUser`, `IamOrganization`, `IamGroup`, `IamProject`, `IamCapability`, `IamResource`, `IamResourceBinding`, `IamRoleTemplate`, `IamGrant`
- **Authz**: `AccessEvaluateResult`, `AccessOverview`, `AccessResourceTemplate`
- **Sharing**: `ResourceGrant`, `CreateShareRequest`, `ShareListResponse`, `ShareRole`, `ShareSubjectType`
- **Other**: `Page<T>`, `AuditLog`, `TokenInfo`, `MetricsSnapshot`, `NamespaceInfo`, `NamespaceMember`, `ModelProfile`, `SandboxProfile`

## Source Files

| File | Purpose |
|------|---------|
| `src/lib/api/client.ts` | Core request function, auth, URL building |
| `src/lib/api/index.ts` | All API modules |
| `src/lib/api/types.ts` | TypeScript type definitions |