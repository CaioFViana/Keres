# Plan: Packs

Target: Keres 1.6. Status: planned.

## 1. What a pack is

A pack is a **reusable slice of a story's structure** — its custom attributes, its suggestion
catalogues, its stat axes and ladders — that can be applied to a new story at creation.

The framing that makes the rest of the design fall out: **a pack is a multi-template feature, and a
template is authored by making a story**. There is no pack editor. You build a story the way you
like, then extract the parts worth reusing. That is what keeps the feature at **zero new CRUD
screens** for content that already has screens.

Two properties carried over from `FEATURE_LANDSCAPE.md` §5.4 and not up for renegotiation:

- **Applied only at story creation.** Never to an existing story.
- **Nothing records that a pack was applied.** No `packId` column anywhere on the created story.
  Creation-time-only makes this structural rather than a rule to remember: a pack that exists only
  before the story does cannot validate the story afterwards.

## 2. Two prerequisite bugs

Neither is caused by this feature. Both are *multiplied* by it, because a pack's entire purpose is
carrying custom attributes and their suggestion catalogues together. **They must be fixed first.**

### 2.1 Suggestion catalogues are orphaned by every id remap

`SuggestionService.customAttributeSuggestionType(fieldId)` builds the type string
`custom:<fieldId>` from the **live** field id. But `cloneExampleStory.ts` clones suggestions with

```ts
suggestions: example.suggestions.map((suggestion) => ({ ...cloneEntity(suggestion), storyId })),
```

— it remaps the row's own `id` and `storyId` and **never touches `type`**, while
`storySchemaFields` get new ULIDs a few lines below.

The bundled example stories carry **96 suggestion rows typed `custom:<fieldId>`**. Every one of them
is unreachable in every installed copy: the fields exist, the catalogue rows exist, and the lookup
misses because it asks for `custom:<newId>`. This affects `installExampleStory` and every local
`.json`/`.zip` import today, silently.

`list_<ulid>_<slug>` named-list types look like the same problem and are **not**: that ULID is minted
by `namedListType(createULID(), slug)` for the list itself, is not an entity id, and stays consistent
with its catalogue entry precisely because neither side is remapped. Only `custom:` needs fixing.

**Status: fixed.** `cloneExampleStory.ts` now rewrites `Suggestion.type` through the same `remapId`
as everything else, and `ExampleStoryService.test.ts` asserts over the whole installed catalogue that
no `custom:` type is left pointing at a field that does not exist. The test was verified to fail with
the fix removed.

It is the same class of bug as the `AttributeType.ENTITY` `value` remap documented in
`entity_attribute_feature_plan.md` §3.3: a text column that is secretly an id.

### 2.2 Nothing checks that a remap is complete

Both bugs are the same shape — a column holding an id that no one registered as an id. Worth one
test over the bundled examples asserting that no surviving string in the cloned output contains a
ULID that is not in the remap's target set.

## 3. Zero operation logs, for free

The requirement "0 operation logs, so the story can then be sent to the server with existing
structures" is already satisfied by a path that exists: **`StoryService.importFullStory` records no
operations at all** — 600 lines, zero `recordLocalOperation` calls, verified.

That gives the architecture:

> **Applying packs = creating the story from a synthesized export bundle.**

The creation form, with packs selected, assembles a `FullStoryExportSchema`-shaped object (the
story's own fields plus the packs' collections), runs it through `cloneStoryForLocalImport` for
fresh ids, and calls `importFullStory`. No new write path, no operation log entries, and
`uploadNewStoryToServer` bootstraps the result whole exactly as it does today.

This also means a pack's payload is validated by the schema the import already enforces.

## 4. Storage

### 4.1 Not a fake story

The note asks whether storing a pack as a story row with a "fake" `storyId` is ideal. **It is not.**
A sentinel row in `stories` has to be excluded from the story list, the story picker, tier counting,
the sync engine's story queries, favourites, publication and export — a filter that must be
remembered in every one of those places forever, and whose absence fails silently by showing users a
story that is not a story.

A pack gets its own table on both sides. Its *content* still reuses the export schema's shapes, so
nothing is duplicated where it matters.

### 4.2 The table

Client (`packs`) and server (`packs`) hold the same thing:

