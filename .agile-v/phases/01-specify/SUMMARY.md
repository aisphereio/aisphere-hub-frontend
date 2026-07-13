# Phase 01-Specify — Summary

## Completed
- System understanding documented (`understanding/system_overview.md`)
- 127 candidate requirements recovered across 20 domains
- Implementation traceability matrix built
- Gaps identified vs IAM backend capabilities

## Key Findings
- 127 REQs: 78 P0, 33 P1, 8 P2, 8 ARCHITECTURE_REQUIRED
- **18 CONTRACT_ONLY** — backend API exists but no frontend UI (Group Admin 5, Authz Admin 9, User Admin 1, Project Cap 3)
- **4 ARCHITECTURE_REQUIRED** — frontend needs migration from legacy v3 API to new IAM v1 API
- **4 PARTIAL** — API calls defined but no UI components
- **Critical issue**: frontend `iamPermissionApi` calls INTERNAL endpoints that Envoy Gateway will block
- 0% test coverage

### Missing Frontend Features (vs Backend)
1. Group CRUD + membership management (5 RPCs)
2. Authz schema viewer/validate/publish (3 RPCs)
3. Relationship list/write/delete (3 RPCs)
4. Permission check/explain/effective (3 RPCs)
5. User admin migration from v3 to v1 API (4 RPCs)
6. Project update/archive/capability management (4 RPCs)

## Gate 0 Prerequisites
- [x] System understanding documented
- [x] All pages and hooks inventoried
- [x] Requirements cover all observed behavior
- [x] Gaps identified vs backend capabilities