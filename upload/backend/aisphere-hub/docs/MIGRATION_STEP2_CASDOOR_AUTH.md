# Step 2: Casdoor-native Hub authentication

Decision:

- Hub does **not** keep a local token table.
- Hub does **not** implement a DB Token Authenticator.
- Casdoor is the single authentication authority.
- Casdoor + Casbin are the single authorization/policy authority.
- Hub only exposes small convenience endpoints and consumes Casdoor access tokens.

## New API

```text
GET /v3/auth/login?redirect_uri=...&state=...&scope=...
GET /v3/auth/logout?post_logout_redirect_uri=...
GET /v3/auth/me
```

`/v3/auth/login` and `/v3/auth/logout` are public. They only build Casdoor URLs.
`/v3/auth/me` requires `Authorization: Bearer <casdoor_access_token>`.

## Removed

The previous token scaffold has been removed:

```text
api/token/v1/*
internal/biz/token.go
internal/data/token.go
internal/service/token.go
migrations/postgres/000001_create_aihub_tokens.sql
```

## Enable Casdoor

Fill `casdoor.*` values and set:

```yaml
features:
  authn: true
  authz: true
  audit: true
  permission: true
```

You can use `configs/config.casdoor.example.yaml` as an overlay.

## Auth flow

Browser / console:

```text
frontend -> GET /v3/auth/login -> Casdoor login URL
frontend redirects browser to Casdoor
Casdoor returns code to frontend callback
frontend exchanges code via Casdoor SDK/API
frontend calls Hub with Authorization: Bearer <access_token>
Hub kit-kratos authn middleware parses token through rt.Authn/Casdoor
Hub service gets principal from context
```

Service-to-service:

```text
service uses Casdoor application credentials to get an access token
service calls Hub with Authorization: Bearer <access_token>
Hub verifies through Casdoor adapter
```

## Notes

- Middleware authn skips only health, login, and logout.
- Fine-grained authz should be done in service/usecase through `authz.Require` until each module has a stable resolver.
- Audit middleware is enabled when `features.audit=true` and records request-level events through Casdoor Record.
