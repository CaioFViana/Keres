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

# ---- runtime: the API, with the built admin panel copied alongside it ----
FROM oven/bun:latest AS runtime
WORKDIR /app

COPY package.json bun.lock ./
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src

# apps/api/src/index.ts looks for this at apps/admin/dist relative to its own
# location (import.meta.dir), regardless of process.cwd() - see the comment there.
COPY --from=admin-build /app/apps/admin/dist ./apps/admin/dist

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
