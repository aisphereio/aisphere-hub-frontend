# Hub Backend 迁移状态总览

> 更新时间：2026-06-25  
> 范围：从旧 `hub-backend/backend` 迁移到新的 `aisphere-hub + aisphere-kit + aisphere-kit-kratos` 工程体系。  
> 口径：旧 backend 只作为业务能力参考，不复制旧目录结构、旧本地认证模型、旧 JSONB 文档模型。

---

## 1. 当前总体结论

当前迁移已经完成了 **平台底座 + Casdoor 登录认证 + Casdoor/Casbin 授权 + kit migration + Skill 管理主链路**。

已经可以作为后续迁移的工程基线：

```text
Hub 启动
  -> kit runtime 初始化 DB / Casdoor / Access / Migration
  -> kit migration runner 自动执行 Hub migrations/postgres/*.sql
  -> Casdoor OAuth 登录换 token
  -> kit-kratos middleware 解析 Bearer token
  -> access.Guard 统一鉴权
  -> Skill CRUD 真实业务接口运行
  -> Skill Share 通过 Casdoor dynamic Enforcer 写入动态策略
  -> 普通用户通过分享策略访问指定 Skill
```

---

## 2. 已完成迁移

### 2.1 工程底座迁移

完成内容：

```text
1. Hub 从旧 backend 逐步迁入新的 Kratos 项目。
2. 公共能力下沉到 aisphere-kit / aisphere-kit-kratos。
3. Hub 业务只保留 service / biz / data 分层。
4. 新业务接口走 protobuf-first + Kratos HTTP 生成绑定。
5. Hub 不再直接散落 DB / Casdoor / Redis / ObjectStore 初始化逻辑。
```

当前新工程核心目录：

```text
api/                  protobuf API
cmd/aispherehub/      单入口
configs/              kit schema 配置
internal/app/         wire / composition root
internal/service/     HTTP/gRPC service adapter
internal/biz/         usecase / repo interface / domain object
internal/data/        repo implementation
migrations/postgres/  Hub 自己的 SQL migration
```

---

### 2.2 kit / kit-kratos 公共能力

已经落地：

```text
1. config 统一配置结构。
2. db/postgres 初始化和连接池。
3. DBFromContext / WithTx 事务上下文。
4. Casdoor OAuth code exchange / refresh。
5. Casdoor JWT certificate 校验。
6. authn principal 解析。
7. authz adapter。
8. audit 基础接口。
9. access.Guard 统一封装 Require / Can / Record / RequireAndAudit。
10. feature flags：authn / authz / audit / permission。
11. migration runner：schema_migrations / checksum / dirty / advisory lock / auto_apply。
12. Casdoor dynamic policy enforcer：全局 RBAC + 动态分享 fallback。
13. Casdoor 配置简化：permission_id + policy_enforcer 为主，低层 selector 不暴露给业务。
```

---

### 2.3 Casdoor Authn 登录闭环

已完成接口：

```text
GET  /v3/auth/login
GET  /v3/auth/login-url
POST /v3/auth/exchange
POST /v3/auth/refresh
GET  /v3/auth/logout
GET  /v3/auth/logout-url
GET  /v3/auth/me
```

已验证：

```text
1. 浏览器跳转 Casdoor 登录成功。
2. OAuth code 换 access_token 成功。
3. /v3/auth/me 能返回当前 principal。
4. admin / test3 均已验证可登录。
5. code 只能使用一次，重复 exchange 会失败，这是 OAuth 正常行为。
```

保留规则：

```text
Hub 不签发本地 token。
Hub 不维护本地 token 表。
Hub 只消费 Casdoor access_token。
```

---

### 2.4 Casdoor AuthZ / Access Guard

已完成：

```text
1. Skill API 已接入 access.Guard。
2. 全局权限使用 Casdoor Permission / Role / Model。
3. Permission Model 固定为三段式：p = sub, obj, act。
4. 管理员 role_aihub_admin -> aihub:* / * 已验证能放行 Skill CRUD。
5. permission denied 已从 500 修正为 403。
```

推荐 Casdoor Model：

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
m = (g(r.sub, p.sub) || r.sub == p.sub || p.sub == "public:*") && keyMatch(r.obj, p.obj) && (r.act == p.act || p.act == "*")
```

---

### 2.5 kit Migration Runner

已完成：

```text
1. Hub 不再在 repo 启动阶段 AutoMigrate。
2. Hub migration SQL 统一放在 migrations/postgres。
3. kit migration runner 支持自动执行 pending migration。
4. schema_migrations 记录 version / name / checksum / dirty / error / applied_at。
5. dirty=true 时阻止继续启动，避免半迁移状态继续运行。
```

已迁移的 Hub migration：

```text
000002_create_aihub_skills.sql
000003_harden_aihub_skills.sql
```

明确放弃：

```text
GORM AutoMigrate 作为业务 repo 默认行为。
```

---

### 2.6 Skill canonical CRUD

已完成接口：

```text
POST   /v3/aihub/skills
PUT    /v3/aihub/skills/{name}
GET    /v3/aihub/skills
GET    /v3/aihub/skills/{name}
DELETE /v3/aihub/skills/{name}
```

已完成工程化能力：

```text
1. create 严格创建，重复 name 返回 409。
2. update 只更新已存在 Skill，不存在返回 404。
3. delete 软删除。
4. name 格式校验。
5. manifest_json JSON 校验。
6. tags trim / 去空 / 去重。
7. created_at / updated_at 兜底。
8. authn 缺失返回 401。
9. authz 不通过返回 403。
10. 参数错误返回 400。
```

已验证：

```text
Skill create/list/get/update/delete 全部通过。
```

---

### 2.7 Skill Share / Catalog / 动态分享授权

最终方案：

```text
全局 RBAC：
  Casdoor Permission / Role / Model

