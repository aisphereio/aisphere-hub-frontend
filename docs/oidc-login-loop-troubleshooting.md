# OIDC 登录循环排障记录

> 日期：2026-07-23
> 环境：Envoy Gateway v1.8.2 + Envoy proxy v1.38.3 / Casdoor 2026.07.01
> 涉及：hub.weagent.cc（aisphere-hub-front）、iam.weagent.cc（aisphere-iam-front）

## 症状

点击登录后浏览器在 Casdoor 登录页与应用之间反复跳转，最终报
`ERR_TOO_MANY_REDIRECTS`。Casdoor 的 `/api/login` 实际成功、`/oauth2/callback`
也返回 302，但 callback 之后的 `GET /` 又被判定未登录、跳回 Casdoor，形成死循环。

## 根因：OIDC cookie 配置不当

两个控制台都踩了 OIDC session cookie 的配置坑，根因不同但表现一致（登录循环）：

### 1. Hub 控制台 — Cookie shadowing（同名 cookie 域冲突）

`hub-console-oidc` SecurityPolicy 早期把 `cookieDomain` 从默认 host-only 改成
`weagent.cc`。改动**之前**登录过的浏览器里残留着旧的 **host-only** cookie
（`OauthHMAC-ecbc7476` 等，与新版同名）。改动后新登录种的是 **domain-scoped**
cookie，浏览器同时发送两份（**host-only 排在前面**），Envoy OIDC filter 读到
旧的失效 HMAC → 验证失败 → 跳 Casdoor → 循环。

**网络请求铁证**（DevTools）：

| 请求 | 关键 Cookie / Set-Cookie |
|------|--------------------------|
| `GET /oauth2/callback` 响应 | `Set-Cookie: OauthHMAC-ecbc7476=RyAZLutn...; Domain=weagent.cc`（新值） |
| `GET /` 请求 | `Cookie: OauthHMAC-ecbc7476=zBMsj4HO...`（**旧 host-only 值排第一**） |

> cookie 名后缀 `ecbc7476` 是 Envoy 按 `client_id` 算的稳定哈希，配置变更后不变。

### 2. IAM 控制台 — 缺少 SameSite=Lax

`iam-console-oidc` 没有设 `cookieConfig.sameSite`，Envoy 默认 `Strict`。
OIDC callback 是**跨站顶层导航**（`casdoor.weagent.cc` → `iam.weagent.cc/oauth2/callback`），
`SameSite=Strict` 的 cookie 在跨站导航时**不发送**。于是 callback 请求不带
`OauthNonce` / `CodeVerifier` cookie，OIDC filter 无法验证 state/PKCE → 流程失败/循环。

## 修复

### Hub：cookieDomain 回退为 host-only（默认）

```bash
kubectl -n aisphere patch securitypolicy hub-console-oidc \
  --type=merge -p '{"spec":{"oidc":{"cookieDomain":null}}}'
```

不设 `cookieDomain`（host-only）后，新登录种的 host-only cookie **直接覆盖**
同名的旧 host-only cookie（同 name+path+domain），session 自愈，循环消除。
保留 `SameSite=Lax`（这才是解决移动端跨站 redirect 带 cookie 的关键）。

### IAM：补上 SameSite=Lax

```bash
kubectl -n aisphere patch securitypolicy iam-console-oidc \
  --type=merge -p '{"spec":{"oidc":{"cookieConfig":{"sameSite":"Lax"}}}}'
```

`Lax` 允许 callback 跨站导航携带 `OauthNonce`/`CodeVerifier` cookie 完成 OIDC 验证，
同时仍拦截跨站子资源的 CSRF。

## 正确的 OIDC cookie 配置（两个控制台统一）

```yaml
oidc:
  # cookieDomain 不要设（host-only）——设了会导致旧浏览器残留 cookie shadowing
  # cookieConfig.sameSite 必须设 Lax——默认 Strict 会让 callback 丢 cookie
  cookieConfig:
    sameSite: Lax
  # cookieNames 按各控制台自定义（避免跨控制台串台）
  cookieNames:
    accessToken: Aisphere-Hub-AccessToken   # IAM 用 Aisphere-IAM-AccessToken
    idToken: Aisphere-Hub-IDToken           # IAM 用 Aisphere-IAM-IDToken
```

**一句话原则**：`cookieDomain` 留空（host-only），`sameSite` 设 `Lax`。

## 顺带排除的干扰项

- **`get-app-login` 返回 `enablePassword: false`**：这是 Casdoor **设计行为**，
  不是 bug。`GetMaskedApplication(app, "")` 对非 admin 调用方在
  `object/application_util.go:255` 硬编码清零 `EnablePassword`/`EnableSigninSession`；
  `enableAutoSignin` 不在脱敏列表所以存活。Casdoor 前端登录页用的是 `signinMethods`
  数组（含 `"Password"`），不依赖 `enablePassword` 字段。与登录循环无关。

## 相关修复（同一轮，仍生效）

- **OIDC 401 卡死页**：移动端双发 `/oauth2/callback`，第二个请求因 nonce 已删返回
  401 纯文本 "OAuth flow failed."。用 `EnvoyPatchPolicy` 的 `local_reply_config` 把
  `/oauth2/callback` 的 401 改写成带 `location.replace('/')` 的 HTML，浏览器自动跳首页。
  配置：`aisphere-hub/deploy/gateway/envoy-local-reply-patch.yaml`
  验证：`curl /oauth2/callback?code=FAKE` → 401 + `text/html` + `location.replace('/')`

- **前端 `useMe` 重试**：`gateway_oidc` 模式下 OIDC 回跳后 `/v1/authn/me` 首次
  可能瞬时 401（session cookie 刚种），`retry` 从 0 改为重试 1 次，避免误判跳登录页。
  配置：`src/hooks/use-auth.ts`

## 验证清单

- [x] Hub `GET /?tab=skills` → 200，SkillHub Console 正常加载（5 skills）
- [x] Hub `/v1/authn/me` → 200，`/v1/skills` → 200
- [x] IAM `SameSite=Lax` 生效，密码登录 → `GET /` → 200，IAM Console 正常加载
- [x] IAM `/v1/iam/me` → 200，`/v1/iam/orgs/.../resources` → 200（无循环）
- [x] OIDC 401 local_reply 修复仍有效（401 + HTML 跳转页）
- [x] EnvoyPatchPolicy Accepted:True / Programmed:True

> 注：浏览器若曾经历过 hub cookieDomain=weagent.cc 时期的循环，会残留大量
> domain-scoped cookie 累计触发 `431 Request Header Fields Too Large`。
> 在隔离浏览器上下文（或清除 weagent.cc 域 cookie）后即恢复正常。

## 持久化的配置文件

- `aisphere-hub/deploy/gateway/hub-console-security-policy.yaml`（新建，含 host-only 说明）
- `aisphere-iam-front/deploy/security-policy.yaml`（补 `cookieConfig.sameSite: Lax`）
- `aisphere-hub/deploy/gateway/envoy-local-reply-patch.yaml`（401→HTML 跳转）
