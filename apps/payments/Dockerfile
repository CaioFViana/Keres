# syntax=docker/dockerfile:1

# The official Keres payment microservice. Ships alone: no API, no admin panel, no client -
# it only speaks the connector contract to a Keres server on one side and PayPal / Stripe /
# Google Play on the other. Self-hosted "keres servers" bundles never contain it.
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/payments/package.json apps/payments/package.json
COPY patches patches
# Not --frozen-lockfile: bun.lock spans the whole workspace, so a strict check on this
# partial workspace always fails (same reason as apps/api/Dockerfile).
RUN bun install --production --linker=hoisted

FROM oven/bun:1-slim AS runtime
WORKDIR /app
COPY package.json bun.lock ./
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY apps/payments/package.json apps/payments/tsconfig.json ./apps/payments/
COPY apps/payments/src ./apps/payments/src
RUN chown -R bun:bun /app

# The port the service listens on inside the container. Publish it only to loopback (see
# docker-compose.yml) and let the reverse proxy (nginx example in this folder) be the only
# thing facing the internet - PSP webhooks and the Keres server reach it through there.
EXPOSE 3101
USER bun
WORKDIR /app/apps/payments
CMD ["bun", "run", "src/index.ts"]