| Column | Why |
| --- | --- |
| `id` | ULID |
| `name`, `description` | Shown in the listing |
| `language` | The raw string copied from the source story's `language`. Free text, never translated - it is the author's word, like a story title |
| `version` | Integer, bumped on each re-extraction (§6) |
| `authorName` | Display only. Defaults to the source story's `author`, editable - the same treatment as `language` |
| `content` | The payload. `jsonb` on Postgres, `text` on SQLite and the client |
| `createdAt`, `updatedAt` | |

Metadata lives in columns rather than inside the JSON so the server can list packs without parsing
every blob.

`sourceStoryId` is deliberately **absent from the content and nullable if kept at all**: a pack is a
snapshot, not a reference. It must survive the deletion of the story it came from.

`.json`, never `.zip` — a pack carries no media by construction.

## 5. What a pack contains

Extracted from a source story, each behind its own toggle:

| Toggle | Collections | Notes |
| --- | --- | --- |
| Custom attributes | `storySchemaFields` | Per entity type, with `description`, `isRequired`, `order`, `defaultValue`, `targetEntityType` |
| Suggestion catalogues | `suggestions` | See §5.1 |
| Stats | `stats`, `statStrengths` | **Not** `statRelations` - those are a character's values, entity data. Implies `statSystem: true` and `statNotation` travelling as settings |
| Tags | `tags` | Confirmed as a fourth toggle: a starter tag set is the same kind of structure. `tagRelations` stay out - those bind a tag to an entity |

Explicitly **not** in a pack: any entity (characters, locations, scenes, chapters, items, notes,
world rules), `attributeValues`, `statRelations`, `modes`, media, comments, favourites. Those are the
writer's content, not their structure.

**Chapter/scene skeletons are out of 1.6.** Structure templates ("a Save the Cat beat sheet as 15
named scenes") are a genuinely different operation - they carry entities, and cloning a chapter
means deciding what happens to its prose. Worth its own plan later; it would fit this same table.

### 5.1 The suggestions toggle

An earlier draft of this plan read "just the default values on suggestion table" as *the fields'
`defaultValue`*. That was wrong, and the code says something better: the `suggestions` **table** is
the writer's **curated catalogue** - values they deliberately saved. Values merely *used* by entities
are harvested on the fly and are never in the table (`getSuggestionUsageCounts` is documented as
"distinct values currently present in story entities, **excluding saved catalog values**").

So the toggle is exactly the line the data already draws:

- **Default - the curated catalogue.** The story's `suggestions` rows as they are. This is the
  deliberate list, and it is what makes a pack a template.
- **Toggle on - also what the story actually used.** Harvest the distinct values from the source
  story's entities and materialise them as rows too. Bigger, more personal; useful when the source
  story *is* the reference work.

A size cap belongs on the second regardless.

## 6. Authoring: the publish screen, again

A new drawer entry in `enterstack`, and a screen shaped like `PublishStoryScreen`:

1. pick a source story;
2. four toggles for what to extract;
3. name and description; `language` and `authorName` are **prefilled from the source story** (its
   `language` and `author`) and editable from there;
4. create - or, for an existing pack, re-extract and bump `version`.

**Editing a pack is re-extraction.** That is what keeps the CRUD count at zero: to change a pack, you
change the story and extract again. If the source story is gone, the pack can only be deleted or
exported - worth saying in the UI rather than discovering.

Listing looks like the example-story list, minus the language selector; the language string is shown
as a plain label on each row.

## 7. Applying at creation

The story creation form gains a pack picker. Selecting one or more packs is the only moment they
apply.

**Collisions are deliberate, because the writer chose several packs in one moment.** The rules the
picker must enforce, all of which exist as invariants already:

| Invariant | Where it comes from |
| --- | --- |
| `unique(storyId, entityType, key)` on `StorySchemaField` | Two packs claiming the same key must merge or be refused, per the picker's policy - not silently dropped |
| `MAX_PRIMARY_STATS = 12` | Two stat packs can exceed it; refuse before creating |
| A stat ladder per `statId`, plus one story default | Two packs each carrying a default ladder is a conflict |
| `statSystem` / `statNotation` | Only settable at creation, so only a pack applied here may set them |

Suggestion `type` strings must be remapped along with the field ids they embed - the same fix as
§2.1, which is why that comes first.

## 8. Sharing through the Showcase

The note is right that this is what gives publishing a second purpose. It is also the half that can
slip without hurting the first, so it is **Phase 3** below.

**Publishing a pack is not publishing a story, and should not reuse that flow.** A story publication
exists because a story has to be fully synchronized first - the server must already hold every
entity before a snapshot means anything, which is why `PublishStoryScreen` checks the operation
counter against the server's and refuses when they differ. A pack is one row of one table. It has no
sync state to agree about.

So: **ordinary REST**, not the publication machinery.

| Route | Purpose |
| --- | --- |
| `POST /packs` | Upload a pack. Body is the metadata plus `content` |
| `GET /packs` | List, from the metadata columns - no blob is parsed |
| `GET /packs/:id` | Deliver one pack whole |
| `DELETE /packs/:id` | The owner withdraws it |

No sync engine, no operation log, no OCC, no version negotiation: a pack at a given version is
immutable, and a new version is a new row or a bumped column, decided by the owner. Importing into
the client writes a local `packs` row that is then indistinguishable from a locally-made one.

The Showcase gains a mode that lists packs. Whether a shared pack needs the visibility/password
model a published story has, or is simply public, is the one thing still open here.

## 9. What to ship

Three, chosen to exercise different toggles and to make the feature's point without taking a side on
how anyone writes:

| Pack | Carries | Why this one |
| --- | --- | --- |
| **Tabletop stats** | 6 stats (STR/DEX/CON/INT/WIS/CHA), a numeric ladder, `statSystem: true`, `statNotation: 'number'` | The note's own idea, and the only shipped content that exercises the stats toggle |
| **Novel craft** | Custom attributes: POV, goal/conflict/outcome, value shift on Scene; want vs need, wound, arc on Character | This is where the native scene fields withdrawn in `FEATURE_LANDSCAPE.md` §5.2 come back as opt-in. It is the strongest argument for the whole feature |
| **Comic / graphic novel** | Custom attributes (page count, panel count, art notes, letterer notes) plus a suggestion catalogue of shot types | Demonstrates "any medium" concretely, and pairs with the deferred vocabulary layer |

Shipped packs are Keres-authored content, so they need pt and en like the example stories. With no
language selector, the natural resolution is **one pack row per language**, each carrying its own
`language` string - two rows in the list, consistent with the design rather than an exception to it.

## 10. Phases

| Phase | Scope | Ends with |
| --- | --- | --- |
| **0** | Fix §2.1 (**done**) and §2.2 | Example stories stop shipping orphaned catalogues |
| **1** (**done**) | `packs` table (client), extraction screen, pack picker at creation, apply through `importFullStory` | A pack can be made, applied, and produces zero operations |
| **2** (**done**) | The three shipped packs, in both languages | The feature has a reason to exist out of the box |
| **3** (**done**) | Server `packs` table, routes, Showcase pack mode, versioning | Packs can be shared |

Phase 0 is not optional and does not depend on the rest: it is a live bug in installed example
stories today.

Phase 3 was built before Phase 2: sharing is what the shipped packs are seeded *through*, so the
import path had to exist first. Shipped packs are generated from
`apps/client/scripts/lib/shippedPackDefinitions.ts` into `src/shippedPacks/content/<slug>/<lang>.json`
by `bun scripts/build-shipped-packs.ts`, and install through `PackService.importRemotePack` - the
same path a downloaded pack takes, keyed on an id fixed in the file so installing twice updates in
place. A test rebuilds them in memory and refuses a definition edited without regenerating.

## 11. Risks

1. ~~**§2.1 shipping unfixed.**~~ Fixed and covered by a regression test before the feature starts.
2. **The suggestions toggle reading (§5.1).** Getting (a) as the default would make every pack a dump
   of somebody's typing.
3. **Collision policy at the picker** is the only genuinely new UX decision in the feature. Left
   vague, it becomes "last pack wins", which is the worst option.
4. **Shipped-pack maintenance**, in two languages, is the same recurring cost already documented for
   the example stories in `EXAMPLE_STORIES_PLAN.md`.
5. **Scope drift into a pack editor.** Every request to "just let me tweak one field in the pack"
   ends the zero-CRUD property. The answer is: change the story, re-extract.
