# API Layer

The frontend talks **directly** to the Hub backend (no Next.js rewrites). This
directory holds both the hand-written client and the orval-generated client.

For the deep version see `openwiki/operations/api-layer.md`; this README is the
code-adjacent quick reference.

## Layout

```
src/lib/api/
├── client.ts        # Hand-written core: request<T>(), auth, URL building
├── index.ts         # Public API modules (authApi, skillApi, authzApi, …) — import from here
├── types.ts         # Domain types (Skill, SkillSet, IamPrincipal, …)
├── hub-fetch.ts     # Fetch mutator for the orval-generated client
├── adapters/        # Generated RPCs → module shape + proto→domain normalization
└── generated/       # orval output (DO NOT hand-edit; regenerate)
```

## Two paths

| Path | Modules | Transport | Body Content-Type |
|------|---------|-----------|-------------------|
| Generated | Migrated: `authApi`, `authzApi`, `skillApi`, `sharesApi`, `auditApi` | `hubFetch` (mutator) | `application/protojson` (forced) |
| Hand-written | Not-yet-migrated: `agentApi`, `toolApi`, `iamApi`, `sandboxApi`, … | `request<T>()` in `client.ts` | `application/json` (auto-set) |

Migrated modules are implemented in `adapters/` (e.g. `skillApi.draft` calls the
generated `skillServiceCreateSkill` and maps the result via `toSkill`).
Consumers keep importing from `index.ts` — the adapter swap is invisible.

## Regenerating the generated client

The `generated/` tree is produced by orval from the backend OpenAPI spec.

```bash
# 1. Sync the spec / contract lock from the backend
node scripts/sync-contract.mjs
node scripts/verify-contract-lock.mjs

# 2. Regenerate
npx orval --config orval.config.ts
```

- `orval.config.ts` registers `hubFetch` (`./hub-fetch.ts`) as the fetch mutator,
  so every generated RPC routes through our auth + error handling.
- `unsafeDisableValidation: true` is required because proto map fields emitted
  as `type: object` query params fail orval's Swagger 2.0 validator.
- Never hand-edit `generated/`. Regenerate instead.

## Request body encoding — read this before changing `hub-fetch.ts`

The Hub backend (kernel `transportx/http`) selects the JSON codec by the
request `Content-Type`:

- `application/json` → stdlib `encoding/json`, honors **only** snake_case
  struct tags on `*.pb.go` types (`json:"org_id,omitempty"`). A camelCase body
  like `{"orgId":"aisphere"}` decodes to an **empty** field → `ORG_ID_REQUIRED`.
- `application/protojson` → `google.golang.org/protobuf/encoding/protojson`,
  accepts **both** camelCase and snake_case (proto JSON spec).

orval-generated request types are camelCase (`orgId`, `projectId`,
`displayName`), so the generated path **must** send `application/protojson`.
`hubFetch` therefore **overrides** (not just defaults) the Content-Type for any
request with a body — orval's generated functions hardcode
`Content-Type: application/json`, which would otherwise win and silently drop
every camelCased field.

Rules:

- Do **not** remove the protojson override for request bodies.
- Responses are regular JSON (backend encodes with protojson, still valid JSON);
  `JSON.parse` in both `request<T>()` and `hubFetch` is unchanged.
- If a future endpoint genuinely needs `application/json`, pass it explicitly
  per-call AND confirm the backend struct tags match the field names you send.
- The contract also breaks if someone adds a hand-written backend HTTP handler
  that decodes with `encoding/json` while expecting camelCase — flag it in review.

## Auth model (both paths)

- `gateway_oidc` mode: session cookies via Envoy; `X-Requested-With:
  XMLHttpRequest` is set so the gateway returns JSON instead of a login redirect.
  On 401, throw without clearing anything (the SPA itself is behind OIDC).
- `token` mode (legacy): `Authorization: Bearer <token>` from localStorage; on
  401, clear the token.

`hubFetch` mirrors `request<T>()`'s auth + 401 handling and additionally parses
the Kernel error envelope into a structured `HubApiError` (code, requestId,
traceId, decisionId, metadata, plus `isAuthFailure` / `isPermissionDenied` /
`isValidationError` / `isServerError` getters).
