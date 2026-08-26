# Release Process

Checklist to cut a new Keres release. Steps 1-2 are manual; everything after
the tag push is handled by [`.github/workflows/release.yml`](../.github/workflows/release.yml).

## 1. Pre-flight

- [ ] `bun run release:check` passes. It first audits the client, admin, showcase and site
      translations so as to fail early; then it runs `typecheck` and `lint`, applies the
      formatting, checks that every version controlled by `scripts/lib/version.ts` matches
      the root `package.json`'s version, requires a clean worktree and finishes on
      `test:report` (with integration and coverage).
- [ ] The release's `verify` job runs the same command with `--ci`: there the formatting is only
      checked, the worktree does not have to be clean (the workflow itself writes the version coming
      from the tag) and the suites are the unit ones with coverage - the integration ones have their own job in
      `ci.yml`. No artifact starts being compiled before that passes.

## 2. Version and release name

- [ ] Decide the new semver version and a codename in the spirit of
      [`docs/fluff_release_names.md`](fluff_release_names.md).
- [ ] Run `bun run version:set 1.2.3 Galatea` (replace both values). It updates every
      workspace `package.json`, Expo's `app.json`, and
      [`packages/shared/metadata/AppRelease.ts`](../packages/shared/metadata/AppRelease.ts),
      the one human-facing identity consumed by both client and server.
- [ ] Add the release's entry to
      [`docs/fluff_release_names.md`](fluff_release_names.md).

> The release workflow repeats the version stamp from the tag as a safeguard. The local
> command includes `apps/site` as well, so every workspace manifest and the packaged
> application version stay aligned before the tag is created.

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

Local packaging of **Keres Server** is `bun run api:build` (same
script the release job runs). It writes `apps/api/dist-server/keres-server/`
and a versioned zip next to it.

Nothing here needs manual intervention unless a job fails.
