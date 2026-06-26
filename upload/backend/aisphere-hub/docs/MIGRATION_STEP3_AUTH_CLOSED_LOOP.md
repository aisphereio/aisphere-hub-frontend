# Step 3: Casdoor Auth Closed Loop

This project intentionally does **not** keep a local `aihub_tokens` table.
Hub authentication is Casdoor-native:

1. Hub redirects users to Casdoor.
2. Casdoor redirects back with `code` and `state`.
3. Hub exchanges `code` for Casdoor tokens.
4. Clients call Hub APIs with `Authorization: Bearer <access_token>`.
5. `aisphere-kit-kratos` validates the token and puts `principal.Principal` into context.

## Endpoints

- `GET /v3/auth/login` — browser-friendly 302 redirect to Casdoor.
- `GET /v3/auth/login-url` — JSON response with login URL.
- `POST /v3/auth/exchange` — exchange OAuth code for token.
- `POST /v3/auth/refresh` — refresh token.
- `GET /v3/auth/logout` — browser-friendly 302 redirect to Casdoor logout.
- `GET /v3/auth/logout-url` — JSON response with logout URL.
- `GET /v3/auth/me` — current principal, requires Bearer token.

## JSON field naming

The canonical request body uses snake_case, matching proto field names:

```json
{
  "code": "xxx",
  "redirect_uri": "http://localhost:3000/callback",
  "state": "dev"
}
```

For frontend convenience, `/v3/auth/exchange` also accepts camelCase:

```json
{
  "code": "xxx",
  "redirectUri": "http://localhost:3000/callback",
  "state": "dev"
}
```

`/v3/auth/refresh` accepts both `refresh_token` and `refreshToken`.

## Test flow

Open in browser:

```text
http://127.0.0.1:18001/v3/auth/login?redirect_uri=http://localhost:3000/callback&state=dev
```

After Casdoor redirects back:

```powershell
curl -X POST http://127.0.0.1:18001/v3/auth/exchange `
  -H "Content-Type: application/json" `
  -d "{\"code\":\"<code>\",\"redirect_uri\":\"http://localhost:3000/callback\",\"state\":\"dev\"}"
```

Then:

```powershell
curl http://127.0.0.1:18001/v3/auth/me `
  -H "Authorization: Bearer <access_token>"
```
