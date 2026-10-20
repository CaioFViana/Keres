# Project structure

> The text below reflects the repository's real structure.

## Conventions

These rules decide where a file goes and what it is called. Most are enforced by a test, named at the end of each rule, so the first violation fails a run instead of becoming the habit.

### Names

- **Folders are `kebab-case`** (`item-journeys`, `operation-log`, `story-calendars`). The one exception is the folder-per-component layout under `apps/client/src/components/`, where the folder carries the component's PascalCase name.
- **Files**: `PascalCase` when the main export is a component, class or service (`StoryService.ts`, `CharacterCard.tsx`); `camelCase` for a module of functions or constants (`colorMath.ts`); a hook is always `useX.ts`. Nothing that is not a hook lives in a `hooks/` folder.
- **Suffixes**: `*Service` (business logic), `*ApiService` (HTTP calls), `*Store` (Zustand), `*SyncHandler` / `*ClientSyncHandler` (one per synchronizable entity), `*Screen` / `*Page` (a routed view), `*.route.ts` (an API route).
- **Platform variants** sit beside the module they replace: `playPurchase.ts` and `playPurchase.android.ts`, `useEdgeFont.ts` and `useEdgeFont.web.ts`. They move together.

### Placement

- **Group by domain, not by kind of file.** A folder with more than a couple of dozen files is split into subfolders by what the files are about (`hooks/story/`, `services/payments/`, `schemas/narrative/`).
- **Next to its only consumer.** A hook, helper or component used by one screen lives in that screen's folder (`screens/enter-stack/servers/useServerDeletion.ts`). Used by two or more screens or by components, it goes to the shared home of its domain (`hooks/<domain>/`). Components do not fetch data (`importBoundaries.test.ts`), so a hook that reads the database stays out of `components/` even when a single component uses it.
- **The layer decides the folder.** A pure function is a `utils/<domain>/` file; one that needs the database, the HTTP client or another service is a `services/<domain>/` file; one that needs a store is a `state/<domain>/` file. Services and the database never import screens, components or navigation (`layering.test.ts`).
- **Flat on purpose**: one file per entity or table, written to the same template, stays in one folder: `services/entity-sync-handlers/` (client and API), `db/schemas/`, `db/migrations/` (its `index.ts` is generated), `apps/api/src/db/schema/tables/`, `packages/shared/entity-solvers/entities/`.
- **Generated files** (`db/migrations/index.ts`, `content/*/generated/registry.ts`) are written by `apps/client/scripts/generate-indexes.ts` and are never edited by hand. The generator emits the same import style as the rest of the code.

### Imports

Across folders, import by alias; use `./` only for a file in the same folder or below; never climb with `../`. An alias import does not change when the importer moves, and a `./` import survives moving the folder around it, which is what keeps reorganizing folders a mechanical change.

| Package | Aliases | Enforced by |
| --- | --- | --- |
| `apps/client` | `@/src/...`, `@/test/...` | `test/architecture/importStyle.test.ts` |
| `apps/api` | `@/` (src), `@test/`, `@scripts/` | `test/architecture/importStyle.test.ts` |
| `apps/admin` | `@/` (src), `@test/`, `@root/` (build configuration beside `src`) | `test/architecture/importStyle.test.ts` |
| `packages/shared` | none: it is consumed as source by the apps, and an alias inside it would not resolve for them | - |

The apps import the shared package as `@keres/shared` (the barrel) or by deep path (`@keres/shared/schemas/story/StorySchemas`). `apps/site`, `apps/payments`, `apps/verification` and `apps/desktop` keep relative imports for now.

The test runners need the alias spelled out: `apps/api/vitest.alias.ts` and `apps/admin/vite.alias.ts` repeat the `tsconfig.json` paths for Vitest and Vite.

### Tests

A test mirrors its source: `src/hooks/story/useStoryArcs.ts` is tested by `test/hooks/story/useStoryArcs.test.ts`. API tests that need the database end in `.integration.test.ts`. Architecture tests (`test/architecture/`) check these rules and the layering.

### Moving files

`bun scripts/move-files.ts --map moves.json` moves files (and, with `mirrorTests`, their tests) and rewrites every import, re-export, dynamic import, `require` and `jest.mock`/`vi.mock` that points at them. `--normalize <package root>` rewrites a package's `../` imports to its alias. Both accept `--dry-run`. Paths written as plain strings (a script that builds a path, a documentation link) are reported at the end and fixed by hand.

