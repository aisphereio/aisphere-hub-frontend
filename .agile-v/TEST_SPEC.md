# Test Specification — Aisphere Hub Frontend

> Cycle: C1 | Generated: 2026-07-13 | Status: IN_PROGRESS
> Designed by: Test Designer

## 1. Overview

Total TCs: 20 (P0 priority)
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

## 3. Summary

| Dimension | Count |
|-----------|:-----:|
| Total TCs | 18 |
| Component tests | 18 |
| P0 priority | 18 |
| **Implemented** | **8** (TC-FE-001~008) |
| **Pending** | **10** (TC-FE-009~018) |
