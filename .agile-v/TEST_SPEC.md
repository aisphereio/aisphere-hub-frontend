# Test Specification — Aisphere Hub Frontend

> Cycle: C1 | Updated: 2026-07-24 | Status: IN_PROGRESS
> Designed by: Test Designer

## 1. Overview

Total TCs: 22 (P0 priority)
Framework: vitest + @testing-library/react + happy-dom

## 2. Test Cases

### Wave 1 — Group Admin

| TC-ID | REQ-ID | Description | Expected | Type | Steps |
|-------|--------|-------------|----------|------|-------|
| TC-FE-001 | REQ-FE-GROUP-001 | Group list renders groups from API | Table shows group name, displayName, type, members count | component | 1. Mock `useIamDirectoryGroups` to return 2 groups. 2. Render `GroupsTab`. 3. Verify 2 rows in table. |
| TC-FE-002 | REQ-FE-GROUP-001 | Group list shows loading skeleton | Skeleton placeholders shown while loading | component | 1. Mock `useIamDirectoryGroups` to return loading state. 2. Render `GroupsTab`. 3. Verify skeleton elements. |
| TC-FE-003 | REQ-FE-GROUP-001 | Group list shows empty state | "No groups found" message when no data | component | 1. Mock `useIamDirectoryGroups` to return empty array. 2. Render `GroupsTab`. 3. Verify empty message. |
| TC-FE-004 | REQ-FE-GROUP-001 | Group search filters by name | Table filters in real-time as user types | component | 1. Mock 3 groups. 2. Render `GroupsTab`. 3. Type in search. 4. Verify only matching group shown. |
| TC-FE-005 | REQ-FE-GROUP-002 | Create dialog validates name format | Shows validation hint for invalid name | component | 1. Click "Create Group". 2. Type invalid name. 3. Verify validation hint. |
| TC-FE-006 | REQ-FE-GROUP-002 | Create group submits correct API | Calls `useIamCreateGroup` with correct params | component | 1. Fill form. 2. Click Create. 3. Verify mutation called with `{ orgId, group: { name, displayName, type } }`. |
| TC-FE-007 | REQ-FE-GROUP-004 | Delete group shows confirmation | Confirmation dialog appears before delete | component | 1. Click delete icon. 2. Verify dialog shows. 3. Confirm calls delete API. |
| TC-FE-008 | REQ-FE-GROUP-005 | Add member calls assign API | Calls `useIamAssignUserToGroup` with correct params | component | 1. Click group row. 2. Type user ID. 3. Click Add. 4. Verify mutation called. |

### Wave 2 — Authz Admin

| TC-ID | REQ-ID | Description | Expected | Type | Steps |
|-------|--------|-------------|----------|------|-------|
| TC-FE-009 | REQ-FE-AUTHZADMIN-001 | Schema viewer renders schema text | Displays schema text in pre block with version badge | component | 1. Mock `useIamAuthzSchema`. 2. Render `SchemaTab`. 3. Verify schema text and version. |
| TC-FE-010 | REQ-FE-AUTHZADMIN-002 | Schema validate calls API | Calls `useIamAuthzValidateSchema` with schema text | component | 1. Click Edit. 2. Modify text. 3. Click Validate. 4. Verify mutation called. |
| TC-FE-011 | REQ-FE-AUTHZADMIN-003 | Schema publish calls API | Calls `useIamAuthzPublishSchema` after validation | component | 1. Edit schema. 2. Click Publish. 3. Verify mutation called. |
| TC-FE-012 | REQ-FE-AUTHZADMIN-004 | Relationship list renders with filters | Table shows relationships matching filter | component | 1. Mock `useIamAuthzRelationships`. 2. Render `RelationshipsTab`. 3. Verify table rows. |
| TC-FE-013 | REQ-FE-AUTHZADMIN-005 | Write relationship dialog submits | Calls `useIamAuthzWriteRelationships` with correct data | component | 1. Click Write. 2. Fill form. 3. Submit. 4. Verify mutation. |
| TC-FE-014 | REQ-FE-AUTHZADMIN-006 | Delete relationship calls API | Calls `useIamAuthzDeleteRelationships` with correct filter | component | 1. Click delete icon. 2. Verify mutation called. |
| TC-FE-015 | REQ-FE-AUTHZADMIN-007 | Permission check shows result | Shows ALLOWED/DENIED after check | component | 1. Fill form. 2. Click Check. 3. Verify result display. |
| TC-FE-016 | REQ-FE-AUTHZADMIN-008 | Permission explain shows steps | Shows explanation steps after explain | component | 1. Fill form. 2. Click Explain. 3. Verify steps display. |
| TC-FE-017 | REQ-FE-AUTHZADMIN-009 | Effective permissions renders | Shows permission table | component | 1. Fill form. 2. Submit. 3. Verify table renders. |
| TC-FE-018 | REQ-FE-SKILL-002 | Skill create requires Principal Zone and selected Project | Submit stays disabled without either value and sends both values when complete | component | 1. Mock Principal and Project list. 2. Render create dialog. 3. Select Project. 4. Verify create mutation receives `orgId` and `projectId`. |

### Wave 3 — Git-native Skill Versions

| TC-ID | REQ-ID | Description | Expected | Type | Steps |
|-------|--------|-------------|----------|------|-------|
| TC-FE-019 | REQ-FE-SKILL-005 | Publish derives expected SHA from selected branch | Create mutation receives `sourceRef` and current server-provided `expectedCommitSha`; no manual SHA input exists; stale HEAD prompts refresh | component | 1. Mock refs with default branch HEAD. 2. Enter SemVer. 3. Publish and verify exact request. 4. Return `SKILL_RELEASE_STALE` and verify refresh guidance. |
| TC-FE-020 | REQ-FE-SKILL-005 | Release provenance and integrity render | Release card shows notes, publisher, commit, tree, manifest hash and publication time | component | 1. Mock a complete release. 2. Open Versions tab. 3. Verify metadata. |
| TC-FE-021 | REQ-FE-SKILLSET-004 | Adding a member requires an exact Release | Add is disabled without a release and bind sends `{ skillName, version }` after selection | component | 1. Mock available Skills and releases. 2. Select Skill. 3. Select release. 4. Verify bind request. |
| TC-FE-022 | REQ-FE-SKILLSET-006 | Lock snapshot validation renders resolved payload | Resolve action shows revision and exact member hashes | component | 1. Mock resolved SkillSet lock. 2. Click validate. 3. Verify success state and JSON payload. |

## 3. Summary

| Dimension | Count |
|-----------|:-----:|
| Total TCs | 22 |
| Component tests | 22 |
| P0 priority | 22 |
| **Implemented** | **10** (TC-FE-001~008, TC-FE-019~020) |
| **Pending** | **12** (TC-FE-009~018, TC-FE-021~022) |