---

## Monorepo overview

```
Keres/
├── apps/
│   ├── api/       # Backend - Elysia (Bun) + Drizzle (Postgres)
│   ├── admin/     # Internal administration panel - React + Vite
│   ├── client/    # Main app - React Native + Expo (mobile and web)
│   ├── desktop/   # Electron packager for the client, for Windows/Mac/Linux
│   ├── payments/  # Separate payment connector service (PayPal, Stripe, Play Billing) - Bun
│   ├── site/      # Landing page: GitHub Pages site + API-hosted variant - React + Vite
│   └── verification/ # Separate age-verification service with a reviewer area - Bun
├── packages/
│   └── shared/    # Entities, Zod schemas and metadata shared between api/admin/client
└── docs/          # This folder
```

There is no separate `packages/db`: each app with its own persistence has its own Drizzle schema (`apps/api/src/db/`, on the server/Postgres side; `apps/client/src/db/`, on the client/local SQLite side) - both mapping the same entities from `packages/shared/entities`, but as physically distinct databases (see the offline-first strategy in `project_plan.md`).

---

## `packages/shared`

Consumed by `apps/api`, `apps/admin` (including the Showcase) and `apps/client` through `@keres/shared` (and through deep paths such as `@keres/shared/metadata/entityFields` for specific metadata). `apps/site` does not depend on this package.

