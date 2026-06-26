# Step 4: Authz/Audit Foundation

Step 3 已经完成 Casdoor OAuth 登录闭环：login -> code -> exchange -> access_token -> /me。

Step 4 的目标不是新增本地 token，也不是恢复旧 backend 的权限表，而是把后续业务模块需要的权限和审计入口提前放好：

- `internal/biz/access.go` 定义业务层可用的 `AccessUsecase`。
- `internal/data/access.go` 把 `AccessUsecase` 适配到 `aisphere-kit` 的 `rt.Authz` 和 `rt.Audit`。
- Auth 模块的 login-url / exchange / refresh / logout-url / me 都会尝试写 audit；如果 `features.audit=false`，则自动 no-op。

## 边界

- Hub 不直接依赖 Casdoor SDK。
- Hub 不维护本地 token 表。
- Hub 不维护本地权限表。
- 权限事实来源仍然是 Casdoor + Casbin。
- 业务模块只调用 `AccessUsecase.Require(...)` / `AccessUsecase.RecordAudit(...)`。

## Authz 配置

如果要启用 authz，`configs/config.yaml` 需要配置：

```yaml
features:
  authn: true
  authz: true
  audit: true

casdoor:
  endpoint: "http://localhost:18000"
  client_id: "aisphere-auth"
  client_secret: "..."
  organization: "aisphere"
  application: "aisphere"
  permission_id: "aisphere/hub-permission"
```

`permission_id` 对应 Casdoor 的 Permission。后续每个业务模块会使用统一资源名和 action：

```text
resource: aihub:skill:<skill_id>
action:   skill.read / skill.update / skill.delete
```

## Audit 配置

```yaml
features:
  audit: true
```

Audit 底层由 `aisphere-kit/casdoor.Adapter` 写 Casdoor Record。如果暂时没有配置 Casdoor Record 侧能力，保持 `audit=false` 不影响主流程。

## 后续业务模块接入方式

以 Skill 删除为例：

```go
if err := uc.access.Require(ctx, biz.AccessCheck{
    Resource: resource.AIHubSkill(skillID).String(),
    Action:   action.SkillDelete,
}); err != nil {
    return err
}

err := uc.repo.DeleteSkill(ctx, skillID)

_ = uc.access.RecordAudit(ctx, biz.AuditRecord{
    Action:   action.SkillDelete,
    Resource: resource.AIHubSkill(skillID).String(),
    Result:   audit.ResultSuccess,
})
```

这确保所有业务模块的权限和审计都通过同一个通道进入 kit。
