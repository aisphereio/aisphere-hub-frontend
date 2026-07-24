# Build Manifest — Aisphere Hub Frontend

> Cycle: C1 | Generated: 2026-07-13 | Status: APPROVED

## Summary

| Dimension | Count |
|-----------|:-----:|
| Total REQs | 125 |
| Total ART entries | 105 |
| Missing ART (API done, UI pending) | 22 |

## Artifact Index

### Authentication (4 REQs, 4 ART)

| ART-ID | REQ-ID | Path | Notes |
|--------|--------|------|-------|
| ART-0001 | REQ-FE-AUTH-001 | `src/lib/api/client.ts` | Gateway OIDC auth mode |
| ART-0002 | REQ-FE-AUTH-002 | `src/lib/api/client.ts` | Browser token auth mode |
| ART-0003 | REQ-FE-AUTH-003 | `src/app/auth/callback/page.tsx` | OAuth callback handler |
| ART-0004 | REQ-FE-AUTH-004 | `src/components/layout/topbar.tsx` | Current user display |

### IAM Management (15 REQs, 15 ART)

| ART-ID | REQ-ID | Path | Notes |
|--------|--------|------|-------|
| ART-0005 | REQ-FE-IAM-001 | `src/components/pages/iam-page.tsx` | Local user list |
| ART-0006 | REQ-FE-IAM-002 | `src/components/pages/iam-page.tsx` | Local user CRUD |
| ART-0007 | REQ-FE-IAM-003 | `src/components/pages/iam-page.tsx` | Organization list |
| ART-0008 | REQ-FE-IAM-004 | `src/components/pages/iam-page.tsx` | Organization create |
| ART-0009 | REQ-FE-IAM-005 | `src/components/pages/iam-page.tsx` | Project list |
| ART-0010 | REQ-FE-IAM-006 | `src/components/pages/iam-page.tsx` | Project create |
| ART-0011 | REQ-FE-IAM-007 | `src/components/pages/iam-page.tsx` | Role template list |
| ART-0012 | REQ-FE-IAM-008 | `src/components/pages/iam-page.tsx` | Grant list |
| ART-0013 | REQ-FE-IAM-009 | `src/components/pages/iam-page.tsx` | Grant access |
| ART-0014 | REQ-FE-IAM-010 | `src/components/pages/iam-page.tsx` | Revoke access |
| ART-0015 | REQ-FE-IAM-011 | `src/components/pages/iam-page.tsx` | Resource type list |
| ART-0016 | REQ-FE-IAM-012 | `src/components/pages/iam-page.tsx` | Resource list |
| ART-0017 | REQ-FE-IAM-013 | `src/hooks/use-iam.ts` | Directory users by org |
| ART-0018 | REQ-FE-IAM-014 | `src/hooks/use-iam.ts` | Directory groups by org |
| ART-0019 | REQ-FE-IAM-015 | `src/hooks/use-iam.ts` | Directory org metadata |

### Access Control (6 REQs, 5 ART)

| ART-ID | REQ | Path | Description |
|--------|-----|------|-------------|
| ART-0020 | REQ-FE-ACCESS-001 | `src/components/pages/access-page.tsx` | Authz overview |
| ART-0021 | REQ-FE-ACCESS-002 | `src/components/pages/access-page.tsx` | Resource action catalog |
| ART-0022 | REQ-FE-ACCESS-003 | `src/components/pages/access-page.tsx` | Casdoor admin links |
| ART-0023 | REQ-FE-ACCESS-004 | `src/components/pages/access-page.tsx` | Permission evaluation |
| ART-0024 | REQ-FE-ACCESS-005 | `src/components/pages/access-page.tsx` | Permission test examples |

### IAM Group Admin (5 REQs, 5 ART — ✅ UI implemented)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0025 | REQ-FE-GROUP-001 | `src/components/pages/iam-page.tsx` | Group list with search, loading, empty state |
| ART-0026 | REQ-FE-GROUP-002 | `src/components/pages/iam-page.tsx` | Group create dialog with validation |
| ART-0027 | REQ-FE-GROUP-003 | `src/lib/api/index.ts` + `src/hooks/use-iam.ts` | `iamGroupAdminApi.updateGroup` + `useIamUpdateGroup` ✅ API done |
| ART-0028 | REQ-FE-GROUP-004 | `src/components/pages/iam-page.tsx` | Group delete with confirmation |
| ART-0029 | REQ-FE-GROUP-005 | `src/components/pages/iam-page.tsx` | Group member add/remove panel |

