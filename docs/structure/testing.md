# Testing

How Keres is tested, what the coverage floors mean and how to add a test. The history of how the repository got here (a September 2026 roadmap with phases) is in git; this document keeps only the rules that are still enforced.

## Running tests

| Command | What it runs |
| --- | --- |
| `bun run test:report` | Every suite, with coverage, and a summary table per workspace. Prefer it over reading the raw output of `bun run test`. |
| `bun run --cwd apps/client test` | The client (Jest). Already limited to two workers and a 512 MB idle limit. |
| `bun run --cwd apps/api test` | API unit tests (Vitest). |
| `bun run --cwd apps/e2e test` | The web client's build in a real browser (Playwright), served like GitHub Pages serves it: boot under the Pages path, the service worker that isolates the page, the WASM SQLite, a first story that survives a reload. Build first: `bun run --cwd apps/client build:pages` with `KERES_WEB_BASE_URL=/Keres/client`; `E2E_CHANNEL=chrome` uses the installed Chrome instead of downloading Chromium. Runs in CI as the `e2e-web` job. |
| `bun run test:sync-fuzz-api` | The client's sync engine against the real API (Postgres up first): three devices edit one story at random and must converge. Runs in CI as the `sync-fuzz` job; `SYNC_FUZZ_SEEDS=200` for a deeper local run. |
| `bun run test:integration` | API integration tests on a real Postgres and a real SQLite. Start the disposable database first: `docker compose -f apps/api/docker-compose.test.yml up -d`. |
| `bun run check` | Formatting and static checks for the whole repository (Biome). |

On a small machine run one workspace at a time and keep the worker count low (`--maxWorkers=2`; for Vitest in `packages/shared`, `NODE_OPTIONS=--max-old-space-size=512`).

Two things that look like failures on such a machine and are not tests failing:

- A client suite reported as "failed to run" with `A jest worker process ... SIGTERM` while every test passes. With `--workerIdleMemoryLimit` Jest restarts a worker that went over the limit, and it can do so while the next file is already running on it; a different file is hit each time and the file passes alone. CI does not set the limit. A suite whose own heap passes the `--max-old-space-size` cap does die for real, with `heap out of memory` in the log: build big inputs smaller (see the byte-cap tests in `publishCompile.test.ts`, which lower the shared cap instead of creating a 100 MB string).
- One `An update to VirtualizedList inside a test was not wrapped in act(...)` per run, in a different list screen each time. It is the list's batching timer firing after the test's last `act`, under load; it does not reproduce running the file alone.

The API figure that counts is the **union** of its unit and integration suites: neither alone is representative (the unit-only file reads far lower), so `coverage-check.ts api` merges both.

## End-to-end

`apps/e2e` is the one place that opens the built client in a browser. It exists for what Jest cannot see by construction, because Jest runs on `better-sqlite3` with the native modules mocked: the bundle under the deploy path, the cross-origin isolation the web SQLite needs, the migrations on the WASM database and persistence across a reload. Each of those has broken a release. It is not where behaviour is tested: a rule that a screen follows belongs in a Jest test, and this folder stays a short list of journeys a person makes.

- The build is not made by the tests: they serve `apps/client/dist-pages` through `apps/e2e/static-server.ts`, which sends **no** COOP/COEP headers, as Pages does, so a failure of the service worker (`public/coi-sw.js`) is not hidden by the server.
- Select by `data-testid` (the client's `testID`) or by role and visible English text; the browser is started in `en-US`.
- A first visit shows a tour over the first screen: dismiss it (`guide-skip`) before acting. Reading the terms and the privacy notice takes about twelve seconds each: wait for the accept button to enable, do not sleep.
- **Building the client for this is heavy** (Metro starts several workers; one local build reached 5 GB). Reuse a `dist-pages` that is already built when the UI has not changed.

## Static checks

| Command | What it catches |
| --- | --- |
| `bun run typecheck` | Type errors in every package and in the repository's own scripts. |
| `bun run lint` | The linter of each package (ESLint for the client and the admin panel, Biome elsewhere). |
| `bun run check` | Formatting for the whole repository, and the Biome rules where they are enabled. |
| `bun run docs:audit` | A path in backticks or a relative link in `README.md`, `CONTRIBUTING.md`, `docs/` (history in `docs/decisions/` and `docs/extras/` aside) and the workspaces' READMEs that points at a file or folder that no longer exists. Run in CI next to `knip`. |
| `bun run knip` | Unused files, exports and types; dependencies that are used but not declared (or declared and not used); binaries nobody declared. Configured in `knip.json` and run in CI. |

Read a `knip` finding as a question, not an order. It does not see code that is loaded by name or by path, so check with `grep` before deleting anything. The exceptions in `knip.json` are the cases it cannot see, each with its reason:

- `apps/client/test/helpers/detailTabsMock.tsx` is loaded by `require()` inside `jest.mock` factories of four screen tests.
- `ignoreUnresolved: test/syncFuzz/server.ts` is a path `scripts/sync-fuzz-api.ts` hands to `bun` with `apps/api` as the working directory.
- `expo-updates` is inferred by the Expo plugin; the app does not use over-the-air updates and does not declare it.
- `rules.duplicates` is off: a module that exports the same thing by name and as default (the electron-builder hook does) is a style choice, not a defect.
- Entry points are listed per workspace (scripts called by workflows, test setup, generated registries); a new one that nothing imports goes there.

## What to test first: the ranking

A module is ranked by three questions, not by how much code it is:

1. **Blast radius** - if this is wrong, does the writer lose data, or does a pixel move?
2. **Silence** - does the failure announce itself? A crash on a form screen is reported in a minute. A field silently dropped from an export is found months later, when the backup is needed. Silent failures rank above loud ones at the same blast radius.
3. **Reachability by other means** - is it already guarded by types, an architecture test or the server refusing the request? Code with a second line of defence ranks lower.

| Rank | Kind of code | Why |
| --- | --- | --- |
| 0 | Sync engine, conflict resolution, sync handlers (both sides) | The only code that can destroy work the user already saved, on a machine they are not looking at. |
| 1 | Export/import, story-management services | They write the writer's data, and a dropped field is a valid payload. |
| 2 | Permissions, tier limits, auth, token vault, media transfer | Wrong answers are silent too, but the server is a second line of defence for most. |
| 3 | Hooks, stores, navigation | Screen logic without the screen; cheap to test with `renderHook`. |
| 4 | Components that write | A form that saves the wrong value is a rank-1 failure in a rank-5 costume. |
| 5 | Components and screens that display | Loud failures, expensive tests, high churn against UI changes. |
| 6 | Bootstrap, entry points, config | Fails instantly and visibly on every run. |

## The ratchet

Coverage floors cannot fall back:

- Floors live in `scripts/coverage-thresholds.json`, read by every Vitest config, the Jest config and `scripts/test-report.ts`.
- Each floor keeps a 3-point margin under the measured value.
- `bun run coverage:update` recomputes the floors and **only raises them**.
- Lowering one requires `bun run coverage:update -- --rebaseline` and a sentence in the commit message saying whether a test was not written or covered code was removed.
- A change is not done because tests were written; it is done because the floor cannot fall back.

### Scoped floors

One global floor per workspace cannot say "sync is held to a higher standard", so `scripts/coverage-check.ts` also enforces floors for named scopes after the ordinary reports are generated (`coverage-check.ts client`, `coverage-check.ts api`). In lines, today:

| Scope | Floor |
| --- | ---: |
| Client (whole) | 90.3% |
| Client sync core | 95.7% |
| Client sync handlers | 97% |
| Client story services | 94.4% |
| API combined (unit + integration) | 89.5% |
| API sync core | 97% |
| API sync handlers | 96.2% |
| API export/import | 97% |
| Shared | 93.2% |
| Admin | 96.8% |
| Desktop | 95.3% |
| Site | 96.2% |

The file is the source of truth; this table is a snapshot of 2026-10-20.

## Permanently excluded - and why

100% is the north star; these are the things it will never include. Each exclusion is a decision to be re-argued, not a fact.

| Excluded | Reason |
| --- | --- |
| `apps/client/src/db/migrations/**` and other generated registries | Generated by `apps/client/scripts/generate-indexes.ts`; `test/db/` already asserts the migrations apply and produce the expected tables. |
| Example-story, help and story-device content | Static data and prose. The example-story test validates structure, ids and referential integrity; line coverage of a data file means nothing. |
| `**/locales/*.json` | Audited by `scripts/verify-translations.ts` (`bun run locales:audit`), which is the right tool. |
| Entry points (`main.tsx`, `launcher.ts`, `server.ts`, `boot.ts`) | One statement calling one function; failure is immediate and total on every run. |
| Style-only modules (`commonStyles.ts`, `*Styles.ts`) | Assertion targets are pixel values with no behaviour. A style contract that has already regressed earns a test by having failed. |
| Drizzle relation callbacks in `db/schema/**` | Declarative wiring executed lazily; a wrong relation fails loudly on the first query, and the integration suite issues those queries. |

Everything else uncovered is debt, not an exclusion.

## Conventions for new tests

Reuse the infrastructure that exists rather than inventing.

- **Test names in English**, like the rest of the repository. A test mirrors its source: `src/hooks/story/useStoryArcs.ts` is tested by `test/hooks/story/useStoryArcs.test.ts`. API tests that need a database end in `.integration.test.ts`.
- **Client, anything touching the database:** `apps/client/test/helpers/testDb.ts` - a real `better-sqlite3` instance running the production migrations. Never mock the database.
- **Client, module mocks:** `__esModule: true` and a self-sufficient factory that reads nothing from the file's scope. `jest.mock` is hoisted above `const` declarations, so a factory that references an outer variable captures `undefined`. See `apps/client/test/services/media/MediaSyncService.test.ts`.
- **Client, hooks:** `renderHook` from React Native Testing Library returns a **Promise** - `await` it, or `result` is `undefined` and every assertion fails with the same misleading message. The same goes for `render`.
- **Client, console output of an intentional failure path:** wrap the test in `withSilencedConsole` (`apps/client/test/helpers/silenceConsole.ts`) instead of letting it clutter the run.
- **Client, HTTP:** assign `axios.defaults.adapter`; no module mock and no seam in the service.
- **API, anything touching the database:** the integration helpers and the disposable Postgres. Unit tests that mock the ORM prove nothing about a query.
- **API, Bun-only APIs in Node:** `apps/api/test/helpers/bunShim.ts`.
- **Sync:** a new synchronizable type must be modelled in the convergence fuzz (`apps/client/test/helpers/syncFuzz*.ts`); a test fails when one is not.
- **Architecture rules:** suites in `test/architecture/` enforce layering, import boundaries, import style, the 600-line file ceiling and entity completeness. The admin panel and the landing site have their own `test/architecture/layering.test.ts`: each folder of `src/` is a layer and imports only the layers below it in the list at the top of the test, one admin page does not import another, and the network is touched only in an `api` folder. A new violation is a test failure, not a review comment - extend those suites rather than writing a new guard.
