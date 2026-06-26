# Step 5：Skill canonical 最小闭环迁移

## 目标

把旧 backend 中的 Skill 概念迁入新的 `aisphere-hub` Kratos + kit 架构。第一版只迁 canonical read/delete 最小闭环，用于验证真实业务接口中的：

```text
proto -> service -> biz -> data -> GORM PG structured table
      -> kit-kratos authn middleware
      -> kit/access.Guard Require / Record
```

## 本次新增接口

```text
GET    /v3/aihub/skills
GET    /v3/aihub/skills/{name}
DELETE /v3/aihub/skills/{name}
```

本次不迁：upload、publish、version、proposal、review、share、namespace、旧 admin skill API。

## 新增文件

```text
api/skill/v1/skill.proto
internal/biz/skill.go
internal/data/skill.go
internal/service/skill.go
migrations/postgres/000002_create_aihub_skills.sql
```

修改：

```text
internal/app/app.go
internal/app/wire.go
internal/app/wire_gen.go
internal/biz/biz.go
internal/data/data.go
internal/service/service.go
docs/ACCEPTANCE_HANDOVER.md
```

## 数据表

```text
aihub_skills
```

表结构统一通过 `migrations/postgres/*.sql` 维护。Hub data/repo 不运行 GORM AutoMigrate，也不在业务启动时自动改表。

## 权限模型

```text
List:   resource=aihub:skill:*           action=skill.list
Get:    resource=aihub:skill:<name>      action=skill.read
Delete: resource=aihub:skill:<name>      action=skill.delete
```

`features.authz=false` 时，`access.Require` 只要求 principal 存在，不调用 Casdoor Enforce。  
`features.authz=true` 时，`access.Require` 会调用 Casdoor/Casbin。

## 审计模型

```text
skill.list
skill.read
skill.delete
```

`features.audit=false` 时不写审计。  
`features.audit=true` 时通过 kit/access.Guard 写入 audit recorder。

## 验收命令

先确保已通过 authn 获取 `$AccessToken`。

插入测试数据：

```sql
INSERT INTO aihub_skills (
  name, display_name, description, version, status, visibility, owner_id, org_id, manifest_json, tags
) VALUES (
  'demo-skill',
  'Demo Skill',
  'first migrated skill',
  'v0.1.0',
  'active',
  'private',
  'admin',
  'aisphere',
  '{"schema":"v1"}'::jsonb,
  '["demo","migration"]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET deleted_at = NULL, updated_at = now();
```

PowerShell：

```powershell
$Hub = "http://127.0.0.1:18001"

Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/aihub/skills" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/aihub/skills/demo-skill" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod `
  -Method DELETE `
  -Uri "$Hub/v3/aihub/skills/demo-skill" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

## 验收标准

```text
1. 不带 token：401。
2. 带 token 且 authz=false：list/get/delete 能走通。
3. DELETE 后 deleted_at 有值。
4. audit=false 时不会写审计。
5. 后续打开 authz=true 后，没有策略应 403，有策略应放行。
6. 后续打开 audit=true 后，skill.delete 应能写入审计后端。
```

## 说明：停止使用手写 AuthZ/Audit 测试路由

从本步骤开始，不再依赖手写的 authz/audit debug 路由作为主验收路径。authz/audit 应该通过真实的 Kratos 生成式业务 API 验证，本轮从 SkillService 开始。

## 下一步

```text
1. 基于真实 Skill API 验证 authz=true 的 Casdoor Permission / Casbin 策略。
2. 基于真实 Skill DELETE 验证 audit=true 的审计写入。
3. 继续迁 Skill create/update/import/publish/version 流程。
```
