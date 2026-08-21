# Release Process

Checklist to cut a new Keres release. Steps 1-2 are manual; everything after
the tag push is handled by [`.github/workflows/release.yml`](../.github/workflows/release.yml).

## 1. Pre-flight

- [ ] `bun run typecheck`, `bun run lint`, and `bun run test:coverage` all pass
      (the same three commands the release workflow's `verify` job runs
      before any platform build starts — catching a failure locally is
      faster than catching it after a tag is already pushed).
- [ ] `bun run format` to run biome.

## 2. Version and release name

- [ ] Decide the new semver version and a codename in the spirit of
      [`docs/fluff_release_names.md`](fluff_release_names.md).
- [ ] Update `name` and `version` in
      [`apps/client/src/config/appRelease.ts`](../apps/client/src/config/appRelease.ts)
      — the in-app, human-facing release identity. Nothing else sets this file.
- [ ] Add the release's entry to
      [`docs/fluff_release_names.md`](fluff_release_names.md).

> **`package.json` versions are automated — no manual edit needed.**
> `scripts/ci/set-version.mjs` stamps the version parsed from the git tag
> into all 6 `package.json` files (root, `apps/api`, `apps/client`,
> `apps/desktop`, `apps/admin`, `packages/shared`) plus `apps/client/app.json`'s
> `expo.version`, as part of the release workflow. Internal workspace
> packages reference each other via `workspace:*`, so the committed
> version numbers never need to match for `bun install` to resolve.

## 3. Tag and push

```bash
git tag v1.2.3
git push origin v1.2.3
```

The **`v` prefix is required** — the workflow only triggers on tags
matching `v*.*.*` (see `on.push.tags` in `release.yml`); a tag without it
pushes silently and releases nothing.

## 4. What happens next (automated)

Pushing the tag runs `.github/workflows/release.yml`, which:

1. Re-verifies the monorepo (typecheck, lint, test:coverage).
2. Builds and publishes the API's Docker image to GHCR, tagged with the
   version and `latest`.
3. Builds desktop installers for Windows (nsis + portable), macOS (dmg),
   and Linux (AppImage + Flatpak) — all currently **unsigned** (no
   code-signing certificate configured yet).
4. Builds a signed Android APK + AAB. iOS is out of scope (no paid Apple
   Developer account or bundle identifier configured).
5. Packages **Keres Server** zips for Windows x64, Linux x64, and
   macOS arm64 (`Keres-Server-<os>-<arch>-<version>.zip`) — the home API
   without Docker. Docker/GHCR remains the production PostgreSQL channel.
   DO. NOT. FORGET. To check if Docker builds. (1.4 failed release first time)
6. Collects every artifact into a single GitHub Release on the tag, with
   auto-generated release notes.

Local packaging of **Keres Server** is `bun run package:server` (same
script the release job runs). It writes `apps/api/dist-server/keres-server/`
and a versioned zip next to it.

Nothing here needs manual intervention unless a job fails.
