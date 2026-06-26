# Migration Step 5.4: Skill Runtime Consumption

## Scope

This step keeps the new canonical API design and does not add legacy route
compatibility. It completes the minimal lifecycle and runtime-consumption path
needed after package upload.

## Lifecycle

Implemented state transitions:

```text
draft -> submitted -> published -> online -> offline
```

Implemented APIs:

```http
POST /v3/aihub/skills/{name}/versions/{version}:submit
POST /v3/aihub/skills/{name}/versions/{version}:publish
POST /v3/aihub/skills/{name}/versions/{version}:force-publish
POST /v3/aihub/skills/{name}/versions/{version}:online
POST /v3/aihub/skills/{name}/versions/{version}:offline
```

Rules:

- `submit` only accepts `draft`.
- `publish` only accepts `submitted`.
- `force-publish` can publish `draft`, `submitted`, `published`, or `offline`.
- `online` only accepts `published`.
- `offline` only accepts `online`.
- Only one version is kept `online` for a skill; previously online versions are
  demoted back to `published`.

## Runtime Consumption

Implemented APIs:

```http
GET /v3/aihub/skills/{name}/versions/{version}/download
GET /v3/aihub/catalog/skills/{name}/manifest
GET /v3/aihub/catalog/skills/{name}/versions/{version}/download
```

Runtime-facing behavior:

- Manifest resolves the current `online` version only.
- Catalog download rejects non-`online` versions.
- Download responses include `etag`, `md5`, and `sha256`.
- Requests can pass `if_none_match`; matching ETags return `not_modified=true`
  without package bytes.
- Package bytes are loaded from kit `objectstore.Client` when `rt.S3` and the
  stored object key are available.
- Local/dev fallback rebuilds a zip from DB file rows when objectstore is not
  configured.

## Kit Reuse

`aisphere-kit/permission` default Skill role mapping now includes lifecycle and
download actions:

- `skill.submit`
- `skill.publish`
- `skill.force_publish`
- `skill.online`
- `skill.offline`
- `skill.download`

Hub still does not construct storage or Casdoor clients directly.
