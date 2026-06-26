# Step 5.1：Skill canonical CRUD 工程化补齐

## 目标

在 Step 5 已验证 `list/get/delete` 的基础上，把 Skill canonical API 补齐为可继续承载业务迁移的标准 CRUD 样板。

本步骤强调工程化，而不是 demo：

```text
1. POST/PUT 真实写入数据库，不做 mock。
2. create 严格创建，name 冲突返回 409。
3. update 只更新已存在 skill，不存在返回 404。
4. 业务层统一接入 kit/access.Guard。
5. 权限错误返回 403，而不是 500。
6. created_at / updated_at 做 DB 级和代码级兜底，避免 protobuf zero time 泄漏。
7. 每次变更同步更新 docs/ACCEPTANCE_HANDOVER.md。
```

## 新增接口

```text
POST /v3/aihub/skills
PUT  /v3/aihub/skills/{name}
```

当前 Skill canonical API：

```text
POST   /v3/aihub/skills
PUT    /v3/aihub/skills/{name}
GET    /v3/aihub/skills
GET    /v3/aihub/skills/{name}
DELETE /v3/aihub/skills/{name}
```

## 权限模型

```text
POST /v3/aihub/skills
  resource = aihub:skill:*
  action   = skill.create

PUT /v3/aihub/skills/{name}
  resource = aihub:skill:<name>
  action   = skill.update

GET /v3/aihub/skills
  resource = aihub:skill:*
  action   = skill.list

GET /v3/aihub/skills/{name}
  resource = aihub:skill:<name>
  action   = skill.read

DELETE /v3/aihub/skills/{name}
  resource = aihub:skill:<name>
  action   = skill.delete
```

如果 Casdoor Permission 使用：

```text
resource = aihub:*
action   = *
```

则以上动作都会被放行。

## Casdoor Model 要求

Casdoor Permission 需要三段式 policy definition：

```ini
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = (g(r.sub, p.sub) || r.sub == p.sub) && keyMatch(r.obj, p.obj) && (r.act == p.act || p.act == "*")
```

不要写：

```ini
p = sub, obj, act, eft
```

否则 Casdoor Permission 会报：

```text
Casbin model's [policy_defination] section should have 3 elements
```

## 数据迁移

本步骤开始明确固定：**Hub 业务 repo 不运行 AutoMigrate**。

```text
1. DB 连接、连接池、事务上下文由 aisphere-kit/db 提供。
2. Hub data/repo 只做业务 CRUD，不打开 DB、不自动建表、不自动改表。
3. DDL / 索引 / 默认值 / 回填 / trigger 统一放到 migrations/postgres/*.sql。
```

新增幂等 migration：

```text
migrations/postgres/000003_harden_aihub_skills.sql
```

作用：

```text
1. 统一字段默认值。
2. 回填 created_at / updated_at。
3. 增加 updated_at 自动刷新 trigger。
```

执行方式示例：

```powershell
psql "host=<pg-host> port=<pg-port> user=<user> password=<password> dbname=aisphere_hub sslmode=disable" -f .\migrations\postgres\000002_create_aihub_skills.sql
psql "host=<pg-host> port=<pg-port> user=<user> password=<password> dbname=aisphere_hub sslmode=disable" -f .\migrations\postgres\000003_harden_aihub_skills.sql
```

若未执行 migration，Skill API 会返回明确错误：

```text
aihub_skills table is not ready; run migrations/postgres/000002_create_aihub_skills.sql and migrations/postgres/000003_harden_aihub_skills.sql
```

## 验收命令

### 1. Create

```powershell
$Hub = "http://127.0.0.1:18001"

$CreateBody = @{
  name = "demo-skill-2"
  display_name = "Demo Skill 2"
  description = "created from canonical API"
  version = "v0.1.0"
  status = "active"
  visibility = "private"
  owner_id = "admin"
  org_id = "aisphere"
  manifest_json = '{"schema":"v1"}'
  tags = @("demo", "api")
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method POST `
  -Uri "$Hub/v3/aihub/skills" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $AccessToken" } `
  -Body $CreateBody | ConvertTo-Json -Depth 10
```

重复执行 Create 应返回 409。

### 2. Update

```powershell
$UpdateBody = @{
  display_name = "Demo Skill 2 Updated"
  description = "updated from canonical API"
  version = "v0.1.1"
  status = "active"
  visibility = "private"
  owner_id = "admin"
  org_id = "aisphere"
  manifest_json = '{"schema":"v1","updated":true}'
  tags = @("demo", "api", "updated")
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method PUT `
  -Uri "$Hub/v3/aihub/skills/demo-skill-2" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $AccessToken" } `
  -Body $UpdateBody | ConvertTo-Json -Depth 10
```

### 3. List / Get / Delete

```powershell
Invoke-RestMethod -Method GET -Uri "$Hub/v3/aihub/skills" -Headers @{ Authorization = "Bearer $AccessToken" } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method GET -Uri "$Hub/v3/aihub/skills/demo-skill-2" -Headers @{ Authorization = "Bearer $AccessToken" } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method DELETE -Uri "$Hub/v3/aihub/skills/demo-skill-2" -Headers @{ Authorization = "Bearer $AccessToken" } | ConvertTo-Json -Depth 10
```

## 验收标准

```text
1. POST 创建成功。
2. 重复 POST 返回 409。
3. PUT 更新成功。
4. GET 返回更新后的字段。
5. DELETE 软删除成功。
6. 不带 token 返回 401。
7. authz=true 且无权限返回 403。
8. authz=true 且 Casdoor Permission 放行时 CRUD 全部成功。
9. create_time 不再出现 seconds=-62135596800。
```
