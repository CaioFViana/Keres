# Project structure

> The text below reflects the repository's real structure.

## Monorepo overview

```
Keres/
├── apps/
│   ├── api/       # Backend - Elysia (Bun) + Drizzle (Postgres)
│   ├── admin/     # Internal administration panel - React + Vite
│   ├── client/    # Main app - React Native + Expo (mobile and web)
│   ├── desktop/   # Electron packager for the client, for Windows/Mac/Linux
│   └── site/      # Public landing page (GitHub Pages) - React + Vite
├── packages/
│   └── shared/    # Entities, Zod schemas and metadata shared between api/admin/client
└── docs/          # This folder
```

There is no separate `packages/db`: each app with its own persistence has its own Drizzle schema (`apps/api/src/db/`, on the server/Postgres side; `apps/client/src/db/`, on the client/local SQLite side) - both mapping the same entities from `packages/shared/entities`, but as physically distinct databases (see the offline-first strategy in `project_plan.md`).

---

## `packages/shared`

Consumed by `apps/api`, `apps/admin` and `apps/client` through `@keres/shared` (and through deep paths such as `@keres/shared/metadata/entityFields` for specific metadata).

- **`entities/`** - TypeScript interfaces that form the system's common vocabulary. Besides the narrative entities (`Story`, `Character`, `Chapter`, `Scene`, `Plot`, `Location`, `Item`/`ItemJourney`, `Note`, `Tag`, `WorldRule`, `Gallery`), they include relations (`PlotScene`, `CharacterRelation`, `CharacterScene`, `LocationRelation`, `GalleryRelation`, `SeeAlsoRelation`), branching narrative (`Choice`, `ChoiceCheckGroup`, `ChoiceCheck`, `Effect`), cross-cutting features (`Comment`, `Favorite`, `Suggestion`, `StorySchemaField`, `AttributeValue`), stats (`Stat`/`StatStrength`/`StatRelation`, `Mode`), publication (`StoryPublication`, `PublicShowcaseStory`) and user/admin/configuration entities. `Plot`/`PlotScene` are exclusive to linear stories.
- **`schemas/`** - Zod validation for each API resource's request/response, mirroring the entities above.
- **`metadata/`** - enums and static configuration used in several places across the system:
  - `StorySchemaEntityType` - the 7 entities that accept custom attributes (`Character`, `Location`, `Item`, `Scene`, `Chapter`, `Note`, `WorldRule`) - it excludes relation/join tables, `Choice`, `Gallery` and `Story` itself.
  - `AttributeType` - the custom field types (`TEXT`, `LONG_TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `SUGGESTION`).
  - `OperationLogEntityType` - the entities covered by the synchronization operation log.
  - `LocationRelationType` - `'contains'` (directional, parent/child) and `'connected_to'` (an unordered pair).
  - `FriendStatus` - `PENDING` / `FRIEND` / `BLACKLISTED`.
  - `entityFields.ts` - `entityFieldMetadata`: the list of searchable fields per entity, used by the Advanced Search modal (`AdvancedSearchModal`).
  - `globalSearchFields.ts` - `globalSearchFieldConfig`: the title field + searchable fields per entity, used by the Global Search (see `screen_flow.md`).
- **`utils/`** - `attributeKey.ts` (derives a safe key from a custom attribute's display name) and `attributeValueCodec.ts` (encodes/decodes typed custom attribute values into the single text column where they are stored).

---

## `apps/api`

A backend in **Elysia** (an HTTP framework for **Bun**), **Drizzle ORM** over **PostgreSQL**, validation with **Zod** (schemas from `packages/shared`), **JWT** authentication (`@elysiajs/jwt`), **ULID** ids.

- **`src/db/`** - `schema/tables/*.ts`: 42 server-side Drizzle table definitions, including `plots` and `plotScenes`.
- **`src/modules/`** - one subdirectory per resource, each with its `*.route.ts`: `auth`, `sync`, `story`, `storyPermission`, `friend`, `user`, `media`, `websocket`, `admin` (which in turn groups `adminUser`, `adminTier`, `adminRegistration`, `adminRecovery`).
- **`src/services/`** - business logic (`SyncService`, `StoryPermissionService`, `FriendshipService`, `TierService`/`TierEnforcementService`, `MediaStorageService`, `StoryExportImportService`, etc.) and **`entity-sync-handlers/`** - one handler per synchronizable entity (extending `BaseSyncEntityHandler`). OCC by `version`, the non-atomic batch and the merge/conflict behaviour are described in `conflict_resolution_client_strategy.md`.
- The API also serves the compiled SPA from `apps/admin` under `/admin/*`, the client's web export at the root (COOP/COEP for the SQLite WASM; a session through an HttpOnly cookie), the story showcase at `/showcase`, and Swagger at `/swagger`.
- **`src/launcher/`** - the **Keres Server** CLI wizard (a binary/zip without Docker). `src/launcher.ts` is the entry point; `src/server.ts` remains the Compose boot (`bun run api:start`). `--backup` copies the data folder to `…-backups/<date>_<time>/`. `src/config/resourceRoot.ts` finds the migrations and the admin dist in the checkout or beside the executable. `packaging/README.md` (pt+en) goes into the zip. `bun run api:build` generates `apps/api/dist-server/keres-server/` and the zip `Keres-Server-<os>-<arch>-<version>.zip` that the `keres-server` job in `.github/workflows/release.yml` attaches to the GitHub Release.


---

## `apps/client`

**React Native + Expo**, with **React Native Web** - the same code runs natively (Android/iOS) and as a web app (that web build is exactly what `apps/desktop` packages inside Electron; see below). Offline-first: the whole story state lives in a local SQLite database.

- **`src/db/`** - the local database through **Drizzle ORM + expo-sqlite**. `schemas/` holds 38 persistent tables, including `plots` and `plotScenes`: synchronizable narrative and cross-cutting entities, plus client-only tables with no server equivalent (`clientSettings`, `servers`, `syncConflicts`).
- **`src/screens/`** - one folder per entity/feature, each with its own dedicated List/Detail/Form screens (there is no shared generic screen; see `screen_flow.md` for the full navigation flow):
  `characters/`, `locations/`, `narrative-elements/` (chapters, scenes and choices), `plots/` (list, detail, form, matrix, coverage and reader), `items/`, `itemJourneys/`, `tags/`, `worldrules/`, `notes/`, `gallery/`, `operationlog/`, `storyschema/`, `stats/`, `globalsearch/`, `mainstorystack/` (Dashboard, Story Settings, Story Analysis), `enterstack/` (Cold Install, story selection/CRUD, servers, friendships, profile), `examplestories/`. The `plots/` stack only enters the drawer for linear stories.
- **`src/state/`** - **Zustand** stores, one per entity (`characterStore`, `locationStore`, `tagStore`, ...) built by the shared factory **`createEntityStore.ts`**, which centralises what used to be duplicated (~140 lines) in every store: filter/search/sort state, favouriting with an optimistic update + rollback, initialising the service from the db + storyId, and the fetch cycle. Each store only supplies `collectionKey`, `createService` and `fetchEntities` (and optionally `updateFavorite`/`extraActions`/`persistKey`); the public API still carries per-entity names (`tags`/`fetchTags`) through mapped types. App-level stores (`themeStore`, `storyStore`, `userSettingsStore`, `syncConflictStore`, `connectivityStore`, `notificationStore`, `appAlertStore`) live in the same directory.
- **`src/services/`** - `storymanagement/` (one CRUD service per entity, e.g. `CharacterService`, `GlobalSearchService`), `entity-sync-handlers/` (the client-side counterpart of the API's handlers, applying received operations to the local database), `SyncEngineService`, `SyncConflictService`, `apiClient`/`AuthTokenManager`, `MediaFileService`/`webMediaStore`.
- **`src/navigation/`** - `AppNavigator.tsx` (the root) switches between `ColdInstallStack`, `StorySelectionStack` and `MainSystemStack` (the main drawer, described in `screen_flow.md`).
- **`src/components/`** - `common/` (generic components reused across entities: `GenericFilterSortList`, `AdvancedSearchModal`, `GenericExpandedListItemWithActions`, etc.), `listitem/` (one list item per entity), relation managers (`CharacterRelationManager`, `NoteManager`, ...) and graph renderers (`StoryGraph`, `LocationGraph`, `CharacterRelationGraph`).
- **`src/hooks/`, `src/utils/`, `src/theme/`, `src/locales/`** (`en.json`/`pt.json`) - shared hooks (`useEntityListScreen`, `useEntityRelations`, `useStorySchemaFields`, ...), utilities (graph layout/SVG, i18n, `documentTitle.ts`, `entityNavigation.ts`), theme and translations.

---

## `apps/desktop`

An **Electron** wrapper around `apps/client`'s web export. `main.ts`:

- Points `CLIENT_DIST` at the client's web build (`../../client/dist` in dev, `resourcesPath/client-dist` when packaged) and serves it through a custom `app://` protocol, with COOP/COEP headers - required by `expo-sqlite`'s WASM/OPFS driver in the browser (SharedArrayBuffer is only allowed on a "cross-origin isolated" page).
- Creates the `BrowserWindow` and keeps the window title in sync with the dynamic title the client itself already sets per screen (`DocumentTitleSync`/`setDocumentTitle`, see `apps/client/src/utils/documentTitle.ts`).
- Exposes media IPC (`media:write/read/delete-file/delete-directory/list-all`) to write/read imported media files on the real file system (outside Chromium's sandbox), unlike SQLite, which stays in OPFS.

---

## `apps/admin`

An SPA in **React + Vite + react-router-dom**, served by the API itself under `/admin/*`. It is an **internal** panel, not aimed at the end user (the writer): it manages users, subscription tiers/plans, registration-opening settings and account recovery. The same project also generates the **Showcase** (`vite.showcase.config.ts`, output in `dist-showcase/`), the showcase of published stories served by the API — a distinct thing from the GitHub Pages landing page.

---

## `apps/site`

Keres's public landing page, a static **React + Vite** SPA, in Portuguese and English, with the same look (light/dark) as the Showcase. It does not talk to the API: it describes the product and points at the repository, the GitHub Releases and the Docker image.

The `.github/workflows/pages.yml` workflow builds `apps/site/dist` and publishes it to GitHub Pages. The project site's URL is `https://<owner>.github.io/<repository>/` — Vite's `base` comes from `VITE_BASE` in CI, because the repository name preserves capitals (`Keres`). Locally: `bun run site:start` (port 5175) and `bun run site:build`.

On the first publication, in the repository's Settings → Pages, the source has to be **GitHub Actions**.
