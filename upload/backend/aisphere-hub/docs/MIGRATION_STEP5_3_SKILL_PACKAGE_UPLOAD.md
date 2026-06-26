# Migration Step 5.3: Skill Package Upload

## Scope

This step migrates the first Skill package import path from the legacy Hub into
the new Kratos + kit Hub layering.

Implemented API:

```http
POST /v3/aihub/skills:upload
```

Proto request:

```proto
message UploadSkillPackageRequest {
  bytes package_bytes = 1;
  bool overwrite = 2;
  string target_version = 3;
  string commit_msg = 4;
}
```

## Behavior

- Validates `skill.upload` through `access.Guard`.
- Parses a zipped Skill package with `SKILL.md` frontmatter.
- Requires `name`, `description`, and non-empty `SKILL.md` body.
- Uses frontmatter `version`, request `target_version`, or `0.0.1`.
- Creates or updates the canonical `aihub_skills` row.
- Creates one draft `aihub_skill_versions` row.
- Stores `SKILL.md` and package resources in `aihub_skill_files`.
- Stores the original zip package and version files through kit
  `objectstore.Client` when `rt.S3` is enabled.
- Rejects duplicate `(skill_name, version)` unless `overwrite=true`.
- Records audit through the Hub access event path.

## Notes

- The initial upload API uses proto `bytes package_bytes`; browser multipart
  compatibility can be added as an HTTP adapter without changing the biz/data
  layer.
- Objectstore persistence goes through `aisphere-kit/objectstore` only. Hub does
  not construct MinIO/S3 SDK clients directly.
- File contents are still retained in `aihub_skill_files` as text or base64 for
  the current read APIs. A later step can switch reads to objectstore keys after
  the download API contract is finalized.
- Batch upload remains legacy-only and should be migrated after the single
  package path is accepted.

## Verification

```powershell
make api
make wire
go test ./...
```
