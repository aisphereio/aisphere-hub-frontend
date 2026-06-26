# AI Sphere Hub 技术验收与交接文档

> 文档定位：这是 `aisphere-hub + aisphere-kit + aisphere-kit-kratos` 的持续交接文档。后续每完成一个功能点，都必须把「完成内容、涉及文件、配置变更、验收命令、风险/遗留问题、下一步」追加到本文档中。  
> 当前基线：Hub Authn 已跑通，Access Guard 已下沉到 kit，准备进入第一个真实业务模块迁移阶段。

---

## 1. 当前工程边界

### 1.1 三个包的职责

```text
aisphere-kit
  公共基础能力包：
  config / db / redis / objectstore / casdoor / authn / authz / audit / permission / access / runtime

aisphere-kit-kratos
  Kratos 适配层：
  server / middleware / starter / lifecycle / error mapping / authn skip

aisphere-hub
  Hub 业务承载项目：
  auth API / 后续 skill、agent、workflow、sandbox 等业务 API
```

### 1.2 重要原则

```text
1. Hub 不再维护本地 token 表。
2. 用户登录、token 签发、JWT 验证、用户角色来源统一走 Casdoor。
3. 业务权限判断统一走 kit/access.Guard。
4. authn 由 kit-kratos middleware 解析 Bearer token 并写入 principal。
5. authz / audit 不再每个模块重复封装，业务直接用 access.Guard。
6. 旧 backend 只作为业务参考，不整体搬迁旧结构。
7. 新业务模块优先使用 Kratos proto + GORM 结构化表。
8. `_system namespace` 和旧 JSONB document store 不再作为新设计核心。
```

---

## 2. 已完成里程碑

## Step 0：工程迁移方向确认

### 完成内容

```text
1. backend 是旧业务参考源。
2. aisphere-hub 是新的 Kratos + kit 业务承载项目。
3. aisphere-kit / aisphere-kit-kratos 是公共能力包。
4. 不做历史兼容式大搬迁，采用模块级逐步迁移。
```

### 验收标准

```text
新的 Hub 项目可以独立启动；
后续业务模块通过 proto/service/biz/data 分层迁入；
公共能力不直接散落在业务模块中。
```

---

## Step 1：取消 Hub 本地 token 方向

### 完成内容

最早做过 Hub 本地 token 表设计，但随后被废弃。最终结论：

```text
Hub 不负责签发本地 API token。
Casdoor 是认证权威源。
Hub 只消费 Casdoor access_token。
```

### 删除/不再维护的内容

```text
api/token/v1/*
internal/biz/token.go
internal/data/token.go
internal/service/token.go
migrations/postgres/000001_create_aihub_tokens.sql
```

### 验收标准

```powershell
Test-Path .\api\token
Test-Path .\internal\biz\token.go
Test-Path .\internal\data\token.go
Test-Path .\internal\service\token.go
```

以上应为 `False`。

---

## Step 2：Hub Casdoor Auth 基础模块

### 完成内容

新增 Hub Auth 模块：

```text
api/auth/v1/auth.proto
internal/biz/auth.go
internal/data/auth.go
internal/service/auth.go
```

提供接口：

```text
GET  /v3/auth/login
GET  /v3/auth/login-url
POST /v3/auth/exchange
POST /v3/auth/refresh
GET  /v3/auth/logout
GET  /v3/auth/logout-url
GET  /v3/auth/me
```

### 设计说明

```text
/v3/auth/login      浏览器友好，302 跳转 Casdoor。
/v3/auth/login-url  返回登录 URL，便于调试或前端 SPA 使用。
/v3/auth/exchange   code 换 access_token / refresh_token。
/v3/auth/refresh    refresh_token 刷新 access_token。
/v3/auth/me         通过 Bearer token 返回当前 principal。
```

### 验收命令

