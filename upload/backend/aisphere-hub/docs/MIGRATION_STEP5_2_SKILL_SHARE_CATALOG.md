# Step 5.2：Skill Share / Catalog / Cross-platform Authorization

## 目标

本步骤把 Skill 分享从 Hub 私有 ACL 设计升级为统一的 Casdoor/Casbin 策略写入模型：

- Hub 仍然是 Skill 数据源与权限入口。
- Casdoor/Casbin 仍然是策略判定源。
- Hub 不直接调用 Casdoor SDK，而是通过 `aisphere-kit/permission.Manager` 写入、查询、撤销策略。
- Agent / Runtime / Workflow 等平台后续通过 Catalog API 读取 Skill，不直接连接 Hub 数据库。

## 新增接口

管理侧分享接口：

```text
GET    /v3/aihub/skills/{name}/shares
POST   /v3/aihub/skills/{name}/shares
DELETE /v3/aihub/skills/{name}/shares/{grant_id}
```

消费侧 Catalog 接口：

```text
GET /v3/aihub/catalog/skills
GET /v3/aihub/catalog/skills/{name}
```

## 授权主体

`subject_type` 支持跨平台主体：

```text
user / group / role / org / project / app / service / agent / workflow / runtime / public
```

示例：

```json
{
  "subject_type": "service",
  "subject_id": "agent-platform",
  "role": "consumer"
}
```

会通过 kit 写入 Casbin policy：

```text
p, service:agent-platform, aihub:skill:demo-skill, skill.catalog.read
p, service:agent-platform, aihub:skill:demo-skill, skill.consume
p, service:agent-platform, aihub:skill:demo-skill, skill.version.read
p, service:agent-platform, aihub:skill:demo-skill, skill.file.read
p, service:agent-platform, aihub:skill:demo-skill, skill.manifest.read
```

用户主体在传入 `org_id` 或者 `subject_id=aisphere/test1` 时会写成 Casdoor 兼容格式：

```text
p, aisphere/test1, aihub:skill:demo-skill, skill.read
```

## Role 到 Action 映射

由 `aisphere-kit/permission.DefaultRoleActionMapper` 统一维护：

```text
viewer:
  skill.read
  skill.version.list
  skill.version.read
  skill.file.list
  skill.file.read
  skill.manifest.read

consumer:
  skill.catalog.read
  skill.consume
  skill.version.read
  skill.file.read
  skill.manifest.read

editor:
  viewer + skill.update / skill.version.create / skill.file.update

owner:
  editor + skill.catalog.read / skill.consume / skill.upload / skill.publish / skill.share.* / skill.delete
```


## Casdoor 配置模式

本步骤固定使用两层 Casdoor/Casbin 能力：

```text
casdoor.permission_id
  用于全局 RBAC，例如 role_aihub_admin -> aihub:* / *。

casdoor.policy_enforcer
  用于动态资源分享，例如 p, aisphere/test1, aihub:skill:demo-skill, skill.read。
```

不要把动态分享塞进一个大 Permission 的 Users/Resources/Actions 组合里，否则容易出现 test1 分享 skill-a 后同时获得 skill-b 权限的“笛卡尔积”问题。

推荐配置：

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

Casdoor 里需要：

```text
Model:
  aisphere/aisphere-authz-model
  policy_definition: p = sub, obj, act
  adapter: aisphere_policy_rule

Permission:
  aisphere/perm_aihub_admin
  model: aisphere/aisphere-authz-model
  roles: aisphere/role_aihub_admin
  resources: aihub:*
  actions: *

Enforcer:
  aisphere/enforcer_aihub_share
  model: aisphere/aisphere-authz-model
  adapter/table: aisphere_policy_rule
```

`aisphere_policy_rule` 是 Casdoor 自己使用的策略表名，不是 Hub migration。Hub 不创建这张表。Kit 只通过 Casdoor SDK 写入/删除/list policy。

当 `features.permission=true` 时，kit 会在启动阶段校验 dynamic policy backend。如果 Enforcer 没绑定 Model，会直接启动失败并提示：

```text
the model for enforcer ... should not be empty
```

这时需要回 Casdoor 的 Enforcer 页面绑定 Model。

## 设计边界

- Hub 不再维护一份私有 share table。
- Hub 只通过 kit permission 模块写 Casdoor/Casbin 策略。
- Agent 平台不直接查 Hub DB，而是调用 Catalog API。
- `skill.share.*` 是分享管理权限。
- `skill.catalog.read` / `skill.consume` 是 Agent / Runtime 消费权限。

## 应用后需要执行

因为修改了 proto：

```powershell
make api
make wire
go mod tidy
go test ./...
```

## 当前验收进展

### 已通过

```text
1. Casdoor Adapter aisphere_policy_rule 配置成功。
2. Casdoor Enforcer enforcer_aisphere 绑定 Model 后启动校验通过。
3. POST /v3/aihub/skills/{name}/shares 写入动态分享策略成功。
4. test3 普通用户已能登录 Hub。
5. test3 通过动态分享访问指定 Skill 已跑通。
6. kit v1.6.3 修复 policy_enforcer 短名在 Enforce 调用时未规范化的问题。
7. kit v1.6.4 收敛 Casdoor 配置，普通业务只需要 permission_id + policy_enforcer。
```

### 待确认 / 待修复

```text
1. GET /v3/aihub/skills/{name}/shares 读回曾返回 {}。
2. DELETE /shares/{grant_id} 之后需要验证对应 Casbin policy 被删除。
3. 删除分享后，test3 再读该 Skill 应返回 403。
4. service / agent / runtime 主体需要接入 service principal 后再做真实调用验证。
```

## 配置收敛后的推荐写法

```yaml
casdoor:
  endpoint: "http://localhost:18000"
  client_id: "aisphere-auth"
  client_secret: "${AISPHERE_CASDOOR__CLIENT_SECRET}"
  organization: "aisphere"
  application: "aisphere"

  # 全局 RBAC
  permission_id: "aisphere/perm_aihub_admin"

  # 动态分享 Enforcer，支持短名
  policy_enforcer: "enforcer_aisphere"

  # 可省略；默认按 organization 推导为 aisphere/aisphere_policy_rule
  # policy_adapter_id: "aisphere_policy_rule"

  # 低层 selector，普通业务服务留空
  model_id: ""
  resource_id: ""
  enforcer_id: ""
  owner: ""
```

`enforcer_id` 和 `policy_enforcer` 不要同时配置同一个值。普通 Hub 业务只用 `policy_enforcer` 表示动态分享策略目标。
