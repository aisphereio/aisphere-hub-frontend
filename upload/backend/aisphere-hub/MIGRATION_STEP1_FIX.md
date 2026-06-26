# Step 1 Fix: canonical cmd and token wiring

This patch fixes the first migration feedback after `make api` and `go test ./...`.

## Decisions

- Canonical command directory: `cmd/aispherehub`
- Removed stale generated command directory: `cmd/aisphere-hub`
- Token module is now wired into `internal/app.AppDeps` and registered on the Kratos HTTP server.
- `internal/app/wire_gen.go` has been updated to include Token constructors.
- `buf.gen.yaml` now uses `strategy: all` for the OpenAPI plugin to avoid duplicate `openapi.yaml` warnings.

## Commands

```powershell
make api
make wire
go test ./...
go run ./cmd/aispherehub
```

## Why remove `cmd/aisphere-hub`?

The project had two entry points:

- `cmd/aisphere-hub`
- `cmd/aispherehub`

`cmd/aisphere-hub` still contained old Kratos/Wire code referencing `data.NewData` and `newApp`, so `go test ./...` failed even though the new app path was correct. Keeping one canonical command avoids future confusion.
