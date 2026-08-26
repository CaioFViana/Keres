# Keres testing plan

The plan used to start planning Ouroboros. Not updated at present.

## Goal

To cover logic and data integration without coupling to the environments the monorepo already uses:
Expo/React Native, Elysia/PostgreSQL, Vite/React and Electron.

Out of scope by explicit decision: rendering the client's 60 screens and the admin's 5 pages.
High cost and a high breakage rate on visual changes - a test asserting that a
`<Text>` shows a string breaks on every layout adjustment without ever catching a bug.

The **hooks** (`src/hooks`, 21 files) are the deliberate exception: it is where the screens' logic
lives, and React Native Testing Library's `renderHook` exercises them without rendering anything. A
bug there affects several screens at once.

## On testing React Native components

The tool is `@testing-library/react-native`, which the [Expo
documentation](https://docs.expo.dev/develop/unit-testing/) recommends together with the `jest-expo` this
project already uses. Two points worth recording:

- `react-test-renderer` is **not** an alternative: it does not support React 19, and the client is on 19.1.0.
  RNTL 14 uses the `test-renderer` package in its place, and brings it in as a peer.
- In RNTL 14, `renderHook` returns a **Promise** (as do `rerender` and `unmount`). Without the
  `await`, `result` comes back `undefined` and every test fails with the same misleading message.
- Expo itself advises against snapshots for UI and points at E2E (Maestro) instead. If the
  screens ever need coverage, the way is a handful of critical end-to-end journeys -
  create a story, synchronize, resolve a conflict -, not a test per screen.

## Tools

| Area | Main tool | Scope |
| --- | --- | --- |
| `packages/shared` | Vitest | Schemas, export migrations, metadata and pure utilities. |
| `apps/api` | Vitest | Utilities, config and Elysia routes; integration with a disposable Postgres. |
| `apps/admin` | Vitest | The API layer (axios mocked). |
| `apps/client` | Jest + `jest-expo` + RNTL | Utils, stores, services, a test database in `better-sqlite3` and hooks. |
| `apps/desktop` | Vitest | Utilities and IPC, with Electron mocked. |

The client stays on Jest on purpose: `jest-expo` is the SDK 54's official preset and provides the
`transformIgnorePatterns` for `react-native`'s untranspiled Flow/TS code, besides the mocks
of every native `expo-*` module. Vitest has no official Expo/RN preset.

## Conventions

- Every test lives in `<workspace>/test/`, mirroring `src/`'s structure.
- Tests requiring external infrastructure end in `*.integration.test.ts` and stay out of the default
  command; they run through `bun run test:integration`.

## Commands

```bash
bun run test:report       # an aggregated table: suites, tests and coverage for everything
bun run test              # every unit suite, with no infrastructure
bun run test:integration  # the suites requiring the disposable Postgres
bun run test:all          # both of the above
bun run test:coverage     # the unit ones only, with a coverage report
```

`test:report` includes the API's integration as a row of its own. Without the database up, that row
shows as unavailable and the report stays valid for the rest - missing infrastructure is not a
code failure.

For the integration ones, bring the database up first:

```bash
docker compose -f apps/api/docker-compose.test.yml up -d
```

## Current state

Completed:

1. Separating, in the API, the application's creation (`createApp()`) from the bootstrap effects.
2. Vitest configured in the four workspaces, Jest Expo in the client, a standardised `test/`
   layout and coverage turned on everywhere.
3. Separating unit and integration suites, with `docker-compose.test.yml` and a job
   of its own in CI.
4. `ci.yml` running typecheck, lint and tests on every push and PR; `release.yml` also runs the
   tests before publishing.
5. A sweep of pure logic: the client's utils, shared's schemas/metadata, the API's utils and config,
   the desktop's path resolution.
6. Units with test doubles: `createEntityStore` (the factory of the 17 entity stores), the
   admin's API layer, the desktop's 10 IPC channels with Electron mocked, the client's `apiClient`
   (the per-server token cache, interceptors and refresh on a 401) and `storyTypeConversion`.

7. The API's integration against the disposable Postgres: database and application helpers, and route
   suites for auth, user, story (export/import), sync, story permissions and admin - each
   protected route with its 401 case and, in the panel, its 403.

8. The client's test database in `better-sqlite3` (`test/helpers/testDb.ts`), applying the
   production migrations with no copy, and the suites over it: `OperationLogService`, `syncUtils`
   (the operation log's numbering and the read-only story guard), the sync handlers
   that apply the pull to the local database, and `EntityService`.
9. The `SyncEngineService`'s synchronization cycle against the test database: incremental pull,
   cursor advance, pushing what is pending and what stays out of it.

   The Axios instance is private, but that requires neither a module mock nor a design change: Axios
   resolves the adapter at request time and falls back to `axios.defaults.adapter` when the
   instance has none of its own, and `createKeresAxiosInstance()` never sets one. It is enough for the test
   to assign `axios.defaults.adapter` - it works even for the already-constructed singleton, and the
   interceptors carry on running.
10. The friend routes (the whole friendship and blocking cycle) and the media ones (the gallery's binary channel,
    including the check that the story references the requested hash). The upload uses
    `test/helpers/bunShim.ts`, which supplies the Bun APIs the media layer uses and that do not
    exist in Node.
11. `BaseSyncEntityHandler` against a real database: optimistic concurrency control, the conflict of an
    entity deleted on the server, `operationTime`, an idempotent soft delete, and the queries
    that feed the plan limit and the admin's recovery screen.
12. `StoryExportImportService`: id remapping (and preserving them when sending a
    local story), version and ownership reset, refusing a package of a future format or with a
    dangling reference, and atomicity - an import that fails halfway leaves nothing behind.

13. The client's remaining pure logic, closing the sweep: the two SVG generators that were missing,
    `customAttributeFieldMetadata`, `documentTitle` and the icon tables.

14. Standalone stores and the rest of the client's credential and conflict layer: `appAlert`,
    `connectivity`, `notification`, `syncConflict`, `userSettings`, `resetAllClientStores`,
    `AuthTokenManager`, `TokenVault`, `SyncConflictService` and `favoriteBehaviorUtils`.

15. `MediaSyncService`: media reconciliation, including hash deduplication, the two
    download paths (disk on native, Axios on the web) and the rule of never letting a transfer
    failure bring the cycle down.

16. `downloadAndImportStory` and `uploadNewStoryToServer`: transferring a whole story
    between device and server, including preserving the local id and migrating the
    identity of favourites and comments to the server's account.

17. Coverage thresholds in each workspace, calibrated on the measured values, with CI running
    the suites *with* coverage so the floors are actually enforced.

The roadmap is complete. What was deliberately left out of scope stays out: the
rendering of the React Native screens and components and of the admin's pages.

## Coverage thresholds

Every workspace's floors have a single source of truth in
`scripts/coverage-thresholds.json`; the `coverage.thresholds` (Vitest),
`coverageThreshold` (Jest) and `test-report.mjs` configurations read that file. `apps/api` has two sets:
one in the unit config and another in the integration one, measured separately - the unit one covers only
what runs without a database, so its number is low by construction.

The rule is a **ratchet**: when coverage rises, the floor rises with it in the same change. Each
floor keeps a margin of 3 percentage points below the reference coverage, to absorb
small fluctuations. Lowering it beyond that margin is a conscious decision, not a shortcut to make
CI pass - if coverage fell, either the missing test was not written, or covered code was
removed, and both situations deserve to be said in the commit's description.

After generating LCOV with `bun run test:report`, `bun run coverage:update` recomputes the floors with
that margin and **only raises them**. For a deliberate expansion of the measured scope, lowering requires
the explicit command `bun run coverage:update -- --rebaseline`; even in that mode, it only lowers the
metric whose floor is already above the measured coverage, preserving the others. A single workspace can be
recomputed with `--project client` (or `shared`, `apiUnit`, `apiIntegration`, `apiCombined`,
`admin`, `desktop`, `site`). That way, a drop is not silently accepted by an ordinary run.

### What the client's coverage measures

`jest.config.js` needs `src` in `roots`, and not only `test`. Without that Jest does not scan
`src/`, `collectCoverageFrom` has no effect, and the report measures only the files that
some test already imports - a self-confirming metric. That is how it was here for a while: 136 out of
377 files, showing 42% where the real number was 15%.

`testMatch` was anchored at `test/` precisely because `roots` came to include `src`; a loose glob
would go looking for tests inside the production code.

The Vitest workspaces do not have that problem - the v8 provider already includes untouched
files, and that is why schemas and pages with no test show as 0% in their reports.

The floors only count if the suite runs with coverage, and that is why CI uses
`bun run test:coverage` and `test:integration:coverage` instead of the commands without coverage.

## Rules

- The root command must run every suite without starting development servers.
- API tests never use the development database.
- Native Expo and Electron modules are mocked in unit tests.
- A new test format must enter CI before becoming mandatory for releases.
