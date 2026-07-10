# Aisphere Hub Frontend

前端支持两种 authn 模式：

| 模式 | 配置 | 用途 |
| --- | --- | --- |
| Gateway OIDC | `NEXT_PUBLIC_AUTH_MODE=gateway_oidc` | K8s/Envoy Gateway 生产与测试环境 |
| Browser token | `NEXT_PUBLIC_AUTH_MODE=token` | 本地直连 Hub 调试 |

Gateway OIDC 模式下，页面不再检查 localStorage token。浏览器访问页面时由 Envoy 完成 Casdoor 登录，API 请求使用同域 Gateway session；Envoy 把 access token 转发给 Hub/IAM。

生产镜像默认使用：

```text
NEXT_PUBLIC_AUTH_MODE=gateway_oidc
NEXT_PUBLIC_HUB_URL=
NEXT_PUBLIC_IAM_URL=
NEXT_PUBLIC_GATEWAY_LOGOUT_PATH=/logout
```

空的 Hub/IAM URL 表示同域：

```text
/v1/iam/* -> IAM
/v1/*     -> Hub
/*        -> Frontend
```

这些 `NEXT_PUBLIC_*` 值会在 `next build` 时写入前端 bundle，不能只在 Pod 运行时修改。需要改变域名或 auth 模式时，应重新构建镜像。

本地开发：

```bash
NEXT_PUBLIC_AUTH_MODE=token \
NEXT_PUBLIC_HUB_URL=http://127.0.0.1:18001 \
NEXT_PUBLIC_IAM_URL=http://127.0.0.1:18080 \
bun run dev
```

K8s 和 Gateway API 完整部署见后端仓库 `deploy/k8s/README.md`。
