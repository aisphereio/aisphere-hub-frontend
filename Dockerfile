ARG BUN_VERSION=1.3.4

FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_HUB_URL=
ARG NEXT_PUBLIC_IAM_URL=
ARG NEXT_PUBLIC_AUTH_MODE=gateway_oidc
ARG NEXT_PUBLIC_GATEWAY_LOGOUT_PATH=/logout

ENV NEXT_PUBLIC_HUB_URL=${NEXT_PUBLIC_HUB_URL}
ENV NEXT_PUBLIC_IAM_URL=${NEXT_PUBLIC_IAM_URL}
ENV NEXT_PUBLIC_AUTH_MODE=${NEXT_PUBLIC_AUTH_MODE}
ENV NEXT_PUBLIC_GATEWAY_LOGOUT_PATH=${NEXT_PUBLIC_GATEWAY_LOGOUT_PATH}

RUN bun run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
