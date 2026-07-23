# Hub OpenAPI contract and generated SDK

The Hub frontend does not hand-write backend request or response types.

The source of truth is the protobuf contract in `aisphereio/aisphere-hub`:

1. Hub generates `docs/openapi/aisphere-hub.swagger.json` and `dist/api-contract/contract-lock.json`.
2. Frontend runs `npm run contract:sync -- --ref <hub-ref>`.
3. The sync script verifies the lock SHA-256.
4. Orval generates `src/lib/api/generated`.
5. UI adapters may only depend on generated functions and models.

For Skill release development use:

```bash
npm run contract:sync -- --ref feat/skill-release-control-plane
npm run typecheck
npm run test
```

Do not add direct `fetch('/v1/...')` calls for release APIs and do not duplicate protobuf DTOs in UI code.
