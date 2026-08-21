# syntax=docker/dockerfile:1

# ---- deps: resolve the workspace packages the API actually needs ----
FROM oven/bun:latest AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
# patchedDependencies (root package.json) applies repo-wide during install, regardless of
# whether this particular image ends up using the patched package - bun still needs the
# .patch file on disk to apply it. Neither patch here (expo-sqlite, drizzle-orm/expo-sqlite)
# affects the API at runtime (ela fala com Postgres por node-postgres ou com SQLite por libSQL,
# nunca pelo driver do expo-sqlite, que nem é dependência de apps/api) - only `bun install`
# needs this.
COPY patches patches
# Not --frozen-lockfile: bun.lock was generated across the whole workspace (including
# apps/client, deliberately not copied here to keep this image free of the RN/Expo
# toolchain), so a strict frozen check on this partial workspace always fails.
RUN bun install

# ---- admin-build: painel (`dist/`) e vitrine pública (`dist-showcase/`) ----
# `build:all` = `build` (Vite do /admin) + `build:showcase` (Vite do site público). Sem o
# segundo, a API sobe com o warn "Showcase UI not built" e `/showcase` fica fora do ar.
# Os dois usam o mesmo ícone do desktop (vite.keresIcon.ts); sem o PNG no contexto,
# png-to-ico relata "not a valid PNG" no lugar de ENOENT.
FROM deps AS admin-build
COPY packages/shared packages/shared
COPY apps/admin apps/admin
COPY apps/client/assets/images/desktop_icon.png apps/client/assets/images/desktop_icon.png
RUN cd apps/admin && bun run build:all

# ---- client-web-build: Expo web export served by the API at / ----
# Só client + shared. Copiar o workspace inteiro (desktop/site/api/admin) faz o `bun install`
# puxar Electron e, pior, `better-sqlite3` — devDependency só dos testes do client, módulo
# nativo cujo `install` dispara node-gyp e exige Python/g++ que esta imagem não tem (e que
# não vamos instalar só para um pacote que `expo export` nunca carrega). `--production`
# omite esse grafo de teste; o runtime da API só recebe o `dist/` estático daqui.
FROM oven/bun:latest AS client-web-build
WORKDIR /app
# BuildKit paraleliza estágios independentes. Sem esta barreira, `deps` (bun install da
# API) e este estágio (bun install do grafo Expo) correm juntos e o WSL2 esgota a RAM
# do host. Copiar um artefato do admin-build serializa: deps → admin → client.
COPY --from=admin-build /app/apps/admin/dist/index.html /tmp/.admin-built
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/client/package.json apps/client/package.json
COPY patches patches
# --linker=hoisted: o Metro resolve `zod` (e o resto) subindo de
# packages/shared até /app/node_modules. Sem hoist, bun deixa os pacotes
# só em node_modules/.bun e o export falha com "Unable to resolve module zod".
RUN bun install --production --linker=hoisted
COPY packages/shared packages/shared
COPY apps/client apps/client
# Metro no Bun infla demais; o CLI do Expo é `#!/usr/bin/env node`. Um worker
# (CI=1 → metro.config.js) e heap limitado cabem no Docker Desktop sem congelar o host.
ENV CI=1
ENV EXPO_NO_TELEMETRY=1
ENV NODE_OPTIONS=--max-old-space-size=3072
WORKDIR /app/apps/client
RUN node scripts/generate-migrations-index.js \
 && node scripts/generate-example-stories-index.js \
 && node scripts/generate-help-index.js \
 && node scripts/generate-story-devices-index.js \
 && node --max-old-space-size=3072 "$(node -p "require('path').join(require('path').dirname(require.resolve('expo/package.json')), 'bin/cli')")" export -p web

# ---- prod-deps: production-only install, scoped to just what the API needs at runtime ----
# Deliberately does NOT copy apps/admin/package.json: admin is already built to static files by
# this point, so its React/Vite toolchain (and every dependency it pulls in) has no reason to
# exist in the running API's node_modules. `--production` additionally drops devDependencies -
# apps/api's own `drizzle-kit`/`typescript` are build/CLI-only tools, never imported by
# src/index.ts at runtime (bun runs the TS source directly, no compile step). This is what was
# actually bloating the runtime image: the old single `deps` install pulled in Vite's entire
# dependency tree plus every dialect driver `drizzle-kit` optionally depends on, none of which
# the server process ever touches.
FROM oven/bun:latest AS prod-deps
WORKDIR /app
# bun.lock deliberately NOT copied here: `bun install --production` refuses to proceed if the
# resolved graph would differ at all from a lockfile it can see (even without --frozen-lockfile
# passed explicitly) - and a lockfile generated for the full workspace always differs once
# apps/admin's package.json is out of the picture. Without a lockfile to compare against, bun
# just resolves apps/api + packages/shared's own dependency ranges directly.
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY patches patches
# --linker=hoisted: without a lockfile present, bun defaults a fresh install to its "isolated"
# linker layout (packages live under node_modules/.bun/, with no top-level compatibility
# symlinks created) - the build log still reports "N packages installed" so this fails silently
# until the runtime container can't `require()` anything. Forcing the conventional hoisted
# layout is what actually makes the packages resolvable at `apps/api/src/index.ts`'s runtime.
RUN bun install --production --linker=hoisted

# ---- runtime: the API, with the built admin panel copied alongside it ----
FROM oven/bun:1-slim AS runtime
WORKDIR /app

COPY package.json bun.lock ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src
# Needed at runtime, not just dev: `runMigrations()` (src/db/migrate.ts) reads these SQL files
# and applies whatever's pending on every boot - a fresh database has no tables at all otherwise.
# Os dois conjuntos entram na imagem: qual deles é aplicado depende de `DATABASE_DRIVER`, que é
# escolhido em tempo de execução, não de build.
COPY apps/api/drizzle ./apps/api/drizzle
COPY apps/api/drizzle-sqlite ./apps/api/drizzle-sqlite

# `resourceRoot` resolve estes dois a partir de import.meta.dir (apps/admin/dist e
# apps/admin/dist-showcase), independente de process.cwd().
COPY --from=admin-build /app/apps/admin/dist ./apps/admin/dist
COPY --from=admin-build /app/apps/admin/dist-showcase ./apps/admin/dist-showcase
# Cliente web co-hospedado em /app (o mesmo export que o Electron empacota). Sem
# este estágio a API sobe, só o /app 404. Expo fica isolado deste stage para o
# runtime continuar só com Bun.
COPY --from=client-web-build /app/apps/client/dist ./apps/client/dist

WORKDIR /app/apps/api

# Local media storage (the default driver) writes here at runtime - created ahead of time so
# a fresh named volume mounted at this path (see docker-compose.deploy.yml) inherits
# ownership matching the non-root user below, instead of being created root-owned by Docker
# itself the moment the mount happens. Everything else under /app just needs to be readable
# by that user, which chowning the whole tree covers in one pass.
RUN mkdir -p media-storage && chown -R bun:bun /app

EXPOSE 3000

# oven/bun's base image already creates this user (uid/gid 1000) but never switches to it,
# so the container ran as root by default. Nothing here needs root: migrations write to
# Postgres, not the filesystem, and the local media driver only needs the directory chowned
# above.
USER bun

# `server.ts` is the production entrypoint: it applies pending migrations, reconciles the
# root admin and only then opens the HTTP port. `index.ts` deliberately only creates the app
# so route tests can import it without causing production side effects.
CMD ["bun", "run", "src/server.ts"]