```powershell
$Hub = "http://127.0.0.1:18001"
$RedirectUri = "http://localhost:3000/callback"

# 浏览器打开：
# http://127.0.0.1:18001/v3/auth/login?redirect_uri=http://localhost:3000/callback&state=dev

$Code = "<callback 返回的 code>"

$Body = @{
  code = $Code
  redirect_uri = $RedirectUri
  state = "dev"
} | ConvertTo-Json -Compress

$TokenResp = Invoke-RestMethod `
  -Method POST `
  -Uri "$Hub/v3/auth/exchange" `
  -ContentType "application/json" `
  -Body $Body

$AccessToken = $TokenResp.access_token
$Me = Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/me" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

$Me | ConvertTo-Json -Depth 10
```

### 当前状态

```text
已验证：login -> Casdoor -> code -> exchange -> access_token -> /me 成功。
```

---

## Step 3：aisphere-kit Casdoor OAuth 能力补齐

### 完成内容

`aisphere-kit` 增加 OAuth code exchange 能力：

```text
authn.ExchangeCodeRequest
authn.RefreshTokenRequest
authn.TokenResponse
authn.OAuthExchanger
```

Casdoor adapter 实现：

```text
ExchangeCode
RefreshToken
```

### 设计说明

Hub 不直接拼 Casdoor HTTP 请求，而是通过 kit 调用：

```go
rt.Casdoor.ExchangeCode(ctx, authn.ExchangeCodeRequest{
    Code:        req.Code,
    RedirectURI: req.RedirectUri,
})
```

### 验收标准

```text
/v3/auth/exchange 能换回 access_token。
/v3/auth/refresh 能刷新 token。
```

---

## Step 4：Casdoor JWT 公钥证书启动期校验

### 完成内容

`aisphere-kit v0.1.2-casdoor-cert-fix` 完成：

```text
1. 支持 casdoor.certificate。
2. 支持 casdoor.certificate_file。
3. 启动期校验 certificate 是否存在。
4. 启动期拒绝 PRIVATE KEY / RSA PRIVATE KEY / EC PRIVATE KEY。
5. 支持 PEM 类型：
   - BEGIN CERTIFICATE
   - BEGIN PUBLIC KEY
   - BEGIN RSA PUBLIC KEY
6. features.authn=true 时，证书错误直接启动失败。
```

### 推荐配置

```yaml
casdoor:
  endpoint: "http://localhost:18000"
  client_id: "aisphere-auth"
  client_secret: "<secret>"
  organization: "aisphere"
  application: "aisphere"
  default_scope: "openid profile email"
  certificate: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
```

或者：

```yaml
casdoor:
  certificate_file: "./certs/casdoor-jwt-public.pem"
```

### 验收命令

```powershell
go run ./cmd/aispherehub
```

缺少证书时应直接输出明确错误，而不是运行到 `/v3/auth/me` 才失败。

---

## Step 4.1：Hub 启动错误可见性修复

### 完成内容

修复 Hub 入口错误被吞的问题。

原问题：

```text
go run ./cmd/aispherehub
exit status 1
```

无任何具体错误。

修复后：

```text
aisphere-hub starting, config=configs/config.yaml
aisphere-hub startup failed: <具体错误>
```

### 涉及文件

```text
cmd/aispherehub/main.go
```

### 验收命令

```powershell
go run ./cmd/aispherehub 2>&1
```

配置错误时应能看到具体原因，例如 YAML 缩进错误、Casdoor 证书缺失、DB 连接失败等。

---

## Step 4.2：Access Guard 下沉到 kit

### 完成内容

`aisphere-kit v0.1.3-access-guard` 新增：

```text
aisphere-kit/access
```

核心方法：

```go
Require(ctx, access.Check)
Can(ctx, access.Check)
Record(ctx, access.Event)
RequireAndAudit(ctx, access.Check, access.Event)
```

Runtime 增加：

```go
Access *access.Guard
```

### Hub 改造

Hub 删除本地 AccessUsecase 方向，改成使用 kit：

