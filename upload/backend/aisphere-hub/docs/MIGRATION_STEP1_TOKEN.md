# Step 1: migrate token module from legacy backend

Decision snapshot:

- DB access layer: GORM structured PostgreSQL table.
- `_system` namespace: removed; token is no longer stored as `_system/token` document.
- canonical vs admin: token remains a small admin surface under the old path.
- route path: keep `/v3/admin/iam/tokens`.
- PG/Redis: kit runtime is the source of infrastructure connections.
- first migrated module: token.

## Commands

After applying these files:

```bash
make api
make wire
go mod tidy
go test ./...
go run ./cmd/aispherehub
```

If `make api` is unavailable, the equivalent Kratos/buf path is:

```bash
buf dep update
buf generate --template buf.gen.yaml
```

Then regenerate Wire:

```bash
go run github.com/google/wire/cmd/wire ./internal/app/
```

## Manual PostgreSQL bootstrap

Until the migration runner is introduced, apply:

```bash
psql "$AISPHERE_DATABASE_DSN" -f migrations/postgres/000001_create_aihub_tokens.sql
```

or let GORM AutoMigrate be added in the next small step. The current patch keeps migration explicit.

## API compatibility

Legacy Gin routes:

- `GET /v3/admin/iam/tokens?subjectId=...`
- `POST /v3/admin/iam/tokens`
- `DELETE /v3/admin/iam/tokens/:keyId`

New Kratos proto annotations preserve:

- `GET /v3/admin/iam/tokens?subject_id=...`
- `POST /v3/admin/iam/tokens`
- `DELETE /v3/admin/iam/tokens/{key_id}`

JSON names remain camelCase through proto JSON mapping: `subjectId`, `keyId`, `expiresAt`.

## Not included in this step

- Token auth provider replacing legacy `dbapikey` middleware.
- Audit writing for token create/delete.
- Admin permission enforcement for token routes.

Those are Step 2 after this module compiles and the table is reachable.
