# Step 5.2: Skill version and file read APIs

This step migrates the first read-only part of the legacy Skill package model
into the new Kratos + kit Hub layering.

## Added APIs

```text
GET /v3/aihub/skills/{name}/versions
GET /v3/aihub/skills/{name}/versions/{version}
GET /v3/aihub/skills/{name}/versions/{version}/files
GET /v3/aihub/skills/{name}/versions/{version}/file?path=SKILL.md
```

These APIs are implemented in the canonical `SkillService` rather than the old
Gin compatibility routes.

## Storage

New migration:

```text
migrations/postgres/000004_create_aihub_skill_versions_files.sql
```

New tables:

```text
aihub_skill_versions
aihub_skill_files
```

`aihub_skill_versions` stores version metadata such as status, author, commit
message, md5, sha256, revision, size, manifest JSON, and timestamps.

`aihub_skill_files` stores per-version files, including `SKILL.md` and resource
files. File list responses omit content; single-file reads return content.

## Authorization

The usecase uses the same `access.Guard` path as Skill CRUD and Share:

```text
skill.version.list
skill.version.read
skill.file.list
skill.file.read
```

These actions already match the role expansion in `aisphere-kit/permission`.

## Compatibility

If no structured version rows exist yet but the canonical `aihub_skills.version`
field is populated, `ListSkillVersions` and `GetSkillVersion` return a synthetic
version backed by the Skill row. File APIs require `aihub_skill_files` rows.

## Not included yet

```text
Skill package upload
ZIP parse
ObjectStore/S3 persistence
Download archive endpoint
Draft/submit/review/publish/online/offline flow
Skill compare
SkillSet
```