```go
rt.Access.Require(ctx, access.Check{
    Resource: "aihub:admin",
    Action:   "admin.access",
})
```

新增开发验证接口：

```text
GET  /v3/auth/check-admin
POST /v3/auth/audit-test
```

### 验收命令

authn 验证：

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/me" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

authz 验证：

```powershell
Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/check-admin" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

audit 验证：

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "$Hub/v3/auth/audit-test" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

### 当前状态

```text
Access 已下沉 kit。
后续 Hub / Runtime / Sandbox / ModelGateway / AgentService 都应统一使用 kit/access.Guard。
```

---

## 3. 当前配置注意事项

### 3.1 YAML 禁止 Tab

检查命令：

```powershell
Select-String -Path .\configs\config.yaml -Pattern "`t"
```

有输出就必须改成空格。

### 3.2 Casdoor certificate 必须匹配 token kid

查看 access token header：

```powershell
$HeaderPart = $AccessToken.Split(".")[0]
$HeaderJson = [System.Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String(
    $HeaderPart.Replace("-", "+").Replace("_", "/").PadRight($HeaderPart.Length + (4 - $HeaderPart.Length % 4) % 4, "=")
  )
)
$HeaderJson
```

如果 header 是：

```json
{
  "kid": "cert_aisphere"
}
```

则 Hub `casdoor.certificate` 必须对应 Casdoor 里的 `cert_aisphere` 公钥证书。

### 3.3 不要泄露这些配置

```text
client_secret
database.password
redis.password
objectstore.secret_key
Casdoor private key
```

后续提交仓库时应改为环境变量或本地 overlay。

---

## 4. 当前 Hub 验收清单

### 4.1 构建验收

```powershell
go mod tidy
make wire
go test ./...
go run ./cmd/aispherehub
```

### 4.2 Authn 验收

```powershell
$Hub = "http://127.0.0.1:18001"
$Body = @{
  code = "<code>"
  redirect_uri = "http://localhost:3000/callback"
  state = "dev"
} | ConvertTo-Json -Compress

$TokenResp = Invoke-RestMethod -Method POST -Uri "$Hub/v3/auth/exchange" -ContentType "application/json" -Body $Body
$AccessToken = $TokenResp.access_token