动态分享：
  Casdoor Enforcer / Casbin policy

封装层：
  aisphere-kit/permission.Manager

业务层：
  Hub Skill Share API
```

新增接口：

```text
GET    /v3/aihub/skills/{name}/shares
POST   /v3/aihub/skills/{name}/shares
DELETE /v3/aihub/skills/{name}/shares/{grant_id}
GET    /v3/aihub/catalog/skills
GET    /v3/aihub/catalog/skills/{name}
```

已验证：

```text
1. Casdoor Adapter aisphere_policy_rule 已配置。
2. Casdoor Enforcer enforcer_aisphere 已绑定三段式 Model。
3. Hub config 简化为 permission_id + policy_enforcer。
4. POST /shares 能将 viewer share 转换为 Casbin policy。
5. test3 普通用户登录成功。
6. test3 通过动态分享访问指定 Skill 已跑通。
7. policy_enforcer 短名 enforcer_aisphere 由 kit 自动规范化为 aisphere/enforcer_aisphere。
```

示例分享结果：

```json
{
  "grant_id": "YWlzcGhlcmUvdGVzdDE",
  "resource": "aihub:skill:share-skill-1",
  "subject": "aisphere/test1",
  "subject_type": "user",
  "subject_id": "test1",
  "role": "viewer",
  "actions": [
    "skill.read",
    "skill.version.list",
    "skill.version.read",
    "skill.file.list",
    "skill.file.read",
    "skill.manifest.read"
  ],
  "created_by": "aisphere/admin"
}
```

当前注意：

```text
GET /v3/aihub/skills/{name}/shares 曾返回 {}，需要继续验证/修复 list policy 读回逻辑。
创建分享和动态授权访问已经验证通过；分享列表读回是独立遗留项。
```

---

## 3. 当前推荐配置

### 3.1 Hub config.yaml Casdoor 最小配置

```yaml
casdoor:
  endpoint: "http://localhost:18000"
  client_id: "aisphere-auth"
  client_secret: "${AISPHERE_CASDOOR__CLIENT_SECRET}"

  organization: "aisphere"
  application: "aisphere"

  # 全局 RBAC：role_aihub_admin -> aihub:* / *
  permission_id: "aisphere/perm_aihub_admin"

  # 动态分享：某用户 / service / agent 访问某一个具体资源
  policy_enforcer: "enforcer_aisphere"

  # 可省略；默认按 organization 推导为 aisphere/aisphere_policy_rule
  # policy_adapter_id: "aisphere_policy_rule"

  model_id: ""
  resource_id: ""
  enforcer_id: ""
  owner: ""
```

`enforcer_id` 是 Casdoor `/api/enforce` 的低层 selector，普通业务服务不要再配置它。

### 3.2 feature flags

```yaml
features:
  authn: true
  authz: true
  audit: false
  permission: true
```

### 3.3 migration

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

---

## 4. 已明确丢弃 / 不再迁移的旧设计

```text
1. Hub 本地 token 表和本地 token 签发。
2. api/token/v1、internal/*/token.go。
3. Hub 业务 repo 内部 AutoMigrate。
4. 手写 authz/audit debug endpoint 作为主验收路径。
5. Hub 私有 ResourceGrant / share table。
6. 直接在 Hub 里调用 Casdoor SDK 写策略。
7. 旧 backend 的整体目录结构。
8. 旧 _system namespace / JSONB document store 作为新业务核心模型。
9. 将动态分享塞进一个大 Permission 的 users/resources/actions 组合里。
```

---

## 5. 尚未迁移 / 待处理清单

### 5.1 Skill 相关

```text
1. Skill version 版本列表和详情。
2. Skill file / manifest / SKILL.md 读取。
3. Skill package upload / zip parse。
4. ObjectStore/S3 保存 Skill 包与文件。
5. Skill draft / submit / review / publish / online / offline 状态流转。
6. Skill compare。
7. Skill download。
8. SkillSet。
9. 分享列表 GET /shares 读回逻辑最终确认/修复。
10. 分享删除后动态策略撤销完整验收。
11. service:agent-platform / agent:xxx / runtime:xxx 主体的 service JWT 真实链路。
```

### 5.2 Catalog / Runtime 消费侧

```text
1. Catalog API 与 Skill version/file 结合。
2. Agent / Runtime 通过 Catalog API 拉取 Skill manifest。
3. Runtime 热加载 Skill。
4. Sandbox 会话级权限和 Skill 挂载。
```

### 5.3 Agent / Workflow / Tool

```text
1. Tool 管理。
2. Agent 管理。
3. Workflow 管理。
4. Agent/Workflow 与 Skill 消费关系。
5. 跨平台主体授权：service / agent / workflow / runtime。
```

### 5.4 Audit / Observability

```text
1. audit=true 后 Skill create/update/delete/share 的审计落点。
2. Casdoor Record 或平台统一 audit store 取舍。
3. metrics / tracing / access log 与业务动作绑定。
```

### 5.5 前端和 OpenAPI

```text
1. 前端对接新 canonical Skill API。
2. 前端对接 Skill Share UI。
3. OpenAPI 生成物和前端 SDK 同步。
4. 旧前端接口兼容或重定向策略。
```

---

## 6. 建议下一步

优先顺序：

```text
1. 修复/确认 GET /v3/aihub/skills/{name}/shares 列表读回。
2. 验证 DELETE /shares/{grant_id} 后 test3 权限立即失效。
3. 迁移 Skill version / file 只读能力。
4. 再做 Skill package upload + objectstore。
5. 再做 publish/review/online/offline 状态流转。
```
