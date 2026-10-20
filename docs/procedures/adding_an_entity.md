# Adding an entity, or a field

A synchronized entity (a "thing a story owns": a character, a scene page, a song) lives in several places at once: the shared contract, the server, the device, the sync protocol, the package a story is exported in, the screens and the texts. Nothing in the code generates all of that for you, so this is the checklist. Do the steps in order; the tests named at the end fail with the name of whatever you forgot.

Read first: [`docs/structure/file_structure.md`](../structure/file_structure.md) (where files go), [`docs/structure/conflict_resolution_client_strategy.md`](../structure/conflict_resolution_client_strategy.md) (how a change travels) and, for the rules of the log, [`docs/structure/project_plan.md`](../structure/project_plan.md).

A complete, recent example to copy from is **`ScenePage`**: search the repository for `ScenePage` / `scenePages` / `scene_page` to see every place it appears (about 17 source files, plus migrations, texts and tests). **`SceneMusic`** and **`Song`** are other full examples.

## Before you start: five decisions

1. **Is it story data?** Anything that belongs to one story, is edited by its collaborators and must reach other devices is a synchronized entity. Settings that are only this device's (`clientSettings`, drafts, caches) are not; they need a client table and nothing else in this document.
2. **Is it a link or a part?** A join between two entities, or something that is part of another entity (a scene's pages), is not counted against a plan's entity limit. The default is that a new entity **is counted**; if it should not be, add it to `TIER_RELATIONAL_ENTITY_TYPES` or `TIER_PART_ENTITY_TYPES` in `EntityRegistry.ts` (with the reason in the comment above the list).
3. **Does it carry an order?** Use a `rank` column (`packages/shared/rules/rank.ts`), as `ScenePage` does, not an integer `index`.
4. **Does it point at other rows?** Decide what happens to it when the target is deleted (cascade, keep with a "removed" state like a page whose image is gone, or refuse). The sync handler has to enforce the same thing the services do.
5. **Which versions move?** `CURRENT_STORY_FORMAT_VERSION` and `SYNC_PROTOCOL_VERSION` in `packages/shared/metadata/ReleaseVersions.ts` change **only in an official release**, by a person, never in ordinary development (raising them mid-cycle cuts off other devices and invalidates the example stories). During development, add the new field to the export migration (`storyExportMigrations.ts`) as the release will need it, and leave the numbers to the release checklist ([`release_process.md`](release_process.md)).

## Steps

`<Entity>` is the PascalCase name (`ScenePage`), `<entity>` its table name in snake_case (`scene_pages`), `<entities>` the camelCase plural used in the export (`scenePages`).

### 1. Shared contract (`packages/shared`)

- [ ] `entities/narrative/<Entity>.ts` - the TypeScript interface. Every synchronized row has `id`, `storyId`, `createdAt`, `updatedAt`, `version`, `isDeleted`, `deletedAt`.
- [ ] `schemas/narrative/<Entity>Schemas.ts` - the Zod schemas the wire and the server validate with: the full row, the create payload and the partial (update) payload. Add a test in `packages/shared/test/schemas/`.
- [ ] `metadata/OperationLogEntityType.ts` - add the enum member. It is the name used in the operation log and in the sync protocol.
- [ ] `entity-solvers/entities/<Entity>EntityHandler.ts` and its registration in `entity-solvers/entities/EntityRegistry.ts` - the one registry that says how the entity is exported (`exportCollection`), whether it syncs, how a log entry is shown and which entities it points at. Add the type to `entity-solvers/entityTypeAliases.ts` if it needs an alias.
- [ ] `metadata/entityAppearance.ts` - its icon and colours (a join row with no screen of its own is the only exception).
- [ ] `index.ts` - export the entity and the schemas.
- [ ] `schemas/story/FullStorySchemas.ts` - the optional collection in the story package (`<entities>: z.array(...).optional()`), and `storyExportMigrations.ts` - the migration that gives an older package an explicit empty list.

### 2. Server (`apps/api`)

- [ ] `src/db/schema/tables/<entities>.ts` and its export in `src/db/schema.ts` - the table, written once for Postgres and SQLite.
- [ ] Generate the migrations (step 4 below).
- [ ] `src/services/entity-sync-handlers/<Entity>SyncHandler.ts` (extend `BaseSyncEntityHandler`: create, update, delete, the checks on what it points at), registered in `registerApiSyncHandlers.ts`, and the table in `ApiEntityTableRegistry.ts`.
- [ ] `src/services/story-packages/` - importing a story package: the collection must be inserted (`DatabaseStoryPackageAssetsImport.ts` or the collection repository), with new ids remapped.
- [ ] If a published manuscript or the online reader shows it: `src/services/publication/`.
- [ ] Tests: a sync integration test (`test/modules/<entity>Sync.integration.test.ts`, modelled on `scenePageSync`) and the export/import round trip (`test/services/storyExportRoundTrip.integration.test.ts`).

### 3. Device (`apps/client`)

- [ ] `src/db/schemas/<entities>.ts` and its export in `src/db/schemas/index.ts` - the local table, mirroring the shared schema column for column.
- [ ] `src/db/entityTableRegistry.ts` - map the entity name to the table.
- [ ] `src/services/storymanagement/<domain>/<Entity>Service.ts` - the CRUD. **Every write must go through `runLocalWrite` and record an operation** (`recordLocalOperationSync`), as `ItemService` does; that is how the change reaches the server. Do not write to the table from anywhere else. Emit the change event after the write.
- [ ] `src/state/events/entityEvents.ts` - the `<entity>_changed` event; `src/services/sync/syncEvents.ts` - map the entity to it so a pulled change refreshes the screens.
- [ ] `src/services/entity-sync-handlers/<Entity>ClientSyncHandler.ts`, registered in `src/services/sync/registerClientSyncHandlers.ts` - how a change pulled from the server is applied locally.
- [ ] `src/services/entity-solvers/ClientEntitySolverContext.ts` - the noun used when a log entry or a conflict names it.
- [ ] `src/services/storymanagement/story-lifecycle/storyLocalPurge.ts` - the table must be erased when the local copy of a story is removed.
- [ ] `src/services/storymanagement/packs/story-packages/` - importing a package into the local database (relations or narrative import, depending on the entity), and `src/content/example-stories/cloneExampleStory.ts` with the example JSON files (an empty list is fine when the examples have none).
- [ ] If it is shown as a list: a store (`src/state/story/<entity>Store.ts`, built with `createEntityStore`), hooks, and the screens (list, detail, form) in `src/screens/<entity-folder>/`, registered in the stack (`src/navigation/stacks/MainSystemStacks.tsx`) and the drawer menu (`src/navigation/drawer/mainDrawerMenu.ts`) when it has its own entry. Follow the pattern of an existing entity; forms use `EntityFormContainer` and `useEntityFormActions`.
- [ ] Texts: `src/locales/en.json` and `pt.json` (both, same keys; `bun run locales:audit` checks), the label on the entity count screen (`src/utils/entity/entityCountLabels.ts` and its two `entity_count_*` keys), and a help page when the user needs one (`src/content/help/`).
- [ ] The vocabulary (`src/vocabulary/`) only if the entity's name should be renamable per story.

### 4. Migrations

Run this once the three schemas (server, server SQLite, device) are written:

```bash
bun run db:generate
```

It runs `drizzle-kit` for the Postgres schema (`apps/api/drizzle/`), the SQLite schema (`apps/api/drizzle-sqlite/`) and the client schema (`apps/client/drizzle/`), then regenerates the client migration index (`apps/client/src/db/migrations/index.ts`, never edited by hand). Read the generated SQL before committing it. Do not hand-edit an already released migration; add a new one.

### 5. Tests that must exist

- [ ] A service test with the real local database (`apps/client/test/services/...`, helper `test/helpers/testDb.ts`): create, update, delete, and that the operation was recorded.
- [ ] The sync convergence fuzz must know the entity: model it in the helpers under `apps/client/test/helpers/syncFuzz*.ts` (a test fails if a synced type is not modelled).
- [ ] The API sync handler is exercised by an API test (a test fails if a registered handler is not mentioned by one).

## The tests that tell you what you forgot

You do not have to remember the list above: run the architecture tests and read the name in the failure.

| Test | Fails when |
| --- | --- |
| `apps/client/test/architecture/syncedEntityCompleteness.test.ts` | A synchronized entity has no client sync handler, no icon and colour, or no label on the entity count screen in both languages. |
| `apps/client/test/architecture/writeServicesRecordOperations.test.ts` | A story-management service writes to the database without recording an operation. |
| `apps/client/test/architecture/entityParity.test.ts` | A column exists in the client table and not in the shared schema, or the other way round. |
| `apps/client/test/db/entityTableRegistry.test.ts` | A synchronized entity has no local table in the registry. |
| `apps/client/test/architecture/operationLogResolverCoverage.test.ts` | The operation log cannot present an operation type. |
| `apps/client/test/services/SyncConvergenceCoverage.test.ts` | The sync fuzz does not generate the new type. |
| `apps/client/test/services/storymanagement/story-lifecycle/storyLocalPurge.test.ts` | A table with a `storyId` is not erased with the story. |
| `apps/api/test/architecture/apiEntityTableRegistry.test.ts` | The server does not map an entity to a table, or an export collection to an entity. |
| `apps/api/test/architecture/syncHandlerCoverage.test.ts` | A server sync handler has no test. |
| `apps/api/test/db/migrationParity.integration.test.ts` | The Postgres and SQLite migrations disagree. |
| `packages/shared/test/entity-solvers/tierCounting.test.ts` | The entity is not classified for the plan's limits. |
| `apps/client/test/architecture/layering.test.ts`, `importBoundaries.test.ts`, `importStyle.test.ts` | A file is in the wrong layer, imports across a boundary, uses `../`, or is over the 600-line ceiling. |

Then run `bun run typecheck`, `bun run lint` and `bun run test:report` (see [`docs/structure/testing.md`](../structure/testing.md)).

## Adding a field to an existing entity

The same chain, shorter:

1. The shared interface and the Zod schemas (full, create and partial), with a default or `nullable` so older rows and older packages still parse.
2. The server table, the client table and `bun run db:generate`. A new column on an existing table must be nullable or have a default.
3. The services that read and write it (the update payload is partial, so check that a field left out is not overwritten), and the sync handlers only if they list columns explicitly.
4. The export: a story package from an older version has no such key, so the export migration (`storyExportMigrations.ts`) gives it an explicit value, and the version numbers move in the release.
5. The form, the detail and the list that show it, with `en.json` and `pt.json`; the search fields (`packages/shared/metadata/entityFields.ts`, `globalSearchFields.ts`) if it should be searchable.
6. Tests: the shared schema, the service, and the sync round trip. `entityParity` and `migrationParity` fail if the client, shared and server definitions disagree.

## Things that are easy to get wrong

- **Writing to the table without the log.** A row that exists only on this device is a sync bug nobody sees. Always use the service.
- **Deleting a row for real.** Deletion is a tombstone (`isDeleted`, `deletedAt`), so that other devices learn of it. `softDeleteRowSync` does it.
- **Mutating an old migration.** Released databases already ran it.
- **A column that is required in one place and optional in another.** The wire strips unknown keys and rejects missing required ones, so a mismatch drops data or blocks the story's sync.
- **Changing the version numbers in a feature branch.** They belong to the release.