- **`entities/`** - TypeScript interfaces that form the system's common vocabulary, by domain: `narrative/` (`Character`, `Chapter`, `Scene`, `Plot`, `Route`, `Location`, `Item`/`ItemJourney`, `Note`, `Tag`, `WorldRule` (the World Pieces), `Gallery`, `Board`, `Sketch`, `ScenePage`, `Song`, `SceneMusic`, `ChapterAnchor`, the relations `PlotScene`, `RouteStep`, `CharacterRelation`, `CharacterScene`, `LocationRelation`, `GalleryRelation`, `SeeAlsoRelation`, branching narrative `Choice`, `ChoiceCheckGroup`, `ChoiceCheck`, `Effect`, cross-cutting `Comment`, `Favorite`, `Suggestion`, `AttributeValue`, stats `Stat`, `Mode`, and the media entities), `story/` (`Story`, `StoryArc`, `StoryCalendar`, `StorySchemaField`, `StoryPublication`, `PublicShowcaseStory`) and `accounts/` (user, tier, registration and client-settings entities). `Plot`/`PlotScene` work in both story shapes; `Route`/`RouteStep` belong to branching stories.
- **`schemas/`** - Zod validation for each API resource's request/response, mirroring the entities, in the same style of domain folders: `narrative/`, `story/` (including the export and pack migrations), `accounts/`, `social/` (friendships, contacts, messages), `compliance/` (access records, audit), `payments/` and `sync/`. `*Schemas.ts` holds the validators of a resource and `*Wire.ts` the shapes that cross the network unchanged.
- **`metadata/`** - enums and static configuration used in several places across the system:
  - `StorySchemaEntityType` - the 7 entities that accept custom attributes (`Character`, `Location`, `Item`, `Scene`, `Chapter`, `Note`, `WorldRule`) - it excludes relation/join tables, `Choice`, `Gallery` and `Story` itself.
  - `AttributeType` - the custom field types (`TEXT`, `LONG_TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `SUGGESTION`).
  - `OperationLogEntityType` - the entities covered by the synchronization operation log.
  - `LocationRelationType` - `'contains'` (directional, parent/child) and `'connected_to'` (an unordered pair).
  - `FriendStatus` - `PENDING` / `FRIEND` / `BLACKLISTED`.
  - `entityFields.ts` - `entityFieldMetadata`: the list of searchable fields per entity, used by the Advanced Search modal (`AdvancedSearchModal`).
  - `globalSearchFields.ts` - `globalSearchFieldConfig`: the title field + searchable fields per entity, used by the Global Search (see `screen_flow.md`).
- **`manuscript/`, `sketch/`, `music/`, `age-verification/`, `payments/`** - pure engines and connector contracts shared by the apps: the manuscript compilers (DOCX, EPUB, PDF, Fountain, the online reader), the sketch codec and geometry, the song/melody/accompaniment engine, and the signed contracts for the age-verification and payment services.
- **`entity-solvers/`** - shared entity handlers and reference resolution used by sync, search and operation-log surfaces (contracts, per-entity handlers, `EntityRegistry`, `EntityReferenceResolver`).
- **`graphs/`** - pure layout and SVG renderers for story graphs, one folder per subject: `story/`, `location/`, `character-relations/`, `stats/`, `plot-coverage/`, `presence-matrix/`, `timeline/`, `canvas/` and `common/` (what the others share). Imported by deep path; no barrel (shared constant names would collide).
- **`rules/`** - domain rules applied on both sides of synchronization (entity pairing, linear-story scenes, reorder indices, sync conflict, story export integrity, story owner fields).
- **`theme/`** - shared colour contracts (`ThemeColors`) and named palettes consumed by the client and the admin Showcase.
- **`utils/`** - `attributeKey.ts` (derives a safe key from a custom attribute's display name) and `attributeValueCodec.ts` (encodes/decodes typed custom attribute values into the single text column where they are stored), plus calendar, route, zip, sync-codec and related helpers.

---

## `apps/api`

A backend in **Elysia** (an HTTP framework for **Bun**), **Drizzle ORM** over **PostgreSQL** (or SQLite for the home Keres Server), validation with **Zod** (schemas from `packages/shared`), **JWT** authentication (`@elysiajs/jwt`), **ULID** ids.

- **`src/db/`** - `schema/tables/*.ts`: server-side Drizzle table definitions, including `plots`, `plotScenes`, `routes` and `routeSteps`.
- **`src/modules/`** - one subdirectory per resource, each with its `*.route.ts`: `auth`, `sync`, `story`, `story-permission`, `friend`, `user`, `media`, `web-socket`, `message`, `pack`, `payments`, `public`, `age-verification` and `admin` (which in turn groups `adminUser`, `adminTier`, `adminRegistration`, `adminRecovery`, `adminPayment`, `adminActivity`, `adminAccessRecords`, `adminEvidenceHolds`, `adminMessage`, `adminStory`, `adminShowcase`, `adminApiLog`).
- **`src/services/`** - business logic, one folder per domain: `auth/` (attempt limits, recovery codes, terms acceptance), `accounts/` (users, contacts, friendships), `admin/` (what only the panel calls), `compliance/` (access records, audit, erasure, evidence holds, retention), `stories/` (export/import, invitations, NSFW, permissions), `publication/` and `showcase/`, `messages/`, `tiers/`, `payments/`, `age-verification/`, `media-storage/`, `story-packages/`, `static-delivery/` (the hosted client, admin and landing assets), `sync/` (`SyncService`, realtime sessions) and **`entity-sync-handlers/`** - one handler per synchronizable entity (extending `BaseSyncEntityHandler`) plus the `ApiEntityTableRegistry`. OCC by `version`, the non-atomic batch and the merge/conflict behaviour are described in `conflict_resolution_client_strategy.md`.
- The API also serves the compiled SPA from `apps/admin` under `/admin/*`, the client's web export under `/client` - an export made for that prefix, `build:hosted` in `apps/client`, not the desktop shell's (COOP/COEP for the SQLite WASM; a session through an HttpOnly cookie) - the story showcase at `/showcase`, and Swagger at `/swagger`. The root serves the landing page (`build:landing` in `apps/site`, opt-in and off by default), else redirects to `/client/`, `/showcase`, or the API docs, in that order.
- **`src/launcher/`** - the **Keres Server** CLI wizard (a binary/zip without Docker). `src/launcher.ts` is the entry point; `src/server.ts` remains the Compose boot (`bun run api:start`). `--backup` copies the data folder to `…-backups/<date>_<time>/`. `src/config/resourceRoot.ts` finds the migrations and the admin dist in the checkout or beside the executable. `packaging/README.md` (en+pt) goes into the zip. `bun run api:build` generates `apps/api/dist-server/keres-server/` and the zip `Keres-Server-<os>-<arch>-<version>.zip` that the `keres-server` job in `.github/workflows/release.yml` attaches to the GitHub Release.

---

## `apps/client`

**React Native + Expo**, with **React Native Web** - the same code runs natively (Android/iOS) and as a web app (that web build is exactly what `apps/desktop` packages inside Electron; see below). Offline-first: the whole story state lives in a local SQLite database.

- **`src/db/`** - the local database through **Drizzle ORM + expo-sqlite**. `schemas/` holds the persistent tables, including `plots`, `plotScenes`, `routes` and `routeSteps`: synchronizable narrative and cross-cutting entities, plus client-only tables with no server equivalent (`clientSettings`, `servers`, `syncConflicts`). `entityTableRegistry.ts`, `softDelete.ts` and `arrangedWrites.ts` are the helpers every service shares.
- **`src/screens/`** - one folder per entity/feature, each with its own dedicated List/Detail/Form screens (there is no shared generic screen; see `screen_flow.md` for the full navigation flow):
  `characters/`, `character-relations/`, `locations/`, `location-maps/`, `narrative-elements/` (chapters, scenes, choices and the timeline), `plots/` (plots and Story Navigator), `routes/`, `items/`, `item-journeys/`, `tags/`, `world-rules/`, `notes/`, `gallery/`, `boards/`, `sketches/`, `songs/`, `story-calendars/`, `story-share/` (publish and manuscript export), `story-settings/` and `customization/` (vocabulary, arcs, appearance), `suggestions/`, `comments/`, `operation-log/`, `story-schema/`, `stats/`, `global-search/`, `help/`, `packs/`, `main-story-stack/` (Dashboard, Story Analysis), `enter-stack/` (split into `account/`, `servers/`, `social/` and `story-entry/`: Cold Install, story selection/CRUD, servers and plans, friendships and messages, profile), `example-stories/`. Plot surfaces work in both story shapes; routes and Navigator appear for branching stories. The hooks only one screen uses sit in its folder.
- **`src/state/`** - **Zustand** stores by domain: `story/` (one store per entity: `characterStore`, `locationStore`, `tagStore`, ...), `drafts/`, `ui/` (`themeStore`, `notificationStore`, `appAlertStore` and the `AppAlert` facade), `sync/` (`connectivityStore`, `syncConflictStore`), `app/` (`userSettingsStore`, `planUsageStore`), `events/` (the entity event emitter) and `lib/`. The entity stores are built by the shared factory **`lib/createEntityStore.ts`**, which centralises what used to be duplicated (~140 lines) in every store: filter/search/sort state, favouriting with an optimistic update + rollback, initialising the service from the db + storyId, and the fetch cycle. Each store only supplies `collectionKey`, `createService` and `fetchEntities` (and optionally `updateFavorite`/`extraActions`/`persistKey`); the public API still carries per-entity names (`tags`/`fetchTags`) through mapped types. `resetAllClientStores.ts` clears every database-bound store (`stateReset.test.ts` keeps it complete).
- **`src/services/`** - by domain: `storymanagement/` (one CRUD service per entity, grouped into `entities/`, `scenes-chapters/`, `relations/`, `choices-stats/`, `media-music/`, `notes-tags-comments/`, `suggestions/`, `packs/`, `story-lifecycle/` and `forms/`), `entity-sync-handlers/` (the client-side counterpart of the API's handlers, applying received operations to the local database), `sync/` (`SyncEngineService`, `SyncConflictService`, push/pull), `api/` (every `*ApiService` and `apiClient`), `auth/`, `account/`, `payments/`, `social/`, `servers/`, `media/`, `platform-web/` (web-only media and font plumbing), `drafts/`, `publication/`, `showcase/` and `entity-solvers/`.
- **`src/navigation/`** - `AppNavigator.tsx` (the root) switches between `ColdInstallStack`, `LegalUpdate`, `StorySelectionStack` and `MainSystemDrawer` (the main drawer, described in `screen_flow.md`). `stacks/` holds the stack definitions (`MainSystemStacks.tsx` and the per-area stacks), `drawer/` the main drawer, its menu model and header options, `links/` the helpers that open a screen from outside the navigator.
- **`src/components/`** - one folder per component, grouped in `common/` (generic components reused across entities: `GenericFilterSortList`, `AdvancedSearchModal`, `GenericExpandedListItemWithActions`, etc.), `layout/` and `features/` (one folder per feature: list items, relation managers, graph renderers such as `StoryGraph`, `LocationGraph`, `CharacterRelationGraph`, ...).
- **`src/hooks/`** - shared hooks by domain (`arcs/`, `billing/`, `canvas/`, `entity/`, `forms/`, `lists/`, `nav/`, `social/`, `story/`, `sync/`, `ui/`, ...); the ones a single screen uses live in that screen's folder.
- **`src/utils/`** - pure helpers by domain (`svg/`, `canvas/`, `board/`, `io/`, `analysis/`, `search/`, `entity/`, `nav/`, `platform/`, `format/`, ...). Anything that needs the database, the HTTP client or a store lives in `services/` or `state/` instead.
- **`src/content/`** - the authored catalogs, each a `content/` folder with one folder per item and one file per language, plus a `generated/registry.ts` that Metro can bundle: `help/` (the help library), `story-devices/` (the literary devices library), `shipped-packs/` and `example-stories/`.
- **`src/guides/`, `src/mentions/`, `src/vocabulary/`, `src/legal/`, `src/icons/`, `src/theme/`, `src/locales/`** (`en.json`/`pt.json`) - the guided-tour registry and its authored content (`guides/content/`), entity mentions, the story vocabulary, legal texts, the icon set, theme and translations.

---

## `apps/desktop`

An **Electron** wrapper around `apps/client`'s web export. `main.ts`:

- Points `CLIENT_DIST` at the client's web build (`../../client/dist` in dev, `resourcesPath/client-dist` when packaged) and serves it through a custom `app://` protocol, with COOP/COEP headers - required by `expo-sqlite`'s WASM/OPFS driver in the browser (SharedArrayBuffer is only allowed on a "cross-origin isolated" page).
- Creates the `BrowserWindow` and keeps the window title in sync with the dynamic title the client itself already sets per screen (`DocumentTitleSync`/`setDocumentTitle`, see `apps/client/src/utils/nav/documentTitle.ts`).
- Exposes media IPC (`media:write/read/delete-file/delete-directory/list-all`) to write/read imported media files on the real file system (outside Chromium's sandbox), unlike SQLite, which stays in OPFS.

---

## `apps/admin`

An SPA in **React + Vite + react-router-dom**, served by the API itself under `/admin/*`. It is an **internal** panel, not aimed at the end user (the writer): it manages users, subscription tiers/plans (limits, sale pricing, order), the system currency, the messages inbox (landing form and user messages; reply, archive, filters), registration-opening settings, the hosted pages (client, landing, showcase) and account recovery. The same project also generates the **Showcase** (`vite.showcase.config.ts`, output in `dist-showcase/`), the showcase of published stories served by the API — a distinct thing from the GitHub Pages landing page.

- **`src/pages/`** - one folder per area (`users/`, `tiers/`, `payments/`, `messages/`, `settings/`, `stories/`, `access-records/`, `evidence-holds/`, `auth/`, ...), each with its `*Page.tsx`. A component only one page uses sits in that area's `components/` folder; `src/components/` holds the shared ones (`Layout`, `Modal`, `Pagination`).
- **`src/api/`** (one `*ApiService` per resource and `apiClient`), **`src/auth/`**, **`src/hooks/`**, **`src/utils/`** (pure helpers such as `storageUnits` and `paymentDetail`), **`src/i18n/`**, **`src/theme/`** and **`src/showcase/`** (the Showcase's own app: pages, components, theme and API client).

---

## `apps/site`

Keres's public landing page, a static **React + Vite** SPA, in English and Portuguese, with the same look (light/dark) as the Showcase. It builds twice from the same code: the GitHub Pages site, which does not talk to the API (it describes the product and points at the repository, the GitHub Releases and the Docker image), and the API-hosted landing served at the server root, which additionally shows the server's plans for sale (`GET /api/public/tiers`), a contact form (`POST /api/public/contact`) and the official `keres.me` server. When that landing is itself served from `keres.me` (`isOfficialSite` in `src/variant.ts`, decided by the page's host at load), the texts that say "this server" switch to the `*_official` variants (i18next context `official`) and the official section stops linking to itself.

The `.github/workflows/pages.yml` workflow builds `apps/site/dist` and publishes it to GitHub Pages. The project site's URL is `https://<owner>.github.io/<repository>/` — Vite's `base` comes from `VITE_BASE` in CI, because the repository name preserves capitals (`Keres`). Locally: `bun run site:start` (port 5175) and `bun run site:build`. The API variant: `bun run site:start:landing` (port 5176, `/api` proxied at the API) and `bun run site:build:landing` (`dist-landing/`, base `/_landing/`).

On the first publication, in the repository's Settings → Pages, the source has to be **GitHub Actions**.
