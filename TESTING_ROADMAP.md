# Keres testing roadmap

The goal is a repository where every line that can break a writer's work is covered by a test.
100% is the north star, not the schedule: this document orders the work so that the code whose
failure is **silent and destructive** is covered first, and the code whose failure is **loud and
cosmetic** is covered last — or deliberately never.

It supersedes [`docs/finished_planning/TESTING_PLAN.md`](docs/finished_planning/TESTING_PLAN.md),
which is the archived plan that got the repository to its current state. That plan explicitly put
React Native screens and admin pages **out of scope**. This roadmap reverses that decision, but only
at Phases 4 and 5, and states the price openly (§9).

---

## 1. How to reproduce these numbers

```bash
bun run test:report
```

That writes an LCOV file per workspace:

| Workspace | LCOV path |
| --- | --- |
| `packages/shared` | `packages/shared/coverage/lcov.info` |
| `apps/client` | `apps/client/coverage/lcov.info` |
| `apps/api` (unit) | `apps/api/coverage/lcov.info` |
| `apps/admin` | `apps/admin/coverage/lcov.info` |
| `apps/desktop` | `apps/desktop/coverage/lcov.info` |
| `apps/site` | `apps/site/coverage/lcov.info` |

The API needs a second run for the real figure, because its unit and integration suites are measured
separately and neither is representative on its own:

```bash
docker compose -f apps/api/docker-compose.test.yml up -d
bun run --cwd apps/api test:integration:coverage
```

That writes `apps/api/coverage-integration/lcov.info`. **Every API number in this document is the
line-level union of the two runs** (80.2%), not either file alone — the unit-only file reads 14% and
would send the roadmap chasing the wrong modules.

Figures are **lines** unless a table says otherwise. Sync-related sections also quote **branches**,
which is the gate that matters there (§3.1) — the `BRDA` records of the same LCOV files.

---

## 2. Baseline

### 2.1 Per workspace

| Workspace | Files | Lines | Covered | Coverage | Threshold floor |
| --- | ---: | ---: | ---: | ---: | ---: |
| `apps/site` | 15 | 136 | 135 | **99.3%** | 90% |
| `apps/desktop` | 4 | 232 | 228 | **98.3%** | 95% |
| `packages/shared` | 102 | 622 | 586 | **94.2%** | 93% |
| `apps/api` (unit ∪ integration) | 152 | 4,328 | 3,469 | **80.2%** | 78% |
| `apps/admin` | 46 | 854 | 634 | **74.2%** | 70% |
| `apps/client` | 687 | 19,428 | 6,945 | **35.7%** | 34% |
| **Measured total** | **1,006** | **25,600** | **11,997** | **46.9%** | — |

264 suites, 2,738 tests today.

The client is 76% of the measured code and 87% of the uncovered code. Any roadmap that is not mostly
about `apps/client` is a roadmap about the wrong repository.

### 2.2 Unmeasured code

`packages/shared/vitest.config.ts` restricts `coverage.include` to
`entities/**`, `metadata/**`, `schemas/**`, `utils/**`, `index.ts`. That leaves out:

| Area | Executable lines | Measured coverage |
| --- | ---: | ---: |
| `packages/shared/graphs/**` + `rules/**` | 1,293 | **not measured** (6.3% when forced) |

This is not untested code — 13 test files exercise most of it — but the tests live in
`apps/client/test/utils/` and count toward no coverage report at all, since the client's
`collectCoverageFrom` is `src/**`. `storyGraphLayout.ts` alone is 895 lines of geometry with a real
test suite that no threshold protects.

**The true repository denominator is 26,893 lines and the true baseline is 44.9%**, not 46.9%.
Phase 0 exists to fix that.

### 2.3 The client, by area

| Area | Files | Lines | Uncovered | Coverage |
| --- | ---: | ---: | ---: | ---: |
| `src/screens` | 72 | 7,373 | 7,330 | **0.6%** |
| `src/services` | 96 | 6,131 | 1,648 | 73.1% |
| `src/components` | 141 | 3,189 | 2,851 | **10.6%** |
| `src/hooks` | 28 | 894 | 221 | 75.3% |
| `src/utils` | 27 | 645 | 53 | 91.8% |
| `src/state` | 23 | 296 | 94 | 68.2% |
| `src/navigation` | 8 | 266 | 92 | 65.4% |
| `src/theme` | 5 | 108 | 98 | 9.3% |
| `src/db` | 43 | 97 | 19 | 80.4% |
| `src/help` + `src/storyDevices` (content) | 239 | 294 | 0 | 100% |
| `src/showcase`, `src/testing` | 3 | 81 | 77 | 4.9% |

69 of 72 screen files and 106 of 141 component files are at exactly 0%.

---

## 3. What "critical" means here

A module is ranked by three questions, not by how much code it is:

1. **Blast radius** — if this is wrong, does the writer lose data, or does a pixel move?
   Losing a chapter is unrecoverable; a misaligned pill is not.
2. **Silence** — does the failure announce itself? A crash on a form screen is reported in a
   minute. A field silently dropped from an export is found months later, when the backup is needed.
   Silent failures rank above loud ones **at the same blast radius**.
3. **Reachability by other means** — is it already guarded by types, by an architecture test, or by
   the server refusing the request? Code with a second line of defence ranks lower.

Applying that, in descending order:

| Rank | Kind of code | Why |
| --- | --- | --- |
| **0** | Sync engine, conflict resolution, sync handlers (both sides) | The only code in the repository that can destroy work the user already saved, on a machine they are not looking at. Everything else fails in front of somebody. See §3.1. |
| **1** | Export/import, story-management services | They write the writer's data. Failures are silent by construction: a dropped field is a valid payload. The export bug (choice checks/groups/effects missing from the client export for years, schema-valid the whole time) is the reference case. |
| **2** | Permissions, tier limits, auth, token vault, media transfer | Wrong answers are silent too, but the server is a second line of defence for most of them. |
| **3** | Hooks, stores, navigation | Screen logic without the screen. One bug hits many screens at once, and it is cheap to test with `renderHook`. |
| **4** | Components that write | A form that saves the wrong value is a rank-1 failure wearing a rank-5 costume. |
| **5** | Components and screens that display | Loud failures, expensive tests, high churn against UI changes. |
| **6** | Bootstrap, entry points, config | Fails instantly and visibly on every run. |
| **—** | Generated files, content, locales | Nothing to assert that the generator/test of the generator does not already assert. |

### 3.1 Why sync sits alone at rank 0, and why lines are the wrong gate for it

Sync is the only subsystem where a bug is **retroactive, remote and silent at once**: a wrong OCC
base or a mishandled `deleted_on_server` does not corrupt the screen in front of the writer, it
overwrites a chapter on the phone they left at home, hours later, with no error anywhere.

Conflict resolution is worse than the rest of sync, because it is **almost entirely branches**.
Every conflict reason, every resolution the user picks, every merge decision is a fork — not a line
of straight-line code. Line coverage therefore flatters it badly. The measured gap:

| File | Lines | **Branches** | Branches missed |
| --- | ---: | ---: | ---: |
| `client/services/SyncEngineService.ts` | 72.1% | **51.4%** | **177 of 364** |
| `client/services/EntityService.ts` | 61.2% | **39.4%** | **188 of 310** |
| `api/services/SyncService.ts` | 78.0% | 66.2% | 69 of 204 |
| `api/services/StoryExportImportService.ts` | 88.3% | 77.5% | 55 of 244 |
| `api/services/entity-sync-handlers/BaseSyncEntityHandler.ts` | 87.0% | 74.7% | 24 of 95 |
| `client/services/SyncConflictService.ts` | 92.9% | 73.4% | 34 of 128 |
| `client/services/ConflictSummaryService.ts` | 82.2% | 79.3% | 19 of 92 |
| `api/services/TierEnforcementService.ts` | 50.0% | **32.6%** | 29 of 43 |

By group:

| Group | Lines | Functions | **Branches** |
| --- | ---: | ---: | ---: |
| client sync engine + conflicts | 81.3% | 91.2% | **64.1%** |
| client sync handlers | 73.4% | 81.3% | **56.7%** |
| client story services | 71.2% | 77.7% | **48.7%** |
| api sync service + handlers | 76.3% | 86.8% | **59.8%** |
| api export/import | 88.3% | 97.3% | 77.5% |
| api permissions + tier | 70.7% | 54.2% | **53.3%** |

`SyncEngineService` at 72% lines with **half its branches never taken** is the single worst number
in the repository for critical code, and it is invisible in every headline figure.

**The conflict matrix is barely sampled.** `ConflictResolution` is a five-value union
(`packages/shared` → `syncConflicts` DB enum → the review sheet's buttons). Test files naming each
value today:

| Resolution | Test files that exercise it |
| --- | ---: |
| `merge` | 1 |
| `keep_local` | **0** |
| `keep_server` | **0** |
| `restore` | **0** |
| `discard` | **0** |

Four of the five buttons a writer can press to save their own work have no test anywhere. That is
the concrete reason sync gets its own phase, a branch gate, and a target above everything else.

---

## 4. Phase 0 — make the number honest

Nothing else in this roadmap is trustworthy until the denominator is.

- [ ] **Add `graphs/**` and `rules/**` to `coverage.include` in `packages/shared/vitest.config.ts`.**
- [ ] **Move the 12 graph test files** from `apps/client/test/utils/` to `packages/shared/test/graphs/`:
      `characterRelationGraphLayout`, `characterRelationGraphSvg`, `graphSvgExports`,
      `locationGraphLayout`, `presenceMatrixLayout`, `presenceMatrixSvg`, `statLadder`,
      `statLadderBarLayout`, `statRadarLayout`, `statRadarSvg`, `storyGraphLayout`,
      `storyTimelineLayout`. All 12 import only from `@keres/shared/graphs/*` — verified, the move is
      a rename plus a Jest→Vitest import swap. `statRanking.test.ts` and `statValues.test.ts` stay in
      the client: they test `src/utils/`.
- [ ] **Write the two missing graph suites**: `storyTimelineSvg.ts` (110 lines, 0%) and
      `graphLayoutDirection.ts` (6 lines, 0%).
- [ ] **Re-baseline `scripts/coverage-thresholds.json`** with
      `bun run coverage:update -- --rebaseline --project shared` once the move lands. The shared
      floor will move down in absolute terms and that is correct — it will finally be measuring
      3× more code.
- [ ] **Make the API's combined figure a first-class command.** `test:report` already prints a
      combined row; add a documented way to produce the merged LCOV so this roadmap can be
      re-measured without the manual union step described in §1.
- [ ] **Decide `apps/client/src/db/migrations/**`.** It is excluded from `collectCoverageFrom` today
      and the exclusion is right (generated), but `test/db/` already asserts the migrations run.
      Record the decision in §10 rather than leaving it implicit in a glob.

**Definition of done:** `bun run test:report` prints one number per workspace that covers every
non-excluded production file, and §10 of this document lists every exclusion with a reason.

---

## 5. Phase 1 — the data-integrity core

The single most valuable phase. 5,194 client lines and 1,731 API lines, of which 1,448 are
uncovered. It runs in two halves, and **1A comes first**.

| Half | Scope | Line target | **Branch target** |
| --- | --- | ---: | ---: |
| **1A** | Sync engine, conflict resolution, sync handlers (client + API), `SyncService`, `BaseSyncEntityHandler` | **97%** | **90%** |
| **1B** | Story-management services, export/import, permissions, tier | 95% | 80% |

The branch target is the real gate for 1A. A file may sit at 97% lines with a third of its conflict
paths never executed — that is exactly today's situation (§3.1), and a line-only floor would let it
persist through the whole roadmap.

### 5.0 Phase 1A.0 — split the two files that cannot be tested as they are

`SyncEngineService.ts` is **1,605 physical lines** and `EntityService.ts` is **1,219** — 2.7× and 2×
the 600-line ceiling that `test/architecture/layering.test.ts` enforces. Both are on the shrink-only
allowlist, and they are also the two worst branch numbers in the repository. That is not a
coincidence: `performSync` alone is a **384-line method** (lines 613–997), and a 384-line method is
reached by a test only through the front door, which is why 177 of its branches have never run.

Splitting is a **prerequisite** for Phase 1A, not a follow-up refactor. The seams are already visible
in the file's own structure:

| New module | Moves | Why it is a seam |
| --- | --- | --- |
| `sync/SyncScheduler` | `startSync`, `requestSync`, `runExclusiveSync`, `stopSync`, `performTrackedSync`, `waitForSyncIdle` | Already tested in isolation with `performSync` mocked — the test exists, the module does not. |
| `sync/SyncPull` | the pull half of `performSync`, `protectRemoteUpdate`, `isOwnEchoedOperation`, `applyRemoteCreate`, `recordRemoteOperationLocally`, `reconcileRemoteUpdate`, `reconcileRemoteReorder` | The reconcile functions are pure decisions over `(local, remote, changedFields)` once separated from the loop. This is where the merge-vs-conflict branches live. |
| `sync/SyncPush` | `pushPendingOperations`, `buildStoryUpdateFromLocalOp`, `getPushableOperations`, `getPendingOperationsByEntity`, `rebasePendingOperations`, `applyPushResult`, `deriveBaseVersion` | Batch slicing, OCC base derivation and `applied`/`conflicts` handling — testable against a fixture response with no network at all. |
| `sync/StoryTransfer` | `fetchServerStoryPreviews`, `downloadAndImportStory`, `uploadNewStoryToServer` | ~200 lines that already have their own suite (`SyncEngineTransfer.test.ts`) and nothing to do with the cycle. |

`SyncEngineService` keeps the singleton, `configure`, `setDbInstance`, `reset` and handler
registration, and orchestrates the four. Every extracted module drops off the ceiling allowlist —
`toEqual` in the architecture test enforces that the names are removed, so the split is verified by
the suite that already exists.

Do the same for `EntityService.ts` (1,219 lines, 39.4% branches): `getEntityIdentifier` /
`_resolveRelationEntityName` is a switch over every entity type and belongs in its own module beside
`EntityNameBatchResolver`, which already solves the batch half of the same problem.

- [ ] Extract the four sync modules; allowlist entries for `SyncEngineService.ts` removed.
- [ ] Extract the entity-name resolution from `EntityService.ts`; allowlist entry removed.
- [ ] **Add a line ceiling to `apps/api/test/architecture/layering.test.ts`.** The client has one; the
      API does not, and `StoryExportImportService.ts` (1,211 lines) and `SyncService.ts` (1,002) sit
      unguarded above it.

### 5.1 Phase 1A.1 — the conflict matrix

This is the specification for the tests, not a suggestion. Six reasons × five resolutions × four
operation types, minus the invalid combinations:

**Reasons** (`SyncConflictReason`): `version_conflict`, `deleted_on_server`, `concurrent_edit`,
`validation`, `unauthorized`, `unknown`.
**Resolutions** (`ConflictResolution`): `keep_local`, `keep_server`, `merge`, `restore`, `discard`.
**Operation types**: `create`, `update`, `delete`, `reorder`.

Each cell that is reachable needs a test asserting **four** things, not one:

1. the local row after resolution;
2. the operation log after resolution — `conflicted` → `resolved` or `abandoned`, and any new
   operation the resolution enqueues;
3. that the resolved operation is (or is not) in the next push;
4. that the conflict row is gone and `sync_conflicts_changed` fired.

The cells that must not be skipped, because each one has burned somebody in a real product:

- `deleted_on_server` + `restore` — the entity is re-created from the local snapshot with a new base
  version. `serverValues` is only `{isDeleted, version}` by design, so the name and the relation ids
  have to come from the local row; `ConflictSummaryService` already carries a regression test for
  the *display* half of this, and none for the *write* half.
- `deleted_on_server` + `discard` — the local edit is abandoned and must never be resent.
- `version_conflict` + `merge` with disjoint `changedFields` — silent rebase, no user prompt.
- `version_conflict` + `merge` where both sides wrote the **same value** — must not present as a
  conflict at all (there is a regression test for this in `SyncEngineService.test.ts`; it needs to
  survive the split).
- `concurrent_edit` + `keep_local` — the local operation is rebased onto the server's version and
  goes out on the next cycle.
- `concurrent_edit` + `keep_server` — the local operation is abandoned, and the pull's value is
  applied.
- `reorder` + `keep_local` — the whole order is the disputed value; only the pending reorder's base
  moves. Reorder is the one op type where field-level merge is meaningless.
- `validation` / `unauthorized` — **not user-resolvable**. The test asserts the operation stays out
  of the push forever and the message from the server reaches the screen, rather than a dead end.
- A conflicted entity blocks *its own* later operations in the same batch (`blockedEntities`) and
  **does not** block the rest of the story.

### 5.2 Phase 1A.2 — the cycle itself

Branch-level coverage of the extracted modules:

- **Pull:** page until incomplete; the cursor advances only to the last **applied** operation; a
  failure mid-page stops on that operation and does not skip it; an own echoed operation is
  recognised and not re-applied; an out-of-order pull (update before create) is idempotent.
- **Push:** batches of 200 in `operationVersion` order; `applied` vs `conflicts` processed before the
  next batch; no progress in a batch stops the loop; a local update with no `version` is skipped and
  does not poison the batch.
- **Scheduler:** timer and `requestSync` share one lock, cycles never overlap; the offline retry
  cadence vs the normal cadence; `startSync` is a no-op while running.
- **API side:** per handler, the OCC base check (equal / stale / missing), the entity-specific
  `SyncConflictError` (duplicate `StatStrength` floor, duplicate `StatRelation` triple, the 13th
  primary `Stat`, the duplicate `LocationRelation` pair), owner-only policy fields rejected for a
  writer, and the idempotent resend.

Client sync handlers below 85% lines today:

| File | Lines | Coverage |
| --- | ---: | ---: |
| `StatClientSyncHandler.ts` | 36 | 16.7% |
| `SuggestionClientSyncHandler.ts` | 16 | 18.8% |
| `PlotSceneClientSyncHandler.ts` | 15 | 20.0% |
| `PlotClientSyncHandler.ts` | 14 | 21.4% |
| `LocationRelationClientSyncHandler.ts` | 66 | 51.5% |
| `GalleryClientSyncHandler.ts` | 29 | 62.1% |
| `GalleryRelationClientSyncHandler.ts` | 27 | 63.0% |
| `ChoiceCheckClientSyncHandler.ts` | 28 | 75.0% |
| `ChoiceCheckGroupClientSyncHandler.ts` | 28 | 75.0% |
| `ItemJourneyClientSyncHandler.ts` | 28 | 75.0% |

API sync handlers below 85% lines after the unit ∪ integration union:

| File | Lines | Coverage |
| --- | ---: | ---: |
| `PlotSceneSyncHandler.ts` | 18 | 11.1% |
| `PlotSyncHandler.ts` | 14 | 14.3% |
| `FavoriteSyncHandler.ts` | 18 | 44.4% |
| `ChoiceCheckSyncHandler.ts` | 27 | 51.9% |
| `SeeAlsoRelationSyncHandler.ts` | 44 | 52.3% |
| `ChoiceCheckGroupSyncHandler.ts` | 17 | 58.8% |
| `CharacterSceneSyncHandler.ts` | 21 | 61.9% |
| `StatRelationSyncHandler.ts` | 33 | 63.6% |
| `StorySyncHandler.ts` | 55 | 63.6% |
| `EffectSyncHandler.ts` | 17 | 64.7% |
| `ModeSyncHandler.ts` | 15 | 66.7% |
| `GallerySyncHandler.ts` | 27 | 70.4% |
| `NoteRelationSyncHandler.ts` | 42 | 71.4% |
| `SceneSyncHandler.ts` | 33 | 72.7% |

**Definition of done for Phase 1A:** the sync surface at ≥97% lines **and ≥90% branches**, every
reachable cell of the conflict matrix has a test, `SyncEngineService.ts` and `EntityService.ts` are
off the ceiling allowlist, and the per-directory floors of §12 are in place so none of it can slide
back.

### 5.3 Phase 1B — story-management services

40 files, 3,070 lines, 71.2%. Three are at zero and they are not small:

| File | Lines | Coverage |
| --- | ---: | ---: |
| `StatStrengthService.ts` | 63 | **0%** |
| `StatService.ts` | 59 | **0%** |
| `ModeService.ts` | 35 | **0%** |
| `CharacterRelationService.ts` | 107 | 38.3% |
| `CharacterSceneService.ts` | 72 | 51.4% |
| `LocationService.ts` | 127 | 53.5% |
| `CharacterService.ts` | 122 | 54.9% |
| `NoteService.ts` | 109 | 55.0% |
| `ChapterService.ts` | 109 | 56.0% |
| `WorldRuleService.ts` | 111 | 59.5% |
| `SceneService.ts` | 150 | 60.0% |
| `ItemService.ts` | 78 | 62.8% |
| `GlobalSearchService.ts` | 119 | 66.4% |
| `ChoiceService.ts` | 74 | 70.3% |
| `TagService.ts` | 79 | 73.4% |
| `NoteRelationService.ts` | 67 | 74.6% |
| `StorySchemaFieldService.ts` | 64 | 75.0% |
| `GalleryService.ts` | 90 | 76.7% |
| `CommentService.ts` | 45 | 77.8% |
| `LocationRelationService.ts` | 79 | 79.7% |

These are the highest-value tests in the repository and the cheapest to write: `test/helpers/testDb.ts`
already gives a real SQLite database with the production migrations applied. The pattern exists in
`test/services/` — 59 suites — so a new service suite is copy, adapt, assert.

What each suite must cover, beyond happy-path CRUD:

- the **operation log entry** the mutation records (entity, type, resulting version, payload shape);
- **soft delete** and its cascade (`LocationService` deleting `LocationRelation` rows,
  `StorySchemaFieldService` deleting `AttributeValue` rows) — each cascade producing its **own**
  logged operation, not a raw SQL mutation;
- **index renumbering** invariants (`SceneService.renumber`, `ChapterService`) — 1..N with no holes,
  since the API refuses anything else;
- the **read-only story guard** and the owner-only field guard;
- the shared rules in `@keres/shared/rules` being applied and not reimplemented.

### 5.4 Phase 1B — export/import, permissions, tier

| File | Lines | Coverage | Branches |
| --- | ---: | ---: | ---: |
| `api/StoryExportImportService.ts` | 410 | 88.3% | 77.5% |
| `api/StoryPermissionService.ts` | 68 | 85.3% | 81.2% |
| `api/TierEnforcementService.ts` | 48 | **50.0%** | **32.6%** |

`StoryExportImportService` needs its refusal branches: a package of a future format version, a
dangling reference, a failure mid-import leaving nothing behind, and the id remap for `ENTITY`
custom attributes (the one place an `AttributeValue.value` is an id and not opaque text).

`TierEnforcementService` at 32.6% branches is a rank-2 file sitting inside a rank-0 phase because
sync calls it: a tier limit hit during a push is a conflict path like any other, and today most of
its decisions have never run.

**Definition of done for Phase 1:** 1A at ≥97% lines / ≥90% branches, 1B at ≥95% lines / ≥80%
branches, per-directory floors in place, thresholds ratcheted; client at ~41.8%, API at ~86.6%,
repository at ~51.4%.

---

## 6. Phase 2 — account, permission, money, media (rank 2)

937 client lines and 1,433 API lines. Target: **90%** client, **95%** API.

### 6.1 Client

| File | Lines | Coverage |
| --- | ---: | ---: |
| `FriendshipApiService.ts` | 28 | 39.3% |
| `PublicationApiService.ts` | 14 | 42.9% |
| `FriendshipService.ts` | 133 | 53.4% |
| `UserApiService.ts` | 24 | 58.3% |
| `webMediaStore.ts` | 96 | 72.9% |
| `MediaFileService.ts` | 117 | 73.5% |
| `ClientSettingsService.ts` | 17 | 76.5% |
| `AuthTokenManager.ts` | 80 | 78.8% |
| `ServerRealtimeService.ts` | 79 | 75.9% |
| `StoryPermissionService.ts` | 10 | 80.0% |

`AuthTokenManager` and `TokenVault` already have the two tests that matter (a refresh landing on the
wrong server, a network failure not clearing credentials); what is missing is the rest of the
surface. `MediaFileService`/`webMediaStore` need the native-vs-web split covered on both sides.

### 6.2 API

33 files, 1,433 lines, 85.3%. The route modules and the account services:

| Area | Lines | Coverage |
| --- | ---: | ---: |
| `src/modules/admin` (7 files) | 163 | 74.8% |
| `src/modules/user` | 75 | 70.7% |
| `src/modules/webSocket` | 13 | 38.5% |
| `src/modules/public` | 88 | 81.8% |
| `src/modules/auth` | 107 | 85.0% |
| `UserService.ts` | 37 | 73.0% |
| `AdminUserService.ts` | 65 | 86.2% |
| `AdminRecoveryService.ts` | 67 | 86.6% |
| `ApiLogService.ts` | 14 | 50.0% |
| `MediaStorageConfigurationService.ts` | 23 | (unit 0%) |

Every protected route already has its 401/403 case; the gap is the **error branches** — a refused
registration, a tier limit hit mid-request, a recovery code consumed twice, a storage backend that
answers with an error.

**Definition of done:** repository at ~53.6%.

---

## 7. Phase 3 — screen logic without screens (rank 3)

1,456 client lines across hooks, stores and navigation, 72.0%. Target: **90%**.

| File | Lines | Coverage |
| --- | ---: | ---: |
| `hooks/useStoryPlots.ts` | 43 | **0%** |
| `hooks/useStoryStats.ts` | 30 | **0%** |
| `hooks/useHasRegisteredServer.ts` | 18 | **0%** |
| `hooks/useChapterNames.ts` | 17 | **0%** |
| `hooks/useOpenPresenceMatrixViewer.ts` | 9 | **0%** |
| `hooks/useUserDisplayName.ts` | 59 | 55.9% |
| `hooks/useSeeAlsoRelations.ts` | 51 | 66.7% |
| `state/themeStore.ts` | 10 | **0%** |
| `state/presenceMatrixViewerStore.ts` | 6 | **0%** |
| `state/chapterStore.ts` | 19 | 10.5% |
| `state/sceneStore.ts` | 19 | 10.5% |
| `state/storyListStore.ts` | 17 | 11.8% |
| `state/*Store.ts` (7 factory-built) | 3 each | 33.3% |
| `navigation/MainSystemStack.tsx` | 148 | 65.5% |
| `navigation/StorySelectionStack.tsx` | 67 | 67.2% |

This phase is cheap and disproportionately useful: `renderHook` needs no rendering, 23 hook suites
already exist as the pattern, and `useStoryPlots`/`useStoryStats` are the single query behind five
screens each.

The 7 factory-built stores at 33.3% are a measurement artefact — `createEntityStore` is at 91.9% and
the per-entity files are three lines of wiring. Cover them with one parameterised suite asserting the
wiring (collection key, service factory, fetch), not seven copies.

`MainSystemStack` deserves real tests for the drawer rules that already regressed once: the
`drawerItemPress` stack reset, the Plots stack appearing only for linear stories, the stats drawer
following `Story.statSystem`.

**Definition of done:** repository at ~54.6%.

---

## 8. Phase 4 — components (rank 4 then 5)

141 files, 3,189 lines, 10.6%. Target: **80%**. This is where RNTL enters at scale, and where the
archived plan's exclusion is reversed. Split it in two, because the halves have very different value.

### 8.1 Phase 4a — components that write (rank 4)

Anything that produces a value the user then saves. A bug here is a rank-1 data failure.

| Area | Files | Lines | Coverage |
| --- | ---: | ---: | ---: |
| `common/inputs` | 14 | 537 | 37.8% |
| `common/forms` (custom attributes) | — | — | partial |
| `features/relations` | 11 | 245 | **0.4%** |
| `features/stats` (value editors) | 5 | 148 | **0%** |

Four component suites already exist (`MultiSelectPill`, `DatePickerModal`, `SuggestionListInput`,
`RelatedEntitiesList`) and both regression tests in them found real bugs — the pill height/centering
and the `padStart` hour field that made "19" impossible to type. That is the argument for 4a.

Assert **emitted values and callbacks**, never rendered geometry. `MultiSelectPill`'s spacing tests
are the exception that proves the rule: they assert a style contract that had already broken twice.

### 8.2 Phase 4b — components that display (rank 5)

| Area | Files | Lines | Coverage |
| --- | ---: | ---: | ---: |
| `features/list-items` | 16 | 182 | **0%** |
| `features/presence-matrix` | 3 | 206 | **0%** |
| `features/media` | 3 | 142 | **0%** |
| `common/lists` | 7 | 146 | 11.6% |
| `features/app` | 3 | 175 | **0%** |
| `features/graphs` | — | — | **0%** |

Lower value, and the first place to stop if the effort is not paying. `features/app` (SyncInitializer
and friends) is the exception inside 4b — it is orchestration, not display, and belongs closer to
Phase 3 in priority.

**Definition of done:** repository at ~63.2%.

---

## 9. Phase 5 — screens (rank 5)

72 files, 7,373 lines, 0.6%. Target: **70%** — deliberately not 95%.

This is 29% of the repository's lines and the reason the archived plan excluded it: a test asserting
that a `<Text>` shows a string breaks on every layout change without ever catching a bug. That
argument is still correct for *display* assertions. It is not correct for *behaviour*.

Order within the phase, by what a failure costs:

1. **Form screens** — they write. `SceneFormScreen` (609 lines with its sibling), `CharacterFormScreen`
   (215), `LocationFormScreen` (197), `ChoiceFormScreen`, `ItemJourneyFormScreen` (126),
   `StoryFormScreen`. Assert the **pending-relation replay** (the `''` placeholder swapped for the
   real id after the main save) — it exists in four screens and is invisible to types.
2. **Settings and destructive screens** — `StorySettingsScreen` (299 lines, 0%): type conversion,
   unlink from server, delete. Every one of them has a documented side effect that the screen, not
   the service, is responsible for sequencing.
3. **`enterstack`** (13 files, 1,296 lines, 0.2%) — `ServerRegistrationScreen` (226),
   `PublishStoryScreen` (136), `ChangePasswordScreen`, `StorySelectionScreen`. Account and
   publication flows: irreversible, and outside the story's undo.
4. **Detail screens** — read-only. `CharacterDetailScreen` (271), `LocationDetailsScreen` (229).
   Assert that the field resolves and navigates, not how it looks.
5. **List screens** — the thinnest, all built on `GenericFilterSortList` and
   `useEntityListScreen` (already covered). One representative suite plus per-screen smoke, not 20
   full suites.

Rules that keep this phase from becoming a maintenance tax:

- assert **behaviour and emitted calls**, never text content that is a translation key away from
  changing;
- query by `testID`, never by rendered string;
- one suite per screen, not one per visual state;
- if a screen needs more than ~150 lines of setup, that is a signal to extract a hook and test the
  hook instead — which is Phase 3 work arriving late.

**Alternative considered and rejected for now:** Maestro E2E over a handful of critical journeys
(create story → sync → resolve conflict), which the Expo documentation recommends over screen
snapshots. It covers less code per hour of work and cannot be measured by LCOV, so it does not move
this roadmap's number. Revisit it after Phase 5 as a complement, not a substitute.

**Definition of done:** repository at ~83.2%. This is the phase that changes the headline number.

---

## 10. Phase 6 — the long tail

| Group | Lines | Coverage | Target |
| --- | ---: | ---: | ---: |
| API bootstrap, launcher, db, schema | 1,164 | 75.9% | 90% |
| `apps/admin` (all) | 854 | 74.2% | 90% |
| Client theme, db, utils, showcase, testing | 931 | 73.5% | 90% |
| `packages/shared` measured base | 622 | 94.2% | 98% |

Named gaps worth a line each:

- `api/src/db/index.ts` — 39 lines, 28.2%. The dialect selection between Postgres and libSQL.
- `api/src/launcher/run.ts` — 78 lines, 46.2%; `launcher/io.ts` — 7 lines, 0%.
- `api/src/db/schema` — 44 files, 215 lines, 60.5%. Table definitions; most of the uncovered lines
  are relation callbacks never executed. A candidate for §11 exclusion rather than tests.
- `client/src/theme/commonStyles.ts` — 80 lines, 10.0%. Style factories. Also an exclusion candidate.
- `client/src/testing/sqliteWebSmokeProbe.ts` — 37 lines, 0%. Test-support code shipped in `src`.
- `shared/utils/colorUtils.ts` — 29 lines, 58.6%; `shared/schemas/SyncSchemas.ts` — 24 lines, 79.2%.
- `admin/src/showcase/api` — 39 lines, 0%.

**Definition of done:** repository at ~85.1% (~85.3% with graphs measured).

---

## 11. Permanently excluded — and why

100% is the north star; these are the things it will never include. Each exclusion is a decision to
be re-argued, not a fact:

| Excluded | Reason |
| --- | --- |
| `apps/client/src/db/migrations/**` | Generated from drizzle-kit SQL by `generate-indexes.ts`. `test/db/` already asserts they apply and produce the expected tables — covering the generated modules asserts the generator twice. |
| `apps/client/src/exampleStories/content/**` | Static JSON. `ExampleStoryService.test.ts` validates structure, ids and referential integrity; line coverage of a data file means nothing. |
| `apps/client/src/help/content/**`, `src/storyDevices/content/**` | Prose. Already reads 100% because importing the module executes it. Kept measured only because excluding it would cost more than it saves. |
| `**/locales/*.json` | Audited by `scripts/verify-translations.ts`, which is the right tool. |
| `src/main.tsx`, `src/launcher.ts`, `server.ts`, `boot.ts` entry points | One statement calling one function. Failure is immediate and total on every run. |
| Generated registries (`help/generated`, `storyDevices/generated`, `db/migrations/index.ts`) | Same argument as the migrations. |
| Style-only modules (`theme/commonStyles.ts`, `*Styles.ts`) | Assertion targets are pixel values with no behaviour. The exception is a style contract that has already regressed — `MultiSelectPill` — which earns a test by having failed. |
| Drizzle relation callbacks in `db/schema/**` | Declarative wiring the ORM executes lazily; a wrong relation fails loudly on the first query, and the integration suite issues those queries. |

Everything else that is uncovered is **debt with a phase number**, not an exclusion.

---

## 12. The ratchet

The rule from the archived plan stands and this roadmap depends on it:

- Floors live in `scripts/coverage-thresholds.json`, read by every Vitest config, the Jest config and
  `test-report.ts`.
- Each floor keeps a 3-point margin below the measured value.
- `bun run coverage:update` recomputes the floors and **only raises them**.
- Lowering requires `bun run coverage:update -- --rebaseline` and a sentence in the commit message
  saying whether a test was not written or covered code was removed.

### 12.1 Per-directory floors — required by Phase 1A

A single global floor per workspace cannot express "sync is held to a higher standard". Today the
client's floor is 34% lines; the sync surface could fall from 81% to 40% and CI would stay green,
because 19,000 other lines absorb it. Phase 1A's targets are unenforceable without this.

Both runners already support scoped thresholds — no new tooling, no new dependency:

**Jest 29** (`apps/client/jest.config.js`) takes path keys alongside `global`:

```js
coverageThreshold: {
  global: coverageThresholds.client,
  './src/services/sync/': coverageThresholds.clientSyncCore,
  './src/services/entity-sync-handlers/': coverageThresholds.clientSyncHandlers,
  './src/services/SyncConflictService.ts': coverageThresholds.clientSyncCore,
  './src/services/ConflictSummaryService.ts': coverageThresholds.clientSyncCore,
  './src/services/storymanagement/': coverageThresholds.clientStoryServices,
}
```

**Vitest 4** (`apps/api/vitest.integration.config.ts`) takes globs in `coverage.thresholds`:

```ts
thresholds: {
  ...coverageThresholds.apiIntegration,
  'src/services/entity-sync-handlers/**': coverageThresholds.apiSyncHandlers,
  'src/services/SyncService.ts': coverageThresholds.apiSyncCore,
}
```

Add the matching keys to `scripts/coverage-thresholds.json` and teach `scripts/coverage-update.ts`
to ratchet them like the globals. Each scoped floor carries **lines, functions and branches** — the
branch number is the one that matters here, and it is the only one that would have caught the
conflict-matrix gap.

| Scope | Lines | Functions | Branches |
| --- | ---: | ---: | ---: |
| `clientSyncCore` | 97 | 95 | **90** |
| `clientSyncHandlers` | 97 | 95 | **90** |
| `apiSyncCore` | 97 | 95 | **90** |
| `apiSyncHandlers` | 97 | 95 | **90** |
| `clientStoryServices` | 95 | 90 | **80** |
| `apiExportImport` | 95 | 90 | **80** |

Set them at the measured value minus the usual 3-point margin as each area lands, not at the target
from day one — a floor above the current value fails CI on the commit that introduces it.

**Per-phase floor targets** (global lines; run `coverage:update` at the end of each phase to set the
real numbers, these are the arithmetic targets):

| After phase | client | api combined | admin | shared | repo |
| --- | ---: | ---: | ---: | ---: | ---: |
| today | 34% | 78% | 70% | 93% | 46.9% |
| Phase 0 | 34% | 78% | 70% | re-baselined | 44.9% (honest) |
| Phase 1 | 39% | 84% | 70% | — | 51.4% |
| Phase 2 | 40% | 87% | 70% | — | 53.6% |
| Phase 3 | 41% | 87% | 70% | — | 54.6% |
| Phase 4 | 52% | 87% | 70% | — | 63.2% |
| Phase 5 | 76% | 87% | 70% | — | 83.2% |
| Phase 6 | 79% | 90% | 87% | 95% | 85.1% |

End state per workspace: client 82.3%, API 93.6%, admin 90.0%, shared 98.1%, desktop 98.3%,
site 99.3%.

---

## 13. Conventions for the new tests

The infrastructure is already in place; new suites should reuse it rather than invent.

- **Client, anything touching the database:** `test/helpers/testDb.ts` — a real `better-sqlite3`
  instance running the production migrations, with the async-transaction shim already solved.
  Never mock the database.
- **Client, module mocks:** `__esModule: true` and a self-sufficient factory that reads nothing from
  the file's scope. `jest.mock` is hoisted above `const` declarations; a factory referencing an outer
  variable captures `undefined`. See `MediaSyncService.test.ts` and `TokenVault.test.ts`.
- **Client, hooks:** `renderHook` from RNTL 14 returns a **Promise** — `await` it, or `result` is
  `undefined` and every assertion fails with the same misleading message.
- **Client, HTTP:** assign `axios.defaults.adapter`. Axios resolves the adapter per request and
  `createKeresAxiosInstance()` never sets one, so this intercepts even the already-constructed
  singleton with its interceptors intact. No module mock, no seam in the service.
- **API, anything touching the database:** the integration helpers and the disposable Postgres.
  Unit tests that mock the ORM prove nothing about a query.
- **API, Bun-only APIs in Node:** `test/helpers/bunShim.ts`.
- **Architecture rules:** three suites already enforce layering, import boundaries and the 600-line
  file ceiling. A new violation is a test failure, not a review comment — extend those suites rather
  than writing a new guard.
- **Test names in English**, matching the rest of the repository.

---

## 14. Progress checklist

- [ ] **Phase 0** — measurement: shared `graphs`/`rules` included, 13 test files moved, 2 missing
      graph suites written, thresholds re-baselined, API merged LCOV scripted.
- [ ] **Phase 1A.0** — split `SyncEngineService.ts` into scheduler / pull / push / transfer; split the
      entity-name resolution out of `EntityService.ts`; both off the ceiling allowlist; API gains a
      line ceiling of its own.
- [ ] **Phase 1A.0** — per-directory floors wired into Jest, Vitest and `coverage-update.ts`.
- [ ] **Phase 1A.1** — every reachable cell of the conflict matrix tested; `keep_local`,
      `keep_server`, `restore` and `discard` go from **0 test files** to full coverage.
- [ ] **Phase 1A.2** — pull, push and scheduler at ≥97% lines / **≥90% branches**.
- [ ] **Phase 1A.2** — client sync handlers (30 files) at ≥97% lines / **≥90% branches**.
- [ ] **Phase 1A.2** — API sync handlers + `SyncService` + `BaseSyncEntityHandler` at ≥97% lines /
      **≥90% branches**.
- [ ] **Phase 1B** — client story services (40 files) at 95% lines / 80% branches.
- [ ] **Phase 1B** — API export/import, permissions, tier at 95% lines / 80% branches.
- [ ] **Phase 2** — client auth/network/media/friendship services at 90%.
- [ ] **Phase 2** — API routes, account, admin, media, publication at 95%.
- [ ] **Phase 3** — client hooks at 90%.
- [ ] **Phase 3** — client stores at 90%.
- [ ] **Phase 3** — client navigation at 90%.
- [ ] **Phase 4a** — components that write at 80%.
- [ ] **Phase 4b** — components that display at 80%.
- [ ] **Phase 5.1** — form screens at 70%.
- [ ] **Phase 5.2** — settings and destructive screens at 70%.
- [ ] **Phase 5.3** — `enterstack` screens at 70%.
- [ ] **Phase 5.4** — detail screens at 70%.
- [ ] **Phase 5.5** — list screens at 70%.
- [ ] **Phase 6** — API tail, admin, client tail, shared at their targets.
- [ ] **Post-Phase 5** — reassess Maestro E2E for the three critical journeys.

Each phase closes with `bun run coverage:update` and a commit that moves the floors. A phase is not
done because the tests were written; it is done because the floor cannot fall back.
