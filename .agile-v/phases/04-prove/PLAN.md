# Phase 04-Prove — Plan

## Objective
Design and implement test cases for all 125 REQs. Test Designer reads only REQUIREMENTS.md (not implementation) to avoid success bias.

## Method
1. Read REQUIREMENTS.md — extract verification criteria from each REQ
2. Design TC-XXXX for each REQ with: description, expected behavior, type, steps
3. Implement tests using vitest + testing-library
4. Update TEST_SPEC.md with all TC entries

## Test Types
- **unit** — pure function/utility tests
- **component** — React component render/interaction tests
- **hook** — React Query hook tests
- **integration** — multi-component flow tests

## Scope
Focus on the 14 newly implemented REQs from Phase 03:

### Wave 1 — Group Admin (5 REQs → 8 TCs)
| TC | REQ | Description | Type |
|----|-----|-------------|------|
| TC-FE-001 | REQ-FE-GROUP-001 | Group list renders with data | component |
| TC-FE-002 | REQ-FE-GROUP-001 | Group list loading state | component |
| TC-FE-003 | REQ-FE-GROUP-001 | Group list empty state | component |
| TC-FE-004 | REQ-FE-GROUP-001 | Group search filters | component |
| TC-FE-005 | REQ-FE-GROUP-002 | Group create dialog validation | component |
| TC-FE-006 | REQ-FE-GROUP-002 | Group create submit | component |
| TC-FE-007 | REQ-FE-GROUP-004 | Group delete confirmation | component |
| TC-FE-008 | REQ-FE-GROUP-005 | Group member add/remove | component |

### Wave 2 — Authz Admin (9 REQs → 12 TC-FE)
| TC | REQ | Description | Type |
|----|-----|-------------|------|
| TC-FE-009 | REQ-FE-AUTHZADMIN-001 | Schema viewer renders | component |
| TC-FE-010 | REQ-FE-AUTHZADMIN-002 | Schema validate | component |
| TC-FE-011 | REQ-FE-AUTHZADMIN-003 | Schema publish | component |
| TC-FE-012 | REQ-FE-AUTHZADMIN-004 | Relationship list with filters | component |
| TC-FE-013 | REQ-FE-AUTHZADMIN-005 | Relationship write dialog | component |
| TC-FE-014 | REQ-FE-AUTHZADMIN-006 | Relationship delete | component |
| TC-FE-015 | REQ-FE-AUTHZADMIN-007 | Permission check form | component |
| TC-FE-016 | REQ-FE-AUTHZADMIN-008 | Permission explain | component |
| TC-FE-017 | REQ-FE-AUTHZADMIN-009 | Effective permissions | component |

## Deliverables
- TEST_SPEC.md with all TC records
- Test files in src/__tests__/
- Phase 04 SUMMARY.md