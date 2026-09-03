# Keres - Story Organizer Project Plan

An offline-first organizer for stories (solo or collaborative), with intelligent synchronization between local devices and a remote server. Keres offers writers a way of organizing characters, locations, scenes, world rules and the narrative structure, focused on quick access and efficient organization.

The backend uses **Elysia (Bun)** + **Zod** for routes/validation, **Drizzle ORM** for persistence (**PostgreSQL** on the server), **ULID** as identifiers. The frontend is **React Native + Expo** (native mobile and web through React Native Web) with support for a local SQLite (Drizzle + expo-sqlite) in an offline-first model with a synchronization engine of its own. The frontend's web build is what the desktop app (**Electron**) packages for Windows/Mac/Linux. A separate administration panel (React + Vite) is served by the API itself.

> See `docs/file_structure.md` for the complete, up-to-date directory mapping - the structure below is a high-level summary.

---

## 📂 Repository structure

```
Keres/
├── apps/
│ ├── api/      # Elysia API (Bun) + Drizzle/Postgres
│ │ ├── docker-compose.yml
│ │ ├── src/
│ │ │ ├── index.ts    # Elysia app bootstrap
│ │ │ ├── modules/    # routes + handlers per resource (auth, sync, story, friend, admin, ...)
│ │ │ ├── services/   # business logic + entity-sync-handlers/
│ │ │ └── db/         # Drizzle schema (Postgres) and migrations
│ ├── admin/    # internal administration panel (React + Vite), served by the API at /admin
│ ├── site/     # public landing page (GitHub Pages)
│ ├── client/   # frontend (React Native + Expo, mobile and web)
│ │ └── src/
│ │   ├── db/        # Drizzle schema (local SQLite) and migrations
│ │   ├── screens/    # one folder per entity/feature
│ │   ├── state/      # Zustand stores (createEntityStore.ts)
│ │   ├── services/   # per-entity CRUD + the sync engine
│ │   └── navigation/
│ └── desktop/  # Electron wrapper around the client's web build
│
├── packages/
│ └── shared/   # shared entities (TS), Zod schemas, metadata and utils
│
├── package.json
└── README.md
```

---

## 🗄️ Data structure

### Users
The application has a single login. This user may have as many stories as they wish, without one story's tables interfering with another's (e.g. one story's "locations" must not appear in another).

**A note on the local (client) `User` table:**
The `User` table in the client's local database works primarily as a **cache of reference data**. It stores minimal information about remote users (such as `id`, `username`, `displayName`, `avatarUrl`, `version`) that is referenced by stories or other entities the local user owns or interacts with. This table is **not** meant to be a complete copy of every user on the remote server, nor a social "friend list". The synchronization engine is responsible for populating and maintaining this cache, guaranteeing that relevant users' data is available offline so as to keep the stories' referential integrity.

**An important note on synchronization:** to support the offline-first synchronization engine, every persistent entity (such as `Story`, `Character`, `Chapter`, etc.) includes a `version: number;` field. This field is crucial for detecting and resolving conflicts during the synchronization process between clients and the server, guaranteeing data consistency.

### Story
The main table. It stores the story's general data (`title`, `type: 'linear' | 'branching'`, `description`, `genre`, `language`, `author`, ...). `userId` references the owner; `serverId` (on the client only) references which remote server, if any, the story is linked to - `null` means a strictly local/offline story.

### Characters
No story exists without characters.

### Chapters
A collection of scenes. It does not mean chronological order, but "display order".

### Scenes
The fundamental narrative units.

### Plots / Plot Scenes
`Plot` represents a narrative thread within a story. It has a `name` and
`details`, belongs to a single `Story` and may group any number of scenes — including
none, while it is still being planned. A scene may take part in several Plots, so
the relation is N:N and not a column on `Scene`.

`PlotScene` materialises that relation (`plotId` + `sceneId`) and holds a required `note`, of
a single line and at most 160 characters, explaining that scene's role in that plot. The
`(plotId, sceneId)` pair is unique and both entities must belong to the same story. The relation
is edited in the Plot form; there is no separate `PlotScene` form.

Plots work in both story shapes and survive linear/branching conversion. In branching stories,
their scene membership is presented as graph distribution rather than as a reading order. `Plot`
and `PlotScene` take part in export/import, synchronization, tombstones and the operation log.
`Plot` appears in the Global Search by name and details; `PlotScene`, being a join, is not an
independently navigable destination. Deliberately, Plots do not get tags, favourites, comments,
suggestions or custom attributes.

The history of the decisions and the implementation's acceptance criteria are preserved in
[`finished_planning/PLOT_IMPLEMENTATION_PLAN.md`](finished_planning/PLOT_IMPLEMENTATION_PLAN.md).

### Locations
General information about a place.

### Gallery / Gallery Relations
`Gallery` is a media asset (image/video/audio) of the story, identified by a content hash. `GalleryRelation` is the N:N table that links a `Gallery` to any "owning" entity (`ownerId` + `ownerType`) - that is how the same image can illustrate a Character, a Location, a Note, etc., without the Gallery having to know in advance whom it belongs to.

### Relational tables

#### Character X Scene (`CharacterScene`)
Lists who was where and when.

#### Character X Character (`CharacterRelation`)
Fixed relations. Such as "siblings", "Master/Slave", "Mother/Daughter"...

#### Location X Location (`LocationRelation`)
A relation between two locations, with a `relationType`: `contains` (directional - `locationAId` is the "parent" location containing `locationBId`) or `connected_to` (an unordered pair, e.g. two cities linked by a road).

#### Plot X Scene (`PlotScene`)
An N:N membership relation available in both story shapes. A scene may develop several plots and
a plot may cross scenes from different chapters or graph branches. The join's short note describes
the scene's specific role in that plot; branching surfaces use labelled graph/catalogue order,
never an invented reading order.

#### Tag X <entity> (`TagRelation`) / Note X <entity> (`NoteRelation`)
The same polymorphic pattern as `GalleryRelation`: a generic join table linking a `Tag`/`Note` to any entity of the story, instead of a fixed FK column per type.

#### Stats, modes and values (`Stat`, `StatStrength`, `StatRelation`, `Mode`)
When `Story.statSystem` is on, `Stat` defines a measurable axis (for example, Strength); only the primary axes enter the radar. `StatStrength` defines the story's default scale or a scale exclusive to one stat. `StatRelation` holds a character's value on a stat and, optionally, in a `Mode`; with no value of its own in the mode, the character's normal value applies. `Mode` exists independently of the stat system and describes an alternative form/state of the character.

#### Comments and "See also" (`Comment`, `SeeAlsoRelation`)
`Comment` is a conversation attached to a field of a navigable entity, not merely a loose remark about the entity. It points at a native (`fieldKey`) or custom (`fieldId`) field, preserves the content/excerpt seen at the time and records the author and criticality. `SeeAlsoRelation` is a free reciprocal link between two compatible entities.

### Choices
Represents the transitions between scenes in branching stories (CYOA) - `sceneId` (source) → `nextSceneId` (target) + `text`. See `docs/choice_mechanics.md` and `docs/dynamic_story_structure.md` for the full detail (linear stories never have explicit `Choice`s; navigation follows the scenes' `index`).

### Routes / Route Steps
`Route` is an authored possible traversal in a branching story. Its ordered `RouteStep` visits
record both the scene and the exact selected outgoing Choice, allowing loops and repeated scenes.
Routes are validated against the current graph, synchronize and export with the story, and are used
by the route-aware Reader. The Story Navigator can simulate Choices in memory and save its visited
path as a Route; it never persists simulated item or trigger state.

### Items / Item Journeys
`Item` is an object in the story (a weapon, an artefact, ...). `ItemJourney` records an item's "journey" through the narrative: in which `sceneId` it changes, to what `newState`, and optionally changes owner (`newCharacterOwnerId`) - it is an item's possession/state history told scene by scene.

### World Rules
For example, who can do what? What is the balance of power?

E.g. Mana is required to cast spells.
E.g. With elemental crystals, we can power machines to cast the same spells of that element.
E.g. Nobody can use the light element. Except our protagonist. That is what makes them special.

### Notes
Any author must be able to write freely, without much organization or being tied to something. The system will allow anchoring to something, but will not force it. Anchoring is implemented through `NoteRelation` (see above) - a note may be linked to zero or more entities.

### Tags
Implemented as an entity of their own (`Tag`, with `name`/`color`) plus a polymorphic join table (`TagRelation`) that allows applying any tag to any entity of the story, instead of a fixed enum per field.

### Story Schema Fields / Attribute Values (Custom Attributes)
Besides each entity's native fields, the user may define **custom fields** per story for the entities in `StorySchemaEntityType` (`Character`, `Location`, `Item`, `Scene`, `Chapter`, `Note`, `WorldRule`). `StorySchemaField` defines the field (name, key, type - `AttributeType`: text, long text, number, boolean, date or suggestion). `AttributeValue` is that field's value for a specific entity (`entityType` + `entityId` + `fieldId` + `value`, always stored as text and encoded/decoded by `attributeValueCodec.ts` according to the type). It is that pair of tables that gives each story the flexibility of "adding any attribute to any character/location/etc" without altering the physical schema.

### Operation Log
Every synchronizable operation (create/update/delete on any entity covered by `OperationLogEntityType`) generates an entry in the operation log, both on the client and on the server - it is the audit trail and the source of truth for the pull/push synchronization mechanism (see the synchronization section below).

### Publications (`StoryPublication`)
A publication is an immutable package of one version of the story for the Showcase. It references the story and the owner, but deliberately stays outside the incremental synchronization and the operation log; its metadata describes the package and that version's public snapshot.

### Suggestions
`Suggestion` is a per-story synchronizable entity (`storyId`, `type`, `value`) that underpins the reusable suggestion system. The `type` identifies the source/catalogue used by native and custom fields; that way, values entered in one source can be reused wherever that source is offered. Besides plain text, the system supports named lists and custom suggestion or suggestion-list fields.

## Integrated help

The client includes a help catalogue in Portuguese and English, with local search, task-based pages, tables of visible fields and contextual access from the screens' headers.

## Cross-cutting story features

- **Favourites:** a story or element may be highlighted for filters and lists. In shared stories, the favourite's behaviour is defined in the story's settings.
- **Comments:** collaborators and authorized readers may comment on a native or custom field of a navigable entity; each comment preserves the field's context and the comment list brings those conversations together.
- **See also:** creates a free, reciprocal link between related elements, without replacing tags or notes.
- **Branching stories:** choices may have checks (visits, items or flags) and effects (grant/take an item or turn a flag on/off). These features form the reader's state and are analysed alongside the story map.
- **Plots:** Plots group overlapping scenes without altering narrative topology. Linear stories show matrix/coverage and a textual reader; branching stories show graph distribution and map highlights without claiming a single reading order. A scene may count towards more than one plot, so coverage percentages need not add up to 100%.
- **Collaboration:** a story linked to a server may have collaborators; permissions and reader comments are configured in the story itself.

### Entity relationship chart

> A diagram of the story's content structure. Administrative and infrastructure entities are in the separate diagram below. `Suggestion` is the story's reusable suggestion catalogue. The publication appears dotted because it is a derived package, outside the incremental synchronization.

```mermaid
graph LR
    users --> story

    story --> characters
    story --> gallery
    story --> chapters
    story --> locations
    story --> world_rules
    story --> notes
    story --> tags
    story --> items
    story --> plots
    story --> plot_scenes
    story --> modes
    story --> stats
    story --> stat_strengths
    story --> stat_relations
    story --> story_schema_fields
    story --> attribute_values
    story --> comments
    story --> see_also_relations
    story --> favorites
    story --> effects
    story --> suggestions
    story --> operation_log
    story -. immutable publication .-> story_publications

    chapters --> scenes
    locations -- occurs on --> scenes

    plots --> plot_scenes
    plot_scenes --> scenes

    scenes -- source --> choices
    choices -- target next_scene_id --> scenes
    choices --> choice_check_groups
    choice_check_groups --> choice_checks
    scenes --> effects
    choices --> effects
    choice_checks -- scene/item condition --> scenes
    choice_checks -- item condition --> items
    effects -- grants/takes --> items

    tags -- via tag_relations (polymorphic) --> chapters/scenes/characters/locations/items/notes/world_rules
    notes -- via note_relations (polymorphic) --> chapters/scenes/characters/locations/items/world_rules
    gallery -- via gallery_relations (polymorphic) --> chapters/scenes/characters/locations/items/notes

    characters --> character_relations
    character_relations --> characters

    characters --> character_scenes
    character_scenes --> scenes

    locations --> location_relations
    location_relations --> locations

    items --> item_journeys
    item_journeys -- occurs on --> scenes
    item_journeys -- may reassign owner --> characters

    characters --> modes
    characters --> stat_relations
    modes -- optional override --> stat_relations
    stats --> stat_strengths
    stats --> stat_relations

    comments -- fieldId --> story_schema_fields
    comments -- fieldKey or entityType/entityId --> chapters/scenes/characters/locations/items/item_journeys/notes/tags/world_rules/choices
    see_also_relations -- reciprocal --> characters/locations/chapters/scenes/items/item_journeys/world_rules/choices
    favorites -- user marks --> story/characters/chapters/locations/scenes/notes/world_rules/items/gallery/tags

    story_schema_fields -- defines custom fields for --> attribute_values
    attribute_values -- value for entityType+entityId --> characters/locations/items/scenes/chapters/notes/world_rules
```

### Administrative and server entity diagram

> This diagram separates administration, server configuration, auditing and publication from the narrative graph. Where a relation reaches story content, it points at the **Story diagram** node without repeating its internal entities.

```mermaid
graph LR
    users[User]
    tiers[Tier]
    registration_settings[Registration settings]
    recovery_codes[Recovery codes]
    api_logs[API logs]
    showcase_settings[Showcase settings]
    media_storage_settings[Media settings]
    showcase_entry[Story publication in the Showcase]
    publication[Published version]
    story_diagram[Story diagram]

    users -- belongs to / receives limits --> tiers
    registration_settings -- default tier --> tiers
    users -- owns --> recovery_codes

    api_logs -- may reference --> users
    api_logs -- may reference --> story_diagram

    showcase_settings -- enables --> showcase_entry
    media_storage_settings -- defines the blob destination for --> story_diagram

    story_diagram -- may have --> showcase_entry
    showcase_entry -- owner --> users
    showcase_entry -- gathers versions --> publication
    publication -- owner at publication time --> users
    publication -- snapshot of --> story_diagram
```

## 🔗 Architecture flow

- **API** (`apps/api`)
  - Elysia (Bun) exposes REST/JSON routes.
  - Zod validates inputs/outputs.
  - Drizzle handles the DB.
  - ULID generates the ids.
  - The synchronization engine (op-based replication)

### Conflict resolution strategy

The current behaviour is in `docs/conflict_resolution_client_strategy.md`. In summary:

*   **OCC by the entity's `version`.** An update requires `changes.version` (the base the client read). The comparison is for equality, not `<`. Omitting the base is **not** last-write-wins: the push 422s.
*   **Different fields of the same entity** are merged automatically. The same field, with different values, becomes a conflict for the user (`SyncConflictService`).
*   **Deletion vs. edit** does not resolve itself: the screen offers restoring, accepting the tombstone or resending the local delete. Tombstones use `isDeleted` / `deletedAt`.
*   **Writer ≠ owner.** Only the owner deletes the story or changes `userId` / `type` / `favoriteBehavior` / `allowReaderComments`. The client refuses the same mutations locally (`assertStoryIsOwned` / the policy fields in `StoryService.updateStory`) so as not to queue a push the server would refuse forever.
*   The operation log retransmits the sanitized payload (what the server wrote), not the client's raw JSON.

### Update storage strategies for synchronization

*   **Stories linked to a server:** the local log holds the operations not yet accepted (`isSynced = false`) and the already synchronized ones (auditing / the pull's echo). There is no automatic pruning of the accepted ones.
*   **Local-only stories:** the same log exists for the operations screen; there is no 500-entry ceiling implemented.

### The synchronization mechanism in detail

1.  **Format (`StoryUpdate`):** a Zod union in `packages/shared/schemas/SyncSchemas.ts`. A create carries `id` (the client's ULID) + `data`. An update carries `id` + `changes` with `changes.version` required. A delete carries `id` and, for child entities, `version`. A reorder carries `reorderItems`.
2.  **Tracking:** every mutation in the `storymanagement/` services calls `recordLocalOperation` *after* the local write. The update/delete/reorder payload includes the *resulting* version; the engine derives the base as `version - 1`.
3.  **Protocol:** REST `POST /sync/:storyId` (push, up to 200 ops) and `GET /sync/:storyId/pull` (pages of up to 500). The WebSocket (`/events`) only notifies that there is new work; the cycle itself is still HTTP pull/push. JWT + refresh.
4.  **Authorization:** `owner` / `writer` / `reader`. A reader only writes their own Favorite and, if allowed, their own Comment.
5.  **Bootstrap:** a local story goes up through `POST /stories/import`. A remote story comes down through `GET /stories/:id/export` + a local import. The incremental sync starts after the link.
6.  **Merge:** disjoint fields on the pull and in the `version_conflict` response (`changedFields`). The same field → the review sheet on the dashboard. A reorder disputes the whole order.
7.  **Batch:** it is not all-or-nothing. Each operation is applied and recorded on its own; the response lists `applied` and `conflicts`. The client only marks `isSynced` what came in `applied`.
8.  **Cursor:** `lastServerSyncedLog` only advances to the last remote operation actually applied. A failure in the middle of a page does not skip that operation.
9.  **Media:** bytes go up/down through `/media` after the metadata. A hash already existing in storage can only be linked to a story that already references it.

- **Frontend** (`apps/client`)
  - Developed with React Native, Expo and React Native Web for a unified codebase (native mobile and web/desktop from the same code).
  - Operates offline-first using **Drizzle ORM over expo-sqlite** as the local database (native SQLite on mobile/desktop; wa-sqlite/WASM + OPFS in the browser).
  - Synchronizes automatically with the remote API through the synchronization engine.

### Environment configuration

Keres takes an offline-first approach, where the environment configuration for the database is adapted to support both local use (SQLite) and the connection to a remote server (PostgreSQL).

#### The `DATABASE_URL` variable

The database connection string is the main way of configuring persistence.

*   **For local use (offline-first):** the client will use a local SQLite database.
*   **For connecting to the server:** the server will connect to a PostgreSQL database (e.g. `postgres://user:password@localhost:5432/keres_db`).

#### The `JWT_SECRET` variable

The secret used to sign and verify JSON Web Tokens (JWTs) is configurable:

*   **For the server:** a strong, random secret, securely managed, is recommended.
*   **For the client (offline-first):** it may be a fixed secret or one generated on the first run, used for local token checks.

#### Example `.env` files

You can use `.env` files to manage these environment variables.

**`.env` for the server:**

```dotenv
DATABASE_URL=postgres://your_user:your_password@your_db_host:5432/your_db_name
JWT_SECRET=your_strong_jwt_secret_for_online
JWT_SECRET_REFRESH="your_strong_jwt_secret_for_online_refresh"
ROOT_ADMIN_USERNAME="root"
ROOT_ADMIN_PASSWORD="password"
```
---

## 🏗️ Milestones already completed

This section was originally a list of next steps, written before any implementation. Every item below has already been completed - kept here only as a historical record of scope, not as pending work:

- ~~Define migrations in `packages/db` (Drizzle).~~ Migrations live in `apps/api/src/db/` (Postgres) and `apps/client/src/db/` (local SQLite) - there is no `packages/db`.
- ~~Create Zod contracts in `packages/shared`.~~
- ~~Implement the base CRUD routes (users, stories, characters).~~ Full CRUD for every entity listed in the "Data structure" section, not just the original three.
- ~~Develop the synchronization engine.~~ See `apps/api/src/services/entity-sync-handlers/` and `apps/client/src/services/SyncEngineService.ts`/`entity-sync-handlers/`.
- ~~Create a desktop app with integrated SQLite (Tauri/Electron).~~ Electron, packaging the client's web build (SQLite through expo-sqlite/OPFS, not a separate native binding) - see `docs/file_structure.md`.

For the current state and work in progress, there is no roadmap maintained in this folder at the moment - consult the repository's commit/branch history.
