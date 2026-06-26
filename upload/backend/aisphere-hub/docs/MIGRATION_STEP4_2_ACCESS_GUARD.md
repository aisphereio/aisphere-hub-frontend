# Step 4.2 — Move Access Guard to aisphere-kit

This step removes Hub-local access wrappers and standardizes authorization/audit usage through `github.com/actionlab-ai/aisphere-kit/access`.

## Why

Every component needs the same pattern:

1. read principal from context,
2. check authz through Casdoor/Casbin,
3. write audit record.

Keeping that pattern inside every service duplicates code and increases the chance of inconsistent deny/audit behavior.

## Kit change

`aisphere-kit v0.1.3` adds:

```go
rt.Access.Require(ctx, access.Check{Resource: "aihub:admin", Action: "admin.access"})
rt.Access.Record(ctx, access.Event{Action: "auth.me", Resource: "aihub:auth:session"})
```

## Hub change

Removed:

```text
internal/biz/access.go
```

Replaced `internal/data/access.go` with a thin provider:

```go
func NewAccessGuard(data *Data) *access.Guard
```

`AuthUsecase` now depends directly on `*access.Guard`.

## Verification endpoints

These endpoints are for development verification and are not included in authn skip list.

```text
GET  /v3/auth/me           verifies authn
GET  /v3/auth/check-admin  verifies authz: aihub:admin admin.access
POST /v3/auth/audit-test   verifies audit recorder
```

## Verification commands

```powershell
$Hub = "http://127.0.0.1:18001"
$AccessToken = $TokenResp.access_token

Invoke-RestMethod -Method GET -Uri "$Hub/v3/auth/me" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod -Method GET -Uri "$Hub/v3/auth/check-admin" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod -Method POST -Uri "$Hub/v3/auth/audit-test" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

`/v3/auth/check-admin` is now feature-flag aware. With `features.authz=false`, it requires a valid principal but skips Casdoor Enforce and returns `authz_enabled=false`. With `features.authz=true`, it calls Casdoor/Casbin and requires a matching policy.