### IAM Authz Admin (9 REQs, 9 ART — ✅ UI implemented)

| ART | REQ | Path | Description |
|--------|-----|------|-------------|
| ART-0030 | REQ-FE-AUTHZADMIN-001 | `src/components/pages/authz-admin-page.tsx` | Schema viewer with code block |
| ART-0031 | REQ-FE-AUTHZADMIN-002 | `src/components/pages/authz-admin-page.tsx` | Schema validate with textarea |
| ART-0032 | REQ-FE-AUTHZADMIN-003 | `src/components/pages/authz-admin-page.tsx` | Schema publish with confirmation |
| ART-0033 | REQ-FE-AUTHZADMIN-004 | `src/components/pages/authz-admin-page.tsx` | Relationship list with filters |
| ART-0034 | REQ-FE-AUTHZADMIN-005 | `src/components/pages/authz-admin-page.tsx` | Relationship write dialog |
| ART-0035 | REQ-FE-AUTHZADMIN-006 | `src/components/pages/authz-admin-page.tsx` | Relationship delete |
| ART-0036 | REQ-FE-AUTHZADMIN-007 | `src/components/pages/authz-admin-page.tsx` | Permission check tool |
| ART-0037 | REQ-FE-AUTHZADMIN-008 | `src/components/pages/authz-admin-page.tsx` | Permission explanation |
| ART-0038 | REQ-FE-AUTHZADMIN-009 | `src/components/pages/authz-admin-page.tsx` | Effective permissions viewer |

### IAM User Admin (4 REQs, 0 ART — migration needed)

| ART | REQ | Description | Notes |
|--------|-----|-------------|-------|
| — | REQ-FE-USERADMIN-001 | User list migration | `iamDirectoryApi.listUsers` exists, UI uses `iamApi.listUsers` (v3) |
| — | REQ-FE-USERADMIN-002 | User create migration | No v1 API yet |
| — | REQ-FE-USERADMIN-003 | User update migration | No v1 API yet |
| — | REQ-FE-USERADMIN-004 | User disable | No v1 API yet |

### Project Capabilities (4 REQs, 0 ART — API done, UI pending)

| REQ | Description | Notes |
|-----|-------------|-------|
| REQ-FE-PROJCAP-001 | Project update | `iamProjectApi.updateProject` ✅ |
| REQ-FE-PROJCAP-002 | Project archive | `iamProjectApi.archiveProject` ✅ |
| REQ-FE-PROJCAP-003 | Capability enable/disable | `iamProjectApi.enable/disableProjectCapability` ✅ |
| REQ-FE-PROJCAP-004 | Capability register | `iamProjectApi.registerCapability` ✅ |

### Skills (10 REQs, 10 ART)

| ART | REQ | Path | Description |
|--------|-----|------|-------------|
| ART-0039 | REQ-FE-SKILL-001 | `src/components/pages/skills-page.tsx` | Skill list |
| ART-0040 | REQ-FE-SKILL-002 | `src/components/skills/skill-create-dialog.tsx`, `src/hooks/use-iam.ts`, `src/hooks/use-skills.ts` | Project-scoped Skill create |
| ART-0041 | REQ-FE-SKILL-003 | `src/components/pages/skills-page.tsx` | Skill detail view |
| ART-0042 | REQ-FE-SKILL-004 | `src/components/editor/code-editor.tsx` | Skill file editor |
| ART-0043 | REQ-FE-SKILL-005 | `src/components/editor/skill-releases-panel.tsx`, `src/hooks/use-skill-releases.ts`, `src/lib/api/adapters/skill-release.ts` | Git refs, immutable releases, commit history, auditable restore |
| ART-0044 | REQ-FE-SKILL-006 | `src/components/aihub/resource-share-panel.tsx` | Skill sharing |
| ART-0045 | REQ-FE-SKILL-007 | `src/components/pages/skills-page.tsx` | Skill search |
| ART-0046 | REQ-FE-SKILL-008 | `src/components/pages/skills-page.tsx` | Skill delete |
| ART-0047 | REQ-FE-SKILL-009 | `src/components/editor/file-tree.tsx` | Skill file tree |
| ART-0048 | REQ-FE-SKILL-010 | `src/components/editor/skill-releases-panel.tsx`, `src/lib/api/generated/skill-release-service/` | Canonical branch/Tag/commit comparison |

### SkillSets (6 REQs, 6 ART)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0049 | REQ-FE-SKILLSET-001 | `src/components/pages/skillsets-page.tsx` | SkillSet list |
| ART-0050 | REQ-FE-SKILLSET-002 | `src/components/pages/skillsets-page.tsx` | SkillSet create |
| ART-0051 | REQ-FE-SKILLSET-003 | `src/components/pages/skillsets-page.tsx` | SkillSet detail |
| ART-0052 | REQ-FE-SKILLSET-004 | `src/components/skillsets/skillset-member-list.tsx`, `src/hooks/use-skillsets.ts` | Exact Release-pinned SkillSet members |
| ART-0053 | REQ-FE-SKILLSET-005 | `src/components/pages/skillsets-page.tsx` | SkillSet delete |
| ART-0054 | REQ-FE-SKILLSET-006 | `src/components/skillsets/skillset-member-list.tsx`, `src/lib/api/index.ts`, `src/lib/api/types.ts` | Runtime-consumable immutable lock snapshot |

### Agents (6 REQs, 6 ART)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0055 | REQ-FE-AGENT-001 | `src/components/pages/agents-page.tsx` | Agent list |
| ART-0056 | REQ-FE-AGENT-002 | `src/components/pages/agents-page.tsx` | Agent create |
| ART-0057 | REQ-FE-AGENT-003 | `src/components/pages/agents-page.tsx` | Agent edit |
| ART-0058 | REQ-FE-AGENT-004 | `src/components/pages/agents-page.tsx` | Agent delete |
| ART-0059 | REQ-FE-AGENT-005 | `src/components/pages/agents-page.tsx` | Agent runtime resolution |
| ART-0060 | REQ-FE-AGENT-006 | `src/components/pages/agents-page.tsx` | Agent status display |

### Tools (6)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0061 | REQ-FE-TOOL-001 | `src/components/pages/tools-page.tsx` | Tool list |
| ART-0062 | REQ-FE-TOOL-002 | `src/components/pages/tools-page.tsx` | Tool create |
| ART-0063 | REQ-FE-TOOL-003 | `src/components/pages/tools-page.tsx` | Tool edit |
| ART-0064 | REQ-FE-TOOL-004 | `src/components/pages/tools-page.tsx` | Tool delete |
| ART-0065 | REQ-FE-TOOL-005 | `src/components/pages/tools-page.tsx` | Tool runtime resolution |
| ART-0066 | REQ-FE-TOOL-006 | `src/components/pages/tools-page.tsx` | Tool failure records |

### Sandboxes (6)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0067 | REQ-FE-SANDBOX-001 | `src/components/pages/sandboxes-page.tsx` | Sandbox list |
| ART-0068 | REQ-FE-SANDBOX-002 | `src/components/pages/sandboxes-page.tsx` | Sandbox create |
| ART-0069 | REQ-FE-SANDBOX-003 | `src/components/pages/sandboxes-page.tsx` | Sandbox restart |
| ART-0070 | REQ-FE-SANDBOX-004 | `src/components/pages/sandboxes-page.tsx` | Sandbox delete |
| ART-0071 | REQ-FE-SANDBOX-005 | `src/components/pages/sandboxes-page.tsx` | Sandbox tool view |
| ART-0072 | REQ-FE-SANDBOX-006 | `src/components/pages/sandboxes-page.tsx` | Sandbox tool call |

### Namespaces (4)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0073 | REQ-FE-NS-001 | `src/components/pages/namespaces-page.tsx` | Namespace list |
| ART-0074 | REQ-FE-NS-002 | `src/components/pages/namespaces-page.tsx` | Namespace create |
| ART-0075 | REQ-FE-NS-003 | `src/components/pages/namespaces-page.tsx` | Namespace member management |
| ART-0076 | REQ-FE-NS-004 | `src/components/pages/namespaces-page.tsx` | Namespace delete |

### Governance (6)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0077 | REQ-FE-GOV-001 | `src/components/pages/proposals-page.tsx` | Proposal list |
| ART-0078 | REQ-FE-GOV-002 | `src/components/pages/proposals-page.tsx` | Proposal detail |
| ART-0079 | REQ-FE-GOV-003 | `src/components/pages/proposals-page.tsx` | Proposal validate |
| ART-0080 | REQ-FE-GOV-004 | `src/components/pages/proposals-page.tsx` | Proposal approve/reject |
| ART-0081 | REQ-FE-GOV-005 | `src/components/pages/governance-page.tsx` | Audit log viewer |
| ART-0082 | REQ-FE-GOV-006 | `src/components/pages/governance-page.tsx` | Metrics display |

