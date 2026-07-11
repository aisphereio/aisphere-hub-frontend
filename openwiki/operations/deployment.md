# Deployment & Operations

## Docker Build

The `Dockerfile` uses a multi-stage build:

1. **deps** — `oven/bun:1.3.4-alpine`, installs dependencies with `bun install --frozen-lockfile`
2. **builder** — Same Bun image, copies source, sets build args, runs `bun run build`
3. **runner** — `node:22-alpine`, copies standalone output, runs as non-root `nextjs` user

### Build Arguments

| Arg | Default | Purpose |
|-----|---------|---------|
| `NEXT_PUBLIC_HUB_URL` | (empty) | Hub API URL (empty = same-origin) |
| `NEXT_PUBLIC_IAM_URL` | (empty) | IAM API URL (empty = same-origin) |
| `NEXT_PUBLIC_AUTH_MODE` | `gateway_oidc` | Auth mode |
| `NEXT_PUBLIC_GATEWAY_LOGOUT_PATH` | `/logout` | Envoy Gateway logout path |

**Important:** These values are baked into the frontend bundle at build time. They cannot be changed at runtime. To change domains or auth mode, rebuild the image.

### Build Command

```bash
docker build \
  --build-arg NEXT_PUBLIC_HUB_URL= \
  --build-arg NEXT_PUBLIC_IAM_URL= \
  --build-arg NEXT_PUBLIC_AUTH_MODE=gateway_oidc \
  --build-arg NEXT_PUBLIC_GATEWAY_LOGOUT_PATH=/logout \
  -t registry.cn-beijing.aliyuncs.com/ainfracn/aisphere-hub-front:latest .
```

## Kubernetes Deployment

The `deploy/` directory contains Kustomize manifests:

### Resources

| File | Kind | Purpose |
|------|------|---------|
| `configmap.yaml` | ConfigMap | Runtime env vars (NEXT_PUBLIC_HUB_URL, AUTH_MODE, NODE_ENV) |
| `deployment.yaml` | Deployment | Pod spec with probes, resources, service account |
| `service.yaml` | Service | ClusterIP on port 3000 |
| `kustomization.yaml` | Kustomization | Namespace `aisphere`, common labels |

### Deployment Details

- **Namespace:** `aisphere`
- **Replicas:** 1
- **Image:** `registry.cn-beijing.aliyuncs.com/ainfracn/aisphere-hub-front:latest`
- **Image pull secret:** `aliyun-registry`
- **Service account:** `aisphere-hub-front`
- **Probes:** Liveness (initial 20s, period 20s), Readiness (initial 10s, period 10s)
- **Resources:** Request 100m CPU / 128Mi, Limit 500m CPU / 512Mi
- **Timezone:** Asia/Shanghai

### ConfigMap

```yaml
data:
  NEXT_PUBLIC_HUB_URL: ""        # same-origin via Envoy
  NEXT_PUBLIC_AUTH_MODE: "gateway_oidc"
  NODE_ENV: "production"
```

## CI/CD

### Docker Build Workflow (`.github/workflows/docker-acr.yml`)

Triggers on:
- Push to `main` or `feat/*` branches
- Tags matching `v*`
- PRs to `main` or `feat/*`
- Manual dispatch with optional image tag

Builds and pushes to Aliyun ACR (`registry.cn-beijing.aliyuncs.com/ainfracn/aisphere-hub-front`).

Tags: `latest` (default branch), branch name, tag, PR ref, semver, `sha-{short}`.

### CI Workflow (`.github/workflows/ci.yml`)

Runs on PR and push to `main`/`feat/*`:
1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bun run build` (with production env vars)
4. `docker build` (verification only, no push)

### OpenWiki Update Workflow (`.github/workflows/openwiki-update.yml`)

Scheduled daily at 08:00 UTC. Runs `openwiki code --update --print` and creates a PR with updated docs.

## Local Development

### Prerequisites
- Bun 1.3.4+
- A running Hub backend (default: `http://127.0.0.1:18001`)
- A running IAM backend (default: `http://127.0.0.1:18080`)

### Dev Server

```bash
# Token mode (direct Hub API)
NEXT_PUBLIC_AUTH_MODE=token \
NEXT_PUBLIC_HUB_URL=http://127.0.0.1:18001 \
NEXT_PUBLIC_IAM_URL=http://127.0.0.1:18080 \
bun run dev
```

The dev server runs on port 3000 with Webpack.

### Build & Start

```bash
bun run build
bun run start   # runs .next/standalone/server.js
```

### Helper Scripts (`.zscripts/`)

| Script | Purpose |
|--------|---------|
| `dev.sh` | Dev server with hot reload |
| `start.sh` | Production start |
| `build.sh` | Production build |
| `copy-standalone-assets.mjs` | Copies public/ and other assets to standalone output |
| `mini-services-*.sh` | Mini-services management (separate micro-apps) |

## Caddyfile

A `Caddyfile` is provided for local reverse proxy:

```
:81 {
    @transform_port_query {
        query XTransformPort=*
    }
    handle @transform_port_query {
        reverse_proxy localhost:{query.XTransformPort}
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

This allows dynamic port forwarding via `?XTransformPort=PORT` query parameter, with a default proxy to port 3000.

## Environment Variables

| Variable | Build-time | Runtime | Default | Purpose |
|----------|-----------|---------|---------|---------|
| `NEXT_PUBLIC_HUB_URL` | ✅ | ❌ | `http://127.0.0.1:18001` | Hub API base URL |
| `NEXT_PUBLIC_IAM_URL` | ✅ | ❌ | `http://127.0.0.1:18080` | IAM API base URL |
| `NEXT_PUBLIC_AUTH_MODE` | ✅ | ❌ | `token` | Auth mode |
| `NEXT_PUBLIC_GATEWAY_LOGOUT_PATH` | ✅ | ❌ | `/logout` | Envoy logout path |
| `NEXT_PUBLIC_GATEWAY_LOGIN_URL` | ✅ | ❌ | `/` | Envoy login URL |
| `NEXT_PUBLIC_ENABLE_SKILL_SOCIAL` | ✅ | ❌ | (unset) | Enable skill social features |
| `NEXT_PUBLIC_AUTH_CALLBACK_PATH` | ✅ | ❌ | `/auth/callback` | OAuth callback path |
| `NEXT_PUBLIC_AUTH_REDIRECT_AFTER_LOGIN` | ✅ | ❌ | `/` | Post-login redirect |
| `DATABASE_URL` | ❌ | Yes | — | SQLite database path (Prisma) |
| `NODE_ENV` | ❌ | Yes | — | Node environment |

## Source Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Docker build |
| `deploy/configmap.yaml` | K8s ConfigMap |
| `deploy/deployment.yaml` | K8s Deployment |
| `deploy/service.yaml` | K8s Service |
| `deploy/kustomization.yaml` | Kustomize overlay |
| `.github/workflows/docker-acr.yml` | Docker build & push to Aliyun ACR |
| `.github/workflows/ci.yml` | CI (lint, build, container build) |
| `.github/workflows/openwiki-update.yml` | Scheduled OpenWiki doc update |
| `.env` | Local environment configuration |
| `Caddyfile` | Local reverse proxy config |
| `.zscripts/` | Dev/build helper scripts |