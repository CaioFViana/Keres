# Boards (freeform corkboard)

## 1. What this is, and what it is not

A **Board** is a named spatial sketch over the story's dictionary: pins of existing entities, free notes that are not entities yet, and arrows that are **not** story relations. Several small boards ("Royal family", "Act II conspiracy") rather than one infinite corkboard.

It is **not**:

- The story map, location graph, or character-relation graph (those stay auto-laid-out and faithful to the model)
- Scrivener's ordered scene corkboard (Keres is not the prose editor)
- A way to create `CharacterRelation`, `LocationRelation`, or `SeeAlsoRelation` by drawing

It is Milanote-shaped thinking beside the dictionary, which is FEATURE_LANDSCAPE §4 #1.

---

## 2. Why one JSON column (same argument as calendars)

Pins and edges are never edited independently. A session rearranges a drawing; last-write-wins on the whole `content` blob is the correct conflict unit. Modelling nodes and edges as sync entities would multiply handlers, OCC stories, and migrations for no merge benefit — two layouts of the same graph cannot be field-merged anyway.

`storyCalendars.definition` already uses `mode: 'json'` because `recordLocalOperation` serialises the row, and a stringified blob would double-encode on the server. Boards copy that column style.

The **entity** is still a normal synced row (`id`, `storyId`, `name`, `description`, `content`, version, tombstone). Only the drawing is JSON.

---

## 3. Storage

### 3.1 `boards`

```ts
boards = {
  id,            // ULID — the Board entity, like any other
  storyId,
  name,          // required
  description,   // short, nullable
  content,       // BoardContentSchema (json mode)
  createdAt, updatedAt, version, isDeleted, deletedAt
}
```

Sibling to `storyCalendars`. No `isPrimary`. No uniqueness on name.

### 3.2 `BoardContentSchema`

```ts
nodes: BoardNode[]
edges: BoardEdge[]
```

**Node id:** 8 characters from the ULID/Crockford alphabet, unique **inside that board**, not globally. Generated on add; reject collision and retry. A full 26-char ULID is unnecessary — these ids never leave the JSON, never hit the operation-log entity id column.

**Entity node**

```ts
{
  id: string,                 // 8-char board-local
  kind: 'entity',
  x: number,
  y: number,
  entityType: BoardPinEntity, // see §3.3
  entityId: string,           // ULID of the live row
  labelAtPin: string,         // snapshot at pin time — ghost label if the entity is later deleted
}
```

The same entity may appear as many times as the writer wants. Each add creates a new node id. There is no unique `(entityType, entityId)` constraint.

**Note node** (not a `Note` entity, not a table)

```ts
{
  id: string,
  kind: 'note',
  x: number,
  y: number,
  title: string,              // may be empty; UI falls back to a placeholder
  body: string | null,
}
```

**Edge** (board-only; free text, not relation enums)

```ts
{
  id: string,                 // 8-char board-local
  from: string,               // node id
  to: string,
  directed: boolean,
  label: string | null,
}
```

Zod validates the shape on write (create/update/sync), same as `CalendarDefinitionSchema`. Dangling `from`/`to` are rejected. Dangling `entityId` is **allowed** — that is the ghost (§6).

### 3.3 What can be pinned

```ts
BOARD_PIN_ENTITIES = ['Character', 'Location', 'Note', 'Scene', 'Item', 'Gallery', 'Chapter'] as const
```

**Event** is `Chapter` with `type === 'event'`. The picker groups numbered chapters and events separately in the UI; the stored type is still `Chapter`. No Plot, WorldRule, Tag, or Choice in V1 (Choices already have a map).

Live names are resolved at render. `labelAtPin` is only the fallback.

---

## 4. Editing model: dirty canvas, explicit save

Opening a board copies `content` (and name/description if edited there) into React state.

- **Drag** updates local state only.
- **Add pin / add note / add or remove edge** — local state.
- **headerRight Save** — one `update` with the whole `content`. One operation-log row per save, not per pixel.
- **headerRight Revert** — restore from the last loaded/saved snapshot.
- **Leaving dirty** — the same discard alert forms already use. Do not silent-save on blur.

Name and short description can be edited from the list (create/rename) or a small header control; they are ordinary columns and **can** auto-merge with a concurrent `content` edit (disjoint fields). Do not stuff the name into the JSON.

---

## 5. Surfaces

### 5.1 Drawer

A **Board** stack of its own (`BoardList` → `BoardCanvas`), like Gallery — not folded into Customization. That was an explicit product choice: boards are a place to work, not a setting.

List: name, short description, create/delete. Opening a row is the canvas, not a form for the JSON. The canvas **is** the editor.

### 5.2 Canvas

Reuse `usePanZoomCanvas` + `GraphCanvasFrame`. Nodes are native `View`s (same reason as `StoryGraphCanvas`: real text and touch). Edges are SVG (`Path`; arrowhead only if `directed`).

**Click vs drag:** a tap opens the node sheet; a movement past a threshold (the canvas already has `DRAG_THRESHOLD`) moves the node. Two-finger pinch remains zoom — a node must not steal the responder from a pinch.

**Growing the drawing:** today's clamp exists so a derived graph cannot be lost off-screen. A freeform board must **grow** its `width`/`height` (node bbox + padding) when a pin is dragged toward the edge, otherwise clamp fights the user. Minimum size is at least the viewport.

Decoration: icon + colour by `entityType` (existing `ENTITY_TYPE_ICONS`), live name, or `labelAtPin` / “Deleted entity”. Notes look like a sticky, not a scene card. Do not clone Choice-map chapter colouring — that graph is scenes-only.

### 5.3 Adding nodes

A grouped picker in the same family as `useGalleryOwnerOptions` / `useSeeAlsoEntityOptions` (`MultiSelectPill` groups, `loadEntityOptions`). Plus an action **Add note** that drops a `kind: 'note'` node near the viewport centre.

Place new nodes in a visible gap (viewport centre + small stagger if several are added at once).

### 5.4 Node sheet

Extend the `GraphNodeSheet` idea (do not navigate away):

- Title (live name, snapshot, or note title)
- Ghost badge when the entity is missing/tombstoned
- **Open entity** — existing entity navigation, **only if live**
- List of board edges from/to this node (edit label, directed flag, delete edge)
- **Connect to…** another node already on this board (not the whole dictionary): directed toggle + optional free-text label
- **Remove from board** (deletes the node and its edges in local JSON)
- Note nodes: edit title/body here instead of “open entity”

Board edges are never written to relation tables. Copy must not sound like “siblings” / “contains”.

---

## 6. Deletion of a pinned entity

Deleting a Character (etc.) **does not rewrite any board**. The pin stays. Render:

- badge / title: `labelAtPin` plus “Deleted entity”
- not tappable into navigation
- edges remain, so the sketch does not collapse

If the entity is restored from a tombstone, the pin is live again (same `entityId`). That is the point of not cascading.

---

## 7. Sync and conflict

OCC on `boards.version`, like every entity.

- Disjoint columns (e.g. local `name`, remote `content`) already auto-merge in `findContestedFields`.
- Both sides changed `content` → `concurrent_edit`. **Do not merge JSON graphs.**

Conflict UI (banner / `SyncConflictReviewSheet`), only when `content` is contested, three actions:

| Action | Meaning | Mechanism |
| --- | --- | --- |
| Keep mine on this board | Overwrite the server drawing | existing `resolveKeepLocal` |
| Keep the server's | Discard local drawing | existing `resolveKeepServer` |
| Keep the server's **and** save mine as another board | Neither drawing dies | `create` a new Board with local `content` + a derived name (`"{name} (copy)"`), **then** `keepServer` on the original |

Create the clone **first**. If create fails, do not discard local work.

Clone is hidden when `content` is not in the contested set (a name-only clash uses the normal two buttons).

Silent last-write-wins on `content` is forbidden. Two collaborators who both clone: original + two copies. Acceptable because boards are small and named.

No new sync protocol for this. It is keep-server + create.

---

## 8. Versions (release only)

Do **not** bump `CURRENT_STORY_FORMAT_VERSION` or `SYNC_PROTOCOL_VERSION` in this work. Those numbers move in an official release.

During development:

- `FullStoryExportSchema.storyBoards` is **optional**; old packages import as “no boards”
- New entity type `Board` in the operation log; this branch’s peers all speak it

At release (checklist, not this PR):

- Format **9**, `migrateV8ToV9`: `storyBoards: data.storyBoards ?? []`
- Sync protocol **3** (new entity an older peer would not apply)

---

## 9. What is deliberately excluded (V1)

| Excluded | Why |
| --- | --- |
| Drawing edges by dragging from node to node | Fights pan/zoom; modal connect is enough |
| Pinning Plot / WorldRule / Tag / Choice | Dictionary coverage without a second story map |
| Board edges becoming story relations | Would impose ontology |
| Image background, snap-to-grid, multi-select, infinite undo | Product of its own |
| Export SVG | Graphs already export; copy later |
| Real-time co-editing / merging two JSONs | OCC + clone is the conflict story |
| Coordinates on Character/Location rows | Mixes auto-layout graphs with sketches; blocks two pins |

---

## 10. Implementation map (where it goes)

| Piece | Place |
| --- | --- |
| Entity + Zod content | `packages/shared/entities/Board.ts`, `schemas/BoardSchemas.ts`, `OperationLogEntityType.Board` |
| Tables | `apps/client/src/db/schemas/boards.ts`, `apps/api/.../tables/boards.ts` + drizzle generate (do not hand-edit journals) |
| Sync | `BoardSyncHandler` / `BoardClientSyncHandler` — validate `content` with Zod on create/update |
| Service | `apps/client/src/services/storymanagement/BoardService.ts` |
| Export | optional `storyBoards` on `FullStoryExportSchema`; **import must rewrite `entityId` inside JSON** after the entity remap table is known |
| Conflict clone | `SyncConflictService` + a Board-only action in the review sheet |
| UI | `screens/boards/BoardListScreen.tsx`, `BoardCanvasScreen.tsx`, `components/features/boards/*` |
| Gestures | prefer extending `usePanZoomCanvas` with an explicit “child is dragging” so pinch still works; do not mount `GestureHandlerRootView` for this alone |
| Picker | grouped options via `loadEntityOptions`; Events filtered as `Chapter` + `type === 'event'` |
| Navigation | skip ghosts; live pins use existing entity navigation/overlay |
| i18n | en + pt, sorted keys; `locales:audit` |
| Help | one catalogue page, two languages |
| Landscape | §4 #1 and Tier B #6 marked shipped as Boards, not graph editing |
| Tests | schema, service, ghost render, save-does-not-log-on-drag, conflict clone order, import remaps `entityId` in JSON, layering 600-line ceiling |

File-size: canvas screen + sheet will want the same split as timeline if they approach 600 lines.

---

## 11. Phases

| Phase | Scope | Ends with |
| --- | --- | --- |
| **0** | Persist this document as `docs/board_feature_plan.md` | The plan is in the repo |
| **1** | Table, Zod, both sync handlers, service, export optional, `OperationLogEntityType` | A board row round-trips |
| **2** | Drawer stack, list, empty canvas, save / revert / discard | A named board exists and stores an empty drawing |
| **3** | Entity pins (many of the same entity), note nodes, drag, growing bbox | Pins exist in space |
| **4** | Node sheet: connect, label, directed, remove, open-if-live, ghosts | The sketch has meaning |
| **5** | Conflict: clone action when `content` clashes | Two writers do not lose a drawing |
| **6** | i18n, help, landscape, tests | Shippable on this branch |

Phase 5 can trail 4 if the banner already offers keep-mine / keep-server (then clone is the only gap). Phases 3–4 are the product.

---

## 12. Risks

1. **Gesture.** Node drag vs canvas pan vs pinch is the failure mode that makes the feature feel broken. Threshold + “child dragging” flag on the shared hook; test on web mouse and on touch.
2. **Import remapping.** `content.entityId` is a pointer into other tables. Forgetting to rewrite it on story import clones a board that points at the source story’s ids.
3. **JSON payload size.** Explicit save contains it. Still cap something sane in Zod (e.g. max nodes/edges per board) so a pathological drawing cannot blow the operation log.
4. **Canvas clamp.** If bbox does not grow, drag-to-edge is a no-op. Treat grow-on-drag as part of phase 3, not polish.
5. **Conflict clone vs dirty canvas.** Clone is a *sync* resolution. An unsaved dirty canvas is not in the operation log yet — leaving without save is discard, not a conflict. Do not conflate the two.

The risk that is **absent**: deleting a character cannot corrupt a board (§6).
