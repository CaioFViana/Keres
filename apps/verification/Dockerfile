# syntax=docker/dockerfile:1

# The reference age-verification service. Ships alone: no API, no story data, no payments - it holds the identity
# documents of people sent to it, encrypted, until a reviewer decides, and speaks only the KERES-AGE-V1 protocol to a
# Keres server on one side and to its reviewers' browsers on the other. Self-hosted "keres servers" bundles never
# contain it.
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/verification/package.json apps/verification/package.json
COPY patches patches
# Not --frozen-lockfile: bun.lock spans the whole workspace, so a strict check on this partial workspace always fails
# (same reason as apps/payments/Dockerfile).
RUN bun install --production --linker=hoisted

FROM oven/bun:1-slim AS runtime
WORKDIR /app
COPY package.json bun.lock ./
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY apps/verification/package.json apps/verification/tsconfig.json ./apps/verification/
COPY apps/verification/src ./apps/verification/src
# The directories the service writes: the data (encrypted images, metadata), the keys and the backups of the data. They are created here,
# owned by the service user, so the named volumes of docker-compose.yml start with the right owner.
RUN mkdir -p /app/apps/verification/data /app/apps/verification/keys /app/apps/verification/backups \
  && chown -R bun:bun /app

# The port the service listens on inside the container. Publish it only to loopback (see docker-compose.yml) and let
# the reverse proxy be the only thing facing the internet: upload pages and the Keres server reach it through there.
ENV HOST=0.0.0.0
EXPOSE 3102
USER bun
WORKDIR /app/apps/verification
CMD ["bun", "run", "src/index.ts"]