Invoke-RestMethod -Method GET -Uri "$Hub/v3/auth/me" -Headers @{ Authorization = "Bearer $AccessToken" }
```

### 4.3 Access 验收

```powershell
Invoke-RestMethod -Method GET -Uri "$Hub/v3/auth/check-admin" -Headers @{ Authorization = "Bearer $AccessToken" }
Invoke-RestMethod -Method POST -Uri "$Hub/v3/auth/audit-test" -Headers @{ Authorization = "Bearer $AccessToken" }
```

---

## 5. 当前遗留问题

```text
1. authz=true 后，需要确认 Casdoor Permission / Model / Resource 配置。
2. audit=true 后，需要确认 Casdoor Record 或审计后端是否真正写入。
3. 配置中的 secret 需要迁移到环境变量或本地 overlay。
4. Access Guard 已下沉 kit，但其他组件尚未接入。
5. Hub 还没有真实业务模块迁入，目前只有 auth 和验证接口。
6. Skill canonical API 是下一步建议迁移目标。
```

---


---

## Step 5.0.1：aisphere-kit Migration Runner 接入

### 完成内容

```text
1. aisphere-kit 新增 migration runner。
2. 支持 Postgres SQL migration。
3. 支持 schema_migrations 版本表。
4. 支持 checksum 校验。
5. 支持 dirty 状态。
6. 支持 PostgreSQL advisory lock。
7. Runtime 支持 migration.auto_apply。
8. Hub 业务 repo 不再 AutoMigrate；只保留 migrations/postgres/*.sql。
```

### 涉及文件

```text
configs/config.migration.example.yaml
docs/MIGRATION_STEP5_0_1_KIT_MIGRATION.md
docs/ACCEPTANCE_HANDOVER.md
go.mod
```

### 配置变更

开发环境可开启：

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

生产环境建议 `auto_apply: false`，由部署流程显式执行 migration。

### 验收命令

```powershell
go run ./cmd/aispherehub
```

然后查询：

```sql
SELECT version, name, dirty, error, applied_at
FROM schema_migrations
ORDER BY version;
```

### 验收结果

待本地验证。

### 风险和遗留问题

```text
1. 当前 kit migration runner 第一版只支持 Up，不支持 Down/Rollback。
2. 生产环境默认不建议 auto_apply=true。
3. 后续需要补 migrate CLI：migrate up/status/version。
```

### 下一步

继续应用 Step 5.1 Skill CRUD v2，所有 Skill 表结构变更走 migrations/postgres/*.sql。

## 6. 下一步计划：迁移 Skill canonical 最小闭环

### 建议先迁接口

```text
GET    /v3/aihub/skills
GET    /v3/aihub/skills/{name}
DELETE /v3/aihub/skills/{name}
```

### 建议新增文件

```text
api/skill/v1/skill.proto
internal/biz/skill.go
internal/data/skill.go
internal/service/skill.go
migrations/postgres/000001_create_aihub_skills.sql
docs/MIGRATION_STEP5_SKILL_CANONICAL.md
```

### 设计原则

```text
1. 使用 GORM 结构化表。
2. 不迁旧 namespace。
3. 不迁旧 JSONB document store。
4. 每个业务动作必须接入 access.Require。
5. 写操作必须接入 access.Record 或 RequireAndAudit。
```

### Skill 资源命名建议

```text
resource = aihub:skill:<skill_name>
actions:
  skill.read
  skill.list
  skill.delete
```

---

## 7. 后续文档维护规则

每次完成一个功能点，必须追加以下内容：

```text
## Step N：功能名称

### 完成内容
- ...

### 涉及文件
- ...

### 配置变更
- ...

### 验收命令
- ...

### 验收结果
- 通过 / 未通过 / 待验证

### 风险和遗留问题
- ...

### 说明：停止使用手写 AuthZ/Audit 测试路由

从本步骤开始，不再依赖手写的 authz/audit debug 路由作为主验收路径。authz/audit 应该通过真实的 Kratos 生成式业务 API 验证，本轮从 SkillService 开始。

## 下一步
- ...
```

本文档应进入 Hub 仓库：

```text
docs/ACCEPTANCE_HANDOVER.md
```

后续每个交付 zip 包都必须包含这个文件。

---

## Step 4.3：AuthZ / Audit 验证闭环

### 完成内容

```text
1. aisphere-kit access.Guard 增加 AuthzEnabled / AuditEnabled 显式特性开关。
2. features.authz=false 时，access.Require 只要求 principal，不调用 Casdoor Enforce。
3. features.authz=true 时，access.Require 调用 Casdoor Enforce，未授权返回拒绝。
4. features.audit=false 时，access.Record 为 no-op。
5. features.audit=true 时，access.Record 调用 Casdoor AddRecord。
6. Runtime 只在对应 feature 开启时设置 rt.Authz / rt.Audit，避免 AuthN 初始化 Casdoor 后误触发 AuthZ。
7. Hub 增加 /v3/auth/access-status，用于确认当前 access guard 状态。
8. /v3/auth/check-admin 和 /v3/auth/audit-test 返回 authz_enabled / audit_enabled / recorded 等验收字段。
```

### 涉及文件

```text
aisphere-kit/access/access.go
aisphere-kit/access/access_test.go
aisphere-kit/starter/runtime.go

Hub:
internal/biz/auth.go
internal/data/access.go
internal/service/auth.go
configs/config.authz-audit.example.yaml
docs/MIGRATION_STEP4_3_AUTHZ_AUDIT_VERIFY.md
docs/ACCEPTANCE_HANDOVER.md
```

### 配置变更

```yaml
features:
  authn: true
  authz: false # 默认开发态先关闭；开启后需要 Casdoor permission selector
  audit: false # 默认开发态先关闭；开启后写 Casdoor Record

casdoor:
  permission_id: "" # authz=true 时推荐配置
```

新增示例：

```text
configs/config.authz-audit.example.yaml
```

### 验收命令

```powershell
$Hub = "http://127.0.0.1:18001"

Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/access-status" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/check-admin" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod `
  -Method POST `
  -Uri "$Hub/v3/auth/audit-test" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

### 验收结果

```text
待用户本地验证。
期望：
1. authz=false 时 check-admin 成功，返回 authz_enabled=false。
2. audit=false 时 audit-test 成功，返回 recorded=false。
3. authz=true 且未配策略时 check-admin 返回 403。
4. authz=true 且配置 user:admin -> aihub:admin -> admin.access 策略时 check-admin 成功。
5. audit=true 时 audit-test 写入 Casdoor Record。
```

### 风险和遗留问题

```text
1. Casdoor Permission/Model/Resource/Enforcer 的具体配置仍需在现场确认。
2. audit=true 后 AddRecord 是否落库要结合 Casdoor 后台 Record 页面验证。
3. 当前 check-admin 是开发验证接口，生产阶段应只保留在 dev/admin debug 模式，或改为内部运维接口。
```

### 说明：停止使用手写 AuthZ/Audit 测试路由

从本步骤开始，不再依赖手写的 authz/audit debug 路由作为主验收路径。authz/audit 应该通过真实的 Kratos 生成式业务 API 验证，本轮从 SkillService 开始。

## 下一步

```text
完成 AuthZ/Audit 验收后，开始 Step 5：迁移 Skill canonical 最小闭环。
```

---

## Step 4.3.1：AuthZ / Audit 手写路由 Principal 修复

### 问题现象

`/v3/auth/access-status` 返回正常，但 `/v3/auth/check-admin` 返回：

```json
{"message":"principal missing from context"}
```

同时 `/v3/auth/audit-test` 在 audit 关闭时可以返回，但没有真实验证到当前登录用户。

### 根因

`/v3/auth/check-admin`、`/v3/auth/audit-test` 是通过 `srv.HandleFunc` 注册的手写 HTTP 路由。该类路由在当前 Kratos HTTP server 使用方式下，不能稳定依赖生成式 RPC middleware 自动把 principal 注入业务 context。

因此即使请求带了 `Authorization: Bearer <access_token>`，业务层 `access.Guard.Require()` 也可能拿不到 principal。

### 修复内容

在 Hub AuthService 的手写验证路由里增加显式 Bearer 解析和认证：

```text
Authorization header -> bearer token -> AuthUsecase.AuthenticateBearer -> kit authn.AuthenticateToken -> principal.NewContext
```

涉及文件：

```text
internal/service/auth.go
internal/biz/auth.go
internal/data/auth.go
```

### 验收命令

```powershell
$Hub = "http://127.0.0.1:18001"

Invoke-RestMethod `
  -Method GET `
  -Uri "$Hub/v3/auth/check-admin" `
  -Headers @{ Authorization = "Bearer $AccessToken" }

Invoke-RestMethod `
  -Method POST `
  -Uri "$Hub/v3/auth/audit-test" `
  -Headers @{ Authorization = "Bearer $AccessToken" }
```

### 预期结果

当：

```yaml
features:
  authn: true
  authz: false
  audit: false
```

预期：

```text
check-admin: 200 OK, allowed=true, authz_enabled=false
audit-test:  200 OK, recorded=false, audit_enabled=false
```

后续打开 `authz: true` 后，`check-admin` 才会真正调用 Casdoor/Casbin Enforce。

---

## Step 5：Skill canonical 最小闭环迁移

### 完成内容

新增第一个真实业务模块 Skill canonical read/delete：

```text
GET    /v3/aihub/skills
GET    /v3/aihub/skills/{name}
DELETE /v3/aihub/skills/{name}
```

本轮目标是验证真实业务接口中的：

```text
Kratos proto/API -> service -> biz -> data -> GORM structured table
                 -> kit-kratos authn middleware
                 -> kit/access.Guard Require / Record
```

### 涉及文件

新增：

```text
api/skill/v1/skill.proto
internal/biz/skill.go
internal/data/skill.go
internal/service/skill.go
migrations/postgres/000002_create_aihub_skills.sql
docs/MIGRATION_STEP5_SKILL_CANONICAL.md
```

修改：

```text
internal/app/app.go
internal/app/wire_gen.go
internal/biz/biz.go
internal/data/data.go
internal/service/service.go
docs/ACCEPTANCE_HANDOVER.md
```

### 配置变更

无新增必填配置。仍复用：

```text
features.authn=true
features.authz=false/true
features.audit=false/true
```

### 验收命令

先执行生成和启动：

```powershell
make api
make wire
go mod tidy
go test ./...
go run ./cmd/aispherehub
```

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

### 验收结果

待用户本地执行。

### 风险和遗留问题

```text
1. 当前 Skill 只有 list/get/delete，尚未迁 create/update/import/publish/version/review。
2. Hub repo 不再运行 AutoMigrate；表结构必须通过 migrations/postgres/*.sql 统一维护。
3. authz=true / audit=true 还需要基于真实 Skill API 继续验收。
4. manifest_json 和 tags 当前只做存储与返回，尚未做 schema 校验。
```

### 说明：停止使用手写 AuthZ/Audit 测试路由

从本步骤开始，不再依赖手写的 authz/audit debug 路由作为主验收路径。authz/audit 应该通过真实的 Kratos 生成式业务 API 验证，本轮从 SkillService 开始。

## 下一步

```text
1. 用 Skill list/get/delete 验证真实 authz/audit。
2. 迁移 Skill create/update。
3. 再迁 Skill package/import/publish/version 流程。
```

---

## Step 5：Skill canonical list/get/delete 真实业务接口验收

### 完成内容

```text
1. 新增 Skill canonical API 最小闭环。
2. 真实接口 list/get/delete 已在 authn + authz=true 下通过。
3. Casdoor Permission / Role / Model 配置已验证可放行真实 Skill API。
4. 确认 Casdoor Permission Model 必须使用三段 p = sub, obj, act。
```

### 涉及文件

```text
api/skill/v1/skill.proto
internal/biz/skill.go
internal/data/skill.go
internal/service/skill.go
migrations/postgres/000002_create_aihub_skills.sql
docs/MIGRATION_STEP5_SKILL_CANONICAL.md
```

### 配置变更

```text
features.authn=true
features.authz=true
casdoor.permission_id=aisphere/perm_aihub_admin
```

Casdoor Model 使用：

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

### 验收结果

```text
GET    /v3/aihub/skills              通过
GET    /v3/aihub/skills/demo-skill   通过
DELETE /v3/aihub/skills/demo-skill   通过
```

### 风险和遗留问题

```text
1. create_time 曾出现 protobuf zero time，需要 Step 5.1 修复。
2. Skill 仍缺 POST/PUT 完整 CRUD。
3. 权限错误曾返回 500，需要统一映射为 403。
```

### 下一步

```text
Step 5.1：Skill create/update + timestamp hardening + permission denied 403。
```

---

## Step 5.1：Skill canonical CRUD 工程化补齐

### 完成内容

```text
1. 新增 POST /v3/aihub/skills。
2. 新增 PUT /v3/aihub/skills/{name}。
3. 新增 skill.create / skill.update 权限动作。
4. create 严格创建，重复 name 返回 409。
5. update 只更新已存在 skill，不存在返回 404。
6. Skill name 增加格式校验。
7. manifest_json 增加 JSON 校验。
8. tags 增加 trim / 去空 / 去重。
9. created_at / updated_at 做 DB 级和代码级兜底。
10. access/authz denied 统一映射为 403。
11. 明确禁止业务 repo AutoMigrate，DDL 统一走 migrations/postgres。
```

### 涉及文件

```text
api/skill/v1/skill.proto
internal/biz/errors.go
internal/biz/skill.go
internal/data/skill.go
internal/service/skill.go
migrations/postgres/000003_harden_aihub_skills.sql
docs/MIGRATION_STEP5_1_SKILL_CRUD.md
docs/ACCEPTANCE_HANDOVER.md
```

### 配置变更

```text
无需新增配置。
Casdoor Permission 若使用 resource=aihub:* action=*，则 create/update/list/get/delete 均应放行。
```

### 验收命令

详见：

```text
docs/MIGRATION_STEP5_1_SKILL_CRUD.md
```

### 验收结果

```text
待用户本地执行 make api / make wire / go test ./... / CRUD 验收。
```

### 风险和遗留问题

```text
1. 当前 patch 只改 proto 和源代码，应用后需要执行 make api 生成 pb/http/grpc 代码。
2. 当前采用 migrations/postgres SQL 文件作为唯一 schema source；后续可接入 kit migration runner 自动执行。
3. audit=true 后 Skill create/update/delete 的 Casdoor Record 还需要现场验证。
```

### 下一步

```text
Step 5.2：Skill version / file / download 只读能力迁移。
```

### 清理说明

```text
本步骤同步删除 internal/biz/access.go 旧 AccessUsecase 残留。
Hub 业务模块统一直接依赖 github.com/actionlab-ai/aisphere-kit/access.Guard。
```

## Step 5.2：Skill Share / Catalog / Cross-platform Authorization

### 已完成

- 确认 Skill 分享不是 Hub 私有表问题，而是跨平台资源授权问题。
- kit `permission.Manager` 作为唯一策略写入入口，Hub 不直接调用 Casdoor SDK。
- kit 新增 Casdoor/Casbin 兼容的 policy subject helper：用户主体优先写入 `org/name`，服务主体写入 `service:<id>`，Agent 主体写入 `agent:<id>`。
- kit RoleActionMapper 增加 `viewer / consumer / editor / owner` 的 Skill action 映射。
- Hub 新增 Skill Share API：list/create/delete。
- Hub 新增 Catalog API：给 Agent / Runtime / Workflow 等消费侧读取 Skill。
- Catalog list 支持两种模式：全局 `skill.catalog.read` 放行时返回管理范围内 Skill；否则根据当前主体在 Casdoor policy 里的 Skill grant 返回被分享 Skill。

### 关键接口

```text
GET    /v3/aihub/skills/{name}/shares
POST   /v3/aihub/skills/{name}/shares
DELETE /v3/aihub/skills/{name}/shares/{grant_id}
GET    /v3/aihub/catalog/skills
GET    /v3/aihub/catalog/skills/{name}
```

### 关键动作

```text
skill.share.list
skill.share.create
skill.share.delete
skill.catalog.read
skill.consume
```

### 注意事项

- 应用 patch 后必须执行 `make api`，否则会出现 `undefined: v1.CreateSkillShareRequest` 等生成代码缺失问题。
- Casdoor model 仍然使用三段 policy：`p = sub, obj, act`。
- 分享策略写入需要配置 `features.permission=true`，并正确配置 `casdoor.policy_enforcer` 或 `casdoor.enforcer_id`。


### Step 5.2 补充：动态分享改为 Casdoor Enforcer policy

经讨论确认，Skill 动态分享不落 Hub 本地 ResourceGrant 表。最终边界为：

- `casdoor.permission_id`：全局 RBAC，例如 `role_aihub_admin -> aihub:* / *`。
- `casdoor.policy_enforcer`：动态资源分享，例如 `p, aisphere/test1, aihub:skill:demo-skill, skill.read`。
- Hub 只调用 `aisphere-kit/permission.Manager`，不直接调用 Casdoor SDK。
- Kit 统一封装 AddPolicy / RemovePolicy / ListPolicy / Enforce fallback。
- Enforcer 必须绑定同一个三段式 Model：`p = sub, obj, act`。
- `policy_adapter_id` / Model adapter 表属于 Casdoor 自己的数据库，不由 Hub migration 维护。

运行时授权顺序：

```text
1. 先通过 permission_id 检查全局 RBAC。
2. 如果不通过，再通过 policy_enforcer 检查动态分享 policy。
3. 任意一层放行，Access Guard 即允许访问。
```

当前配置建议：

```yaml
features:
  authn: true
  authz: true
  permission: true

casdoor:
  permission_id: "aisphere/perm_aihub_admin"
  policy_enforcer: "enforcer_aihub_share"
  policy_adapter_id: "aisphere_policy_rule"
```

---

## Step 5.2.3：Casdoor 动态分享 Enforcer 验收与配置收敛

### 完成内容

```text
1. 确认动态分享不落 Hub 本地 ResourceGrant 表。
2. 确认动态分享复用 Casdoor/Casbin Enforcer policy。
3. Hub Share API 仍然只调用 aisphere-kit/permission.Manager，不直接调用 Casdoor SDK。
4. kit 支持 policy_enforcer 短名配置，并自动规范化为 owner/name。
5. kit 支持 policy_adapter_id 默认推导，减少 Hub 配置复杂度。
6. Casdoor Adapter / Model / Enforcer 配置链路已跑通。
7. test3 普通用户登录成功，并通过动态分享访问指定 Skill。
```

### 最终配置口径

```yaml
features:
  authn: true
  authz: true
  audit: false
  permission: true

casdoor:
  endpoint: "http://localhost:18000"
  client_id: "aisphere-auth"
  client_secret: "${AISPHERE_CASDOOR__CLIENT_SECRET}"
  organization: "aisphere"
  application: "aisphere"

  # 全局 RBAC
  permission_id: "aisphere/perm_aihub_admin"

  # 动态分享
  policy_enforcer: "enforcer_aisphere"

  # 可省略；默认推导为 aisphere/aisphere_policy_rule
  # policy_adapter_id: "aisphere_policy_rule"

  model_id: ""
  resource_id: ""
  enforcer_id: ""
  owner: ""
```

### Casdoor 对象要求

```text
Model:
  aisphere/<authz-model>
  policy_definition: p = sub, obj, act
  adapter/table: aisphere_policy_rule

Permission:
  aisphere/perm_aihub_admin
  用于全局 RBAC，例如 role_aihub_admin -> aihub:* / *

Enforcer:
  aisphere/enforcer_aisphere
  绑定同一个三段式 Model
  用于动态分享 policy，例如 p, aisphere/test3, aihub:skill:share-skill-1, skill.read
```

### 已验收结果

```text
1. POST /v3/aihub/skills/{name}/shares 可以创建 viewer 分享。
2. 返回 grant 中 subject/resource/actions/created_by 正确。
3. test3 可通过 Hub OAuth 登录并换取 access_token。
4. test3 通过动态分享访问 share-skill-1 已验证通过。
5. policy_enforcer 短名 enforcer_aisphere 曾导致 Enforce 报 wrong token count，已通过 kit v1.6.3 规范化修复。
6. Casdoor 配置复杂度已通过 kit v1.6.4 收敛。
```

### 当前遗留

```text
1. GET /v3/aihub/skills/{name}/shares 曾返回 {}，需要继续验证/修复 list policy 读回逻辑。
2. DELETE /shares/{grant_id} 后动态策略撤销和 test3 权限失效还需要完整验收。
3. service:agent-platform / agent:xxx / runtime:xxx 主体需要等 service principal / service JWT 接入后做真实链路验证。
```

### 迁移状态文档

本阶段新增总览文档：

```text
docs/HUB_BACKEND_MIGRATION_STATUS.md
```

该文档用于持续记录：

```text
已完成迁移 / 待迁移能力 / 已丢弃旧设计 / 下一步计划。
```
