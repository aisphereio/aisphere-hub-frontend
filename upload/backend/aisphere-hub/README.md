# aisphere-hub backend (kratos+kit)

This is the kratos+kit backend for aisphere-hub. It is being migrated from the
legacy Gin-based `backend/` repository; see `MIGRATION_AISPHERE_KIT.md` for
the migration plan and `AGENTS.md` for the layering contract.

## Stack

- **Web framework**: [Kratos v3](https://github.com/go-kratos/kratos) (HTTP first; gRPC ready to enable)
- **Runtime core**: [aisphere-kit](https://github.com/actionlab-ai/aisphere-kit) v0.1.1+ (Postgres + Redis + MinIO + Casdoor)
- **Kratos adapter**: [aisphere-kit-kratos](https://github.com/actionlab-ai/aisphere-kit-kratos) v0.1.0
- **Database**: PostgreSQL via GORM (`gorm.io/driver/postgres`, jackc/pgx under the hood)
- **Config**: kit schema YAML (`aisphere-kit/config.Config`)
- **API**: protobuf-first, generated via `buf generate`

## Project Layout

```text
api/                  Protobuf APIs and generated bindings (HTTP + gRPC + OpenAPI)
cmd/aispherehub/      Single entry point (~6 lines, delegates to kit-kratos starter)
configs/config.yaml   Single config file (kit schema, Postgres by default)
internal/app/         Composition root — wires biz/data/service into kratos.App
internal/biz/         Domain objects (DO) + repo interfaces + usecases
internal/data/        Repo implementations backed by kit Runtime
internal/service/     HTTP handlers + DTO↔DO conversion
```

## Development Commands

Install code generators (one-time):

```bash
make init
```

Generate Go bindings from `api/**/*.proto`:

```bash
make api
```

Build the binary:

```bash
make build
```

Run locally:

```bash
make run
```

Run tests:

```bash
make test
```

## Run Locally

```bash
make run
```

Default ports (from `configs/config.yaml`):

- HTTP: `0.0.0.0:8000`
- gRPC: `0.0.0.0:9000` (currently disabled; enable in `internal/app/app.go`)

Health endpoints (auto-registered by kit-kratos):

- `GET /livez`  — liveness probe (always 200 if process is up)
- `GET /readyz` — readiness probe (pings DB/Redis/MinIO/Casdoor; 503 if any unhealthy)
- `GET /v3/aihub/health` — application-level health snapshot (JSON)

## Adding a New Business Module

Follow the 5-step pattern documented in `AGENTS.md` and demonstrated by
`internal/biz/health.go` + `internal/data/health.go` + `internal/service/health.go`:

1. Write `api/<module>/v1/<module>.proto`, run `make api`.
2. Write `internal/biz/<module>.go` (DO + Repo interface + Usecase).
3. Write `internal/data/<module>.go` (Repo impl using `rt.DB` / `rt.Redis` / ...).
4. Write `internal/service/<module>.go` (HTTP handler + DTO↔DO conversion).
5. Wire it in `internal/app/app.go` (repo → uc → svc → `RegisterXxxHTTPServer`).

## Docker

```bash
docker build -t aisphere-hub .
docker run --rm -p 8000:8000 \
  -v $(pwd)/configs:/data/conf \
  aisphere-hub
```

## Migration Status

详见 `docs/HUB_BACKEND_MIGRATION_STATUS.md` 和 `docs/ACCEPTANCE_HANDOVER.md`。

- [x] **Kit/Kratos baseline** — Hub 已迁入 Kratos + aisphere-kit + aisphere-kit-kratos 分层。
- [x] **Casdoor AuthN** — `/v3/auth/login`、`exchange`、`refresh`、`me` 已跑通。
- [x] **Casdoor AuthZ** — `permission_id` 全局 RBAC 已用于真实 Skill API。
- [x] **Kit Access Guard** — Hub 业务模块统一使用 `access.Guard`。
- [x] **Kit Migration Runner** — Hub DDL 统一通过 `migrations/postgres/*.sql` 和 kit migration 执行。
- [x] **Skill canonical CRUD** — `POST/PUT/GET/DELETE /v3/aihub/skills` 已完成并验收。
- [x] **Skill dynamic sharing path** — Skill Share API 通过 kit 写入 Casdoor dynamic Enforcer policy，普通用户通过分享访问指定 Skill 已跑通。
- [ ] **Skill share list/delete hardening** — `GET /shares` 读回和 `DELETE /shares/{grant_id}` 撤销链路需继续验收/修复。
- [ ] **Skill version/file/package** — 版本、文件、上传、发布、审核、下载尚未迁移。
- [ ] **SkillSet / Tool / Agent / Workflow / Runtime / Sandbox** — 仍待逐步迁移。
- [ ] **Audit/Observability** — audit=true 后业务动作审计、metrics、tracing 还需补齐。
