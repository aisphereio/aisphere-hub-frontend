# Automated Traceability Matrix (ATM) — Aisphere Hub Frontend

> Cycle: C1 | Generated: 2026-07-13

## REQ → ART Coverage

| Domain | REQs | ART | Coverage |
|--------|:----:|:---:|:--------:|
| Authentication | 4 | 4 | 100% |
| IAM Management | 15 | 15 | 100% |
| Access Control | 6 | 5 | 83% |
| IAM Group Admin | 5 | 5 | 100% (API) |
| IAM Authz Admin | 9 | 9 | 100% (API) |
| IAM User Admin | 4 | 0 | 0% ❌ |
| Project Capabilities | 4 | 0 | 0% (UI pending) |
| Skills | 10 | 10 | 100% |
| SkillSets | 6 | 6 | 100% |
| Agents | 6 | 6 | 100% |
| Tools | 6 | 6 | 100% |
| Sandboxes | 6 | 6 | 100% |
| Namespaces | 4 | 4 | 100% |
| Governance | 6 | 6 | 100% |
| Layout & Navigation | 15 | 15 | 100% |
| Model Profiles | 3 | 3 | 100% |
| Sandbox Profiles | 3 | 3 | 100% |
| Operations | 5 | 5 | 100% |
| Documentation | 1 | 1 | 100% |
| Engineering | 5 | 5 | 100% |
| **Total** | **125** | **114** | **91%** |

## ART → Test Coverage

| Evidence Level | Count |
|:--------------:|:-----:|
| Test coverage | 0% |

## Dangling Artifacts

| Check | Result |
|-------|--------|
| ART without REQ | **0** ✅ |
| REQ without ART | **11** ❌ (User Admin 4 + Project Cap 4 + 3 OBSOLETE) |