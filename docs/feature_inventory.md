# Keres feature inventory

**Status:** code-grounded inventory (companion to `project_plan.md`)
**Generated:** 2026-09-23, from a full read of the repository (6 parallel code
readers + verification pass). The code is the source of truth; file pointers
below are the evidence. When a feature changes, update the section here and,
if it affects the data model or sync, `project_plan.md` too.

> Scope note: generated bundles (`dist/`, coverage HTML, vendored libs) were
> excluded. Help/device/example/shipped-pack *content* files were counted and
> spot-checked per language (structure enforced by tests), not all read in full.

---

## 1. Product at a glance

Keres is an **offline-first story organizer** (story bible) for linear and
branching narratives: characters, locations, scenes, plots, world rules, time,
maps, boards and collaboration, with a self-hostable sync server, a public
showcase, story packs and installable example stories. UI languages: **EN + PT**.

Monorepo (`package.json`, v1.8.0, MPL-2.0):

| App | Stack | Delivers |
| --- | --- | --- |
| `apps/client` | React Native + Expo (Android/iOS/web), SQLite local-first | main app, 109 screens |
| `apps/api` | Elysia (Bun), Drizzle over Postgres/SQLite, Zod | REST + sync + hosting |
| `apps/admin` | React + Vite, dual build | admin panel (`/admin`) + showcase (`/showcase`) |
| `apps/desktop` | Electron 43, win/mac/linux (`electron-builder`) | desktop wrapper of the client web build |
| `apps/site` | React + Vite + i18next | public landing page (GitHub Pages) |
| `packages/shared` | TS entities + Zod + graphs + rules | common vocabulary for api/admin/client |

---

## 2. Stories

- **Linear or branching** per story (`Story.type`), with **linear/branching
  conversion** (`docs/choice_mechanics.md`, `dynamic_story_structure.md`).
- **Arcs**: optional editorial subdivision inside one story (default arc,
  `chapters.arcId`, drawer arc switcher; lists/timeline follow the filter).
- **Per-story vocabulary**: rename visible entity terms without duplicating the
  model (`customization/VocabularyScreen.tsx`).
- **Appearance/theme**: per-story branding, light/dark palettes
  (`customization/StoryAppearanceScreen.tsx`, `commonStyles.ts`,
  `showcaseBranding`, `paletteVars.ts` → CSS `--story-*` vars).
- **Story settings & dashboard & analysis**
  (`MainDashboardScreen`, `StorySettingsScreen`, `StoryAnalysisScreen`).
- **Local-only or server-linked** stories (`serverId`, null = strictly local).

## 3. Narrative elements

- **Chapters + Events**: chapters are display-ordered containers; events have
  their own order and can anchor in chronology; **unchaptered scenes are valid
  fragments** (list/detail/form screens, `NarrativeElementsListScreen`).
- **Scenes**: core units with detail/form, timing input (signed int capped at
  2^31−1), relative gap or calendar-coordinate override
  (`sceneTimingInput.ts`, `StoryTimelineScreen`).
- **Choices (branching)**: scene → scene transitions with **checks** (visits,
  items, flags via `ChoiceCheckGroup`/`ChoiceCheck`) and **effects** (grant/take
  item, toggle flag via `Effect`); detail/form/view screens + story map graph.
- **Routes**: authored traversals (`Route` + ordered `RouteStep` with exact
  choice taken; loops allowed); list/detail/form/steps/reader/timeline screens.
- **Story Navigator**: in-memory choice simulation, save visited path as route
  (never persists simulated item/trigger state).
- **Route-aware reader** (`RouteReaderScreen`) and per-route derived timeline
  (gaps, durations, calendar dates).
- **Story map**: renders the branching choice graph with analysis.

## 4. Plots

- `Plot` + `PlotScene` (unique pair, required ≤160-char single-line note),
  works in **both story shapes**, survives conversion; 6 screens
  (list/detail/form/matrix/coverage/reader).
- Linear: presence **matrix** (pinch canvas, tap opens scene) + **coverage**
  bars (exportable SVG). Branching: graph/catalogue distribution, map
  highlights — never an invented reading order.
- Plots take part in export/import, sync, tombstones and op log; searchable by
  name/details. Deliberately no tags/favourites/comments/suggestions/custom
  attributes (`finished_planning/PLOT_IMPLEMENTATION_PLAN.md`).

## 5. Cast, places, things

- **Characters**: CRUD + detail with derived "appears in" arcs; **relations**
  (`CharacterRelation`, typed, + relation graph screen with deterministic
  cluster layout); **scene cast** (`CharacterScene`); **modes** (alternate
  forms); **stats system** (opt-in `Stat` axes + `StatStrength` scales +
  `StatRelation` values w/ mode override; radar, ladder, ranking, comparison
  screens; `docs/stat_system.md`).
- **Locations**: CRUD + `LocationRelation` (`contains` directional /
  `connected_to` unordered); deterministic contains-tree layout, cycle-safe;
  **location graph** screen; **location maps** (§8).
- **Items**: CRUD + **item journeys** (state/owner history scene by scene).
- **World rules/pieces**: rules CRUD + world index; world pieces plan shipped
  (`WORLD_PIECES_PLAN.md`).
- **Notes**: free writing, zero-or-more entity anchors via `NoteRelation`.
- **Tags**: entity + polymorphic `TagRelation` to anything.
- **Gallery**: content-hash media assets linked to any owner via
  `GalleryRelation` (mime allowlist, MD5 dedupe); list/detail screens.

## 6. Cross-cutting story features

- **Favourites** (story/element; shared-story behaviour in story settings).
- **Comments**: field-anchored threads (native `fieldKey` or custom `fieldId`)
  with excerpt + author + criticality 1–5; review list across entities.
- **See-also**: free reciprocal links between compatible entities.
- **Auto-links + mentioned-in**: derived forward links and backlinks panel
  (referring entities counted separately from total mentions).
- **Custom attributes**: per-story typed fields for 7 entities
  (Character/Location/Item/Scene/Chapter/Note/WorldRule); types TEXT,
  LONG_TEXT, NUMBER, BOOLEAN, DATE (calendar/time picker, 12/24h i18n),
  SUGGESTION; normalized `snake_case` keys (`attributeKey.ts`), text-column
  codec (`attributeValueCodec.ts`), reorderable.
- **Suggestions**: reusable per-story catalogue (`Suggestion` entity) + named
  lists (CRUD, dedupe copy, merge, anti-corruption) + usage screen.
- **Global + advanced search** (per-entity searchable fields metadata,
  `entityFields.ts` / `globalSearchFields.ts`); list filters/sort/favourites.

## 7. Time: calendars and agenda

- **Custom fictional calendars**: months, eras, seasons, moons, negative years,
  time of day; generic row-list editor; one primary / none / parallel views.
- **Agenda**: calendar dates + placed scenes/events; date lookup; edits preview
  current vs newly interpreted anchored values before confirm; anchors
  inspectable/navigable later.
- **Day-number calendar math** without leap years or timezones
  (`storyCalendar.ts`); invalid interpretations are reviewable, never silently
  rewritten.

## 8. Visual surfaces

- **Boards**: freeform canvas (Skia; web fallback) with entity pins, notes,
  arrows/edges, card display modes, card notes, direct resize, explicit
  stacking, pan/zoom/culling; duplicate/delete from list items; 9 pin types,
  Crockford ids, 500/1000 caps, id remap on clone (`BoardSchemas.ts`).
- **Location maps**: structured location graph over saved image bases
  (nodes/markers/connections, image resize, stacking, free markers,
  point-to-map navigation); spatial-envelope validation, uniqueness, id remap
  on copy; duplicate/delete from list items; standalone SVG export with legend
  + PNG raster up to 4096px (`svgRaster`).
- **Graphs** (pure layout + SVG in `packages/shared/graphs`): story, location,
  character-relation, timeline, stat radar, presence matrix, plot coverage.

## 9. Accounts, servers, collaboration

- **Cold install** onboarding; multi-server accounts (tokens per `serverId`);
  JWT + queued 401 refresh per server; hosted web session via HttpOnly cookie
  (`/auth/me` restores after F5); password change; profile w/ `@handle`
  user tags (3–20 chars) and recovery codes; tiered account limits.
- **Friends**: request flow w/ `PENDING`/`FRIEND`/`BLACKLISTED`, reader/writer
  grants, blacklist; friend detail/list/form screens.
- **Story roles**: owner/writer/reader; readers may only write own favourites
  and (if allowed) own comments; owner-only story fields enforced on both
  client and server.
- **Server management + registration** screens; per-server sync protocol header.

## 10. Sync and offline-first

- **Operation log** on client and server: audit trail + pull/push source of
  truth; list/detail screens (author/date/sync/changes/reorder).
- **Protocol**: `POST /sync/:storyId` push (≤200 ops, `MAX_SYNC_BATCH_SIZE`)
  + `GET /sync/:storyId/pull` (pages ≤500, `MAX_SYNC_PULL_BATCH`); non-atomic
  batch (`applied` + `conflicts`); cursor `lastServerSyncedLog` only advances
  past applied ops; **WebSocket `/events` is notify-only**.
- **OCC by `version`**: update requires base version (equality; missing base →
  422, never last-write-wins); disjoint fields auto-merge (`changedFields`);
  same field → user-facing conflict review (`SyncConflictService`,
  human-readable summaries); delete-vs-edit offers restore/accept/resend;
  tombstones via `isDeleted`/`deletedAt`; reorders dispute whole order.
- **One sync handler per entity** (`entity-sync-handlers/`, ~30 entities with
  linear/branching guards; unique start/finish; orphan-blob sweep).
- **Media sync**: bytes via `/media` after metadata (≤5 transfers/cycle);
  existing hash linkable only to stories already referencing it.
- Bootstrap: local story up via `POST /stories/import`; remote down via
  `GET /stories/:id/export` + local import; incremental sync starts after link.
- Full behaviour: `docs/conflict_resolution_client_strategy.md`.

## 11. Import, export, transfer, manuscript

- **Story packages**: versioned `.zip` (`story.json` + `media/`, STORE-validated)
  with typed build/extract errors and counts; phased importer
  (core → narrative → assets → interactions → final) with migration, validation
  and ID remap; language-aware file naming (slug + date).
- **Manuscript pipeline** (`packages/shared/manuscript`): styled runs,
  never-throw markdown parser with whitespace round-trip, 15 MB cap
  (`MAX_MANUSCRIPT_BYTES`); compiles **DOCX** (TOC/bookmarks/PAGEREF/footer),
  **MD**, **TXT**, **HTML** + route-following option (`routeId`); **PDF**
  (pure-TS A4 renderer with TOC links and real choice page numbers) stays
  client-side.
- **Map exports**: SVG standalone + PNG raster; plot-coverage SVG.

## 12. Publishing and Showcase

- **Publications** (`StoryPublication`, immutable, outside incremental sync):
  publish requires ownership + being in sync; labelled versions (keeps 5);
  visibility `public`/`password` (password change on switch); manuscript
  renditions recorded per version; offline-diff notice on reconnect.
- **Showcase** (admin dual build, served at `/showcase`): public story pages
  with author palette theming + configurable branding (name/logo/palette/title,
  Keres fallback); password gate learns nothing before unlock; ETag caching.
- **Public API** (`public.route.ts`, no login): config, story list (passworded
  excluded), packs, password unlock (rate-limited, 1h JWT per story), full-zip
  download (S3 presigned), 60s download URLs for `<a>` tags; private → 404,
  no session → 401.

## 13. Packs

- **User packs** (REST `pack.route.ts`: create/replace, `private`/`public`,
  GET/POST/DELETE, no sync/OCC): carry entity *shape* + extras, never values,
  media or choices; applied only at story creation with zero ops
  (`PackService`); v1→v2 content migration; browse/list/form screens.
- **4 shipped packs**, EN+PT (`comic`, `novel-craft`, `tabletop-stats`,
  `three-act-skeleton`), incl. vocabulary seeds.

## 14. Learning content (EN+PT)

- **Help centre**: **68 pages** in 9 sections (start/stories/elements/branching/
  annotate/preferences/accounts/sync/support), local search, task-based layout
  (What it is → What it is for → How to do it → What it affects + example +
  steps + seeAlso), per-route contextual help (all routes except 3 drawers),
  visible-fields tables; shape enforced by `catalog.test.ts`.
- **Story devices**: **54 entries** in 7 sections (structure/plot/character/
  scene/style/theme + how-to), cross-linked seeAlso.
- **6 example stories** EN+PT (alice, beauty-and-the-beast, cinderella,
  goldilocks, little-mermaid, kaguya), installable by slug+language; feature
  matrix in `docs/example_story_feature_matrix.md`.
- **Guided tours** (`docs/guided_tours.md`, `guides/registry.ts`).

## 15. Server, admin and ops

- **API modules** (18 `*.route.ts`): `auth`, `sync`, `story` (+`publication`),
  `storyPermission`, `friend`, `user`, `media`, `pack`, `public`, `websocket`,
  `admin*` (users, tiers, registration, recovery, API logs, showcase).
- Hosts: client web export at `/` (COOP/COEP for SQLite WASM), `/admin`,
  `/showcase`, Swagger at `/swagger`; session cookie for hosted web.
- **Admin panel**: user CRUD by tier, tiers, registration settings, recovery,
  API logs, showcase settings; generated favicon/logo/avatars
  (`vite.keresIcon.ts`); audit remediation plan in
  `finished_planning/ADMIN_AUDIT_REMEDIATION_PLAN.md`.
- **Media storage**: local-disk or S3 backend, **identity locked at first use**
  (refuses silent switches while blobs exist); status ≤500, validated
  multipart upload, immutable-cache GET.
- **Keres Server launcher**: dependency-free binary/zip (Bun + libSQL + admin
  dist), per-OS data dir (`KeresServer/keres.db`), `--backup` snapshots,
  `packaging/README.md` (pt+en); `api:build` produces
  `Keres-Server-<os>-<arch>-<version>.zip`, attached to GitHub Releases.
- **Docker + CI**: `docker-compose.yml` (dev PG16 + API:3000, test, ghcr
  deploy); Postgres/SQLite dual with migration-parity tests; release, landing
  (Pages) and Android-version (`versionCode` from semver) workflows.
- Dual-served **desktop IPC**: encrypted auth vault (`safeStorage`) + on-disk
  media under an isolated root (no traversal), `app://` origin only;
  `--capture-screens` JSON plan for showcase screenshots.

## 16. i18n, theming, tooling

- **i18n**: full EN+PT dictionaries (key/placeholder parity tested),
  `locales:audit` (used/dead keys), per-route help in both languages.
- **Theming**: shared colour contracts (`ThemeColors`, named palettes),
  light/dark story palettes, contrast utilities.
- **Repo tooling**: `test:report` (suite table + coverage ratchets),
  `coverage:update`, `version:set` (semver across 7 manifests),
  `release:check`, `code:lines`, screen/lifecycle codemods, Biome formatting,
  typecheck/lint/test runners per app.

---

## Appendix A — counts (verified)

| Item | Count | Source |
| --- | --- | --- |
| Client screens (TSX in `screens/`) | 109 | counted 2026-09-23 (note: `CLIENT_SCREEN_INVENTORY.md` still says 98 — drift) |
| API route files | 18 | `apps/api/src/modules/**/*.route.ts` |
| Shared entities | 42 | `packages/shared/entities/*.ts` |
| Sync push / pull batch caps | 200 / 500 | `SyncSchemas.ts` (`MAX_SYNC_BATCH_SIZE`, `MAX_SYNC_PULL_BATCH`) |
| Help pages × languages | 68 × EN+PT | `apps/client/src/help/catalog.ts` |
| Story-device entries × languages | 54 × EN+PT | `apps/client/src/storyDevices/catalog.ts` |
| Example stories × languages | 6 × EN+PT | `exampleStories/generated/registry.ts` |
| Shipped packs × languages | 4 × EN+PT | `shippedPacks/generated/registry.ts` |
| Manuscript formats (+ client PDF) | docx/md/txt/html (+pdf) | `manuscriptContracts.ts`, `manuscriptPdf.ts` |
| Kept publication versions | 5 | `publication.route.ts` |
| Media transfers per sync cycle | 5 | `MediaSyncService.ts` |
| Manuscript size cap | 15 MB | `MAX_MANUSCRIPT_BYTES` |
| Custom-attribute entities / types | 7 / 6 | `StorySchemaEntityType`, `AttributeType` |

## Appendix B — deliberate non-goals (per `FEATURE_LANDSCAPE.md`)

No long-form manuscript editor/compiler workflow, no playable game runtime or
engine export, no real-time co-editing cursors, no series-level shared canon
across stories (copy/import instead), no geographic region discovery/layers/
controlled reveal on maps; the op log is sync infrastructure, not prose history.
