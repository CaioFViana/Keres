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
# affects the API at runtime (it uses drizzle-orm/node-postgres, not the expo-sqlite driver;
# expo-sqlite itself isn't even a dependency of apps/api) - only `bun install` needs this.
COPY patches patches
# Not --frozen-lockfile: bun.lock was generated across the whole workspace (including
# apps/client, deliberately not copied here to keep this image free of the RN/Expo
# toolchain), so a strict frozen check on this partial workspace always fails.
RUN bun install

# ---- admin-build: build the static admin panel (apps/admin) with Vite ----
FROM deps AS admin-build
COPY packages/shared packages/shared
COPY apps/admin apps/admin
RUN cd apps/admin && bun run build

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
COPY apps/api/drizzle ./apps/api/drizzle

# apps/api/src/index.ts looks for this at apps/admin/dist relative to its own
# location (import.meta.dir), regardless of process.cwd() - see the comment there.
COPY --from=admin-build /app/apps/admin/dist ./apps/admin/dist

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
