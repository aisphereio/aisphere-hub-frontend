# Step 4.3 AuthZ / Audit verification

## Goal

After AuthN is working, this step makes AuthZ and Audit verifiable without migrating a full business module yet.

It also fixes feature-flag semantics in `aisphere-kit`:

- `features.authz=false`: `access.Require(...)` requires principal but skips Casdoor Enforce.
- `features.authz=true`: `access.Require(...)` calls Casdoor Enforce and fails closed.
- `features.audit=false`: `access.Record(...)` is no-op.
- `features.audit=true`: `access.Record(...)` calls Casdoor AddRecord.

## Added / updated verification endpoints

All endpoints below require a valid Bearer token:

```text
GET  /v3/auth/access-status
GET  /v3/auth/check-admin
POST /v3/auth/audit-test
```

### `/v3/auth/access-status`

Returns current feature status as seen by `kit/access.Guard`:

```json
{
  "ok": true,
  "authz_enabled": false,
  "audit_enabled": false
}
```

### `/v3/auth/check-admin`

Checks:

```text
resource = aihub:admin
action   = admin.access
```

When `features.authz=false`, it should return success for an authenticated user and show `authz_enabled=false`.

When `features.authz=true`, it calls Casdoor Enforce. Missing policy should return 403. Matching policy should return success.

### `/v3/auth/audit-test`

Records an audit event:

```text
action   = auth.audit_test
resource = aihub:auth:session
```

When `features.audit=false`, it returns success with `recorded=false`.

When `features.audit=true`, it writes to Casdoor Record via `AddRecord` and returns `recorded=true` if no error occurs.

## PowerShell verification

```powershell
$Hub = "http://127.0.0.1:18001"

Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/access-status" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/check-admin" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod `
  -Method POST `
  -Uri "$Hub/v3/auth/audit-test" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

## Enable real AuthZ

In `configs/config.yaml`, set:

```yaml
features:
  authn: true
  authz: true
  audit: false

casdoor:
  permission_id: "aisphere/<your-permission-name>"
```

Then test `/v3/auth/check-admin`.

Expected behavior:

```text
No matching Casdoor policy -> 403
Matching Casdoor policy    -> 200
```

The policy subject must match the Hub principal subject. Hub currently uses:

```text
user:<casdoor user name>
```

For admin, that is usually:

```text
user:admin
```

The policy object/action for this verification endpoint are:

```text
obj = aihub:admin
act = admin.access
```

## Enable real Audit

In `configs/config.yaml`, set:

```yaml
features:
  authn: true
  audit: true
```

Then call:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "$Hub/v3/auth/audit-test" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

Check Casdoor Record / Audit logs for an event with:

```text
action = auth.audit_test
```

## Acceptance

- AuthN remains working: `/v3/auth/me` returns current user.
- With `authz=false`, `/v3/auth/check-admin` succeeds and returns `authz_enabled=false`.
- With `authz=true` and no policy, `/v3/auth/check-admin` returns 403.
- With `authz=true` and policy, `/v3/auth/check-admin` returns success.
- With `audit=false`, `/v3/auth/audit-test` succeeds and returns `recorded=false`.
- With `audit=true`, `/v3/auth/audit-test` succeeds and Casdoor has a Record.
