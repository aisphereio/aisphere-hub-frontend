# Step 5.0.1：接入 aisphere-kit Migration Runner

## 目标

把数据库 schema 迁移从 Hub 业务 repo 中移出，统一交给 `aisphere-kit/migration` 管理。

后续 Hub、Runtime、Sandbox、ModelGateway 等组件都遵循同一规则：

```text
aisphere-kit/db
  负责 DB 连接、连接池、健康检查、事务上下文

migrations/postgres/*.sql
  负责 DDL、索引、默认值、trigger、数据回填

业务 repo
  只做 CRUD，不允许 AutoMigrate，不允许启动时偷偷改表
```

## Hub 需要的配置

开发环境可以在 `configs/config.yaml` 加：

```yaml
migration:
  enabled: true
  auto_apply: true
  driver: postgres
  path: "./migrations/postgres"
  table: "schema_migrations"
  lock: true
  allow_dirty: false
  timeout: "30s"
```

生产环境建议：

```yaml
migration:
  enabled: true
  auto_apply: false
  driver: postgres
  path: "./migrations/postgres"
  table: "schema_migrations"
  lock: true
  allow_dirty: false
  timeout: "30s"
```

## 当前行为

`aisphere-kit` Runtime 会在 DB 初始化后创建 migration runner。

当：

```yaml
migration:
  enabled: true
  auto_apply: true
```

启动时会自动执行 pending migrations。任何 migration 失败都会阻止服务启动。

## 验收方式

1. 确认 Hub 使用 `aisphere-kit v1.5.0` 或本地 replace 到包含 migration runner 的 kit。
2. 在 `configs/config.yaml` 加 migration 配置。
3. 启动 Hub：

```powershell
go run ./cmd/aispherehub
```

预期日志包含：

```text
migration runner init started
migration auto apply started
migration apply completed
migration auto apply completed
```

4. 查询版本表：

```sql
SELECT version, name, dirty, error, applied_at
FROM schema_migrations
ORDER BY version;
```

## 失败处理

如果出现 dirty migration：

```text
migration dirty at version <n>
```

先人工确认该版本 SQL 是否部分执行，再手动修复表结构或清理 dirty 状态。不要直接打开 `allow_dirty=true` 跳过。

## 当前结论

Hub 不需要写额外 migration 代码；只需要配置 `migration` 段，并继续把 DDL 放到 `migrations/postgres/*.sql`。