### Layout & Navigation (15)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0083 | REQ-FE-UI-001 | `src/components/layout/app-shell.tsx` | App shell with tab navigation |
| ART-0084 | REQ-FE-UI-002 | `src/components/layout/sidebar.tsx` | Collapsible sidebar |
| ART-0085 | REQ-FE-UI-003 | `src/components/layout/sidebar.tsx` | Role-based nav visibility |
| ART-0086 | REQ-FE-UI-004 | `src/components/layout/sidebar.tsx` | Mobile responsive layout |
| ART-0087 | REQ-FE-UI-005 | `src/components/layout/topbar.tsx` | Top bar with breadcrumb |
| ART-0088 | REQ-FE-UI-006 | `src/components/layout/app-shell.tsx` | User profile panel |
| ART-0089 | REQ-FE-UI-007 | `src/components/layout/command-palette.tsx` | Global command palette |
| ART-0090 | REQ-FE-UI-008 | `src/app/layout.tsx` | Theme switching |
| ART-0091 | REQ-FE-UI-009 | `src/lib/i18n.tsx` | Internationalization |
| ART-0092 | REQ-FE-UI-010 | `src/app/layout.tsx` | Toast notification system |
| ART-0093 | REQ-FE-UI-011 | `src/components/shared/confirm-dialog.tsx` | Confirmation dialog |
| ART-0094 | REQ-FE-UI-012 | `src/components/shared/empty-state.tsx` | Empty state component |
| ART-0095 | REQ-FE-UI-013 | `src/components/shared/loading-skeleton.tsx` | Loading skeleton components |
| ART-0096 | REQ-FE-UI-014 | `src/components/shared/stat-card.tsx` | Stat card component |
| ART-0097 | REQ-FE-UI-015 | `src/components/layout/app-shell.tsx` | Skill editor overlay |

### Model Profiles (3)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0098 | REQ-FE-MODEL-001 | `src/components/pages/model-profiles-page.tsx` | Model profile list |
| ART-0099 | REQ-FE-MODEL-002 | `src/components/pages/model-profiles-page.tsx` | Model profile CRUD |
| ART-0100 | REQ-FE-MODEL-003 | `src/components/pages/model-profiles-page.tsx` | Default model profile |

### Sandbox Profiles (3)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0101 | REQ-FE-SBPROFILE-001 | `src/components/pages/sandbox-profiles-page.tsx` | Sandbox profile list |
| ART-0102 | REQ-FE-SBPROFILE-002 | `src/components/pages/sandbox-profiles-page.tsx` | Sandbox profile CRUD |
| ART-0103 | REQ-FE-SBPROFILE-003 | `src/components/pages/sandbox-profiles-page.tsx` | Default sandbox profile |

### Operations (5)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0104 | REQ-FE-OPS-001 | `src/components/pages/ops-page.tsx` | Operations dashboard |
| ART-0105 | REQ-FE-OPS-002 | `src/components/pages/ops-page.tsx` | Audit log table |
| ART-0106 | REQ-FE-OPS-003 | `src/components/pages/ops-page.tsx` | Metrics display |
| ART-0107 | REQ-FE-OPS-004 | `src/components/pages/ops-page.tsx` | API token management |
| ART-0108 | REQ-FE-OPS-005 | `src/components/pages/ops-page.tsx` | Notifications management |

### Documentation (1)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0109 | REQ-FE-DOCS-001 | `src/components/pages/docs-page.tsx` | Documentation page |

### Engineering (5)

| ART | REQ | Path | Notes |
|--------|-----|------|-------|
| ART-0110 | REQ-FE-ENG-001 | `.github/workflows/ci.yml` | CI/CD pipeline |
| ART-0111 | REQ-FE-ENG-002 | `tsconfig.json` | TypeScript strict mode |
| ART-0112 | REQ-FE-ENG-003 | `Dockerfile` | Docker multi-stage build |
| ART-0113 | REQ-FE-ENG-004 | `next.config.ts`, `.env` | Environment variable config |
| ART-0114 | REQ-FE-ENG-005 | `eslint.config.mjs` | ESLint code quality |
