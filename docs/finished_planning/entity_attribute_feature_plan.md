# Plan: an Entity-type custom attribute (`AttributeType.ENTITY`)

Status: Implemented.
Base branch: `ouroboros`.

## 1. Goal

To add a new type to the custom attribute system (`StorySchemaField`) that lets the
user **select an entity** instead of typing text. The resulting field:

- is filled in through a **picker** on the Form screen (not free text);
- is **clickable** on the Detail screen, navigating to the referenced entity
  (the same behaviour as the existing relations — see `SeeAlsoManager`);
- remains **commentable** (`CommentableDetailField`, with no regression);
- works on **all 7 types** that already support Story Schema
  (`Character`, `Location`, `Item`, `Scene`, `Chapter`, `Note`, `WorldRule`).

The **selectable** entity types (the reference's target) are the same as Story Schema's:
`Character`, `Location`, `Scene`, `Item`, `Chapter`, `Note`, `WorldRule`.

Since the system is online/synchronized, the change has to cross shared → client (SQLite +
migration) → API (Postgres + migration + sync handlers + export/import).

---

## 2. Design decisions (and why)

### 2.1 The target is declared **on the field**, not on the value

A new field on `StorySchemaField`: `targetEntityType: StorySchemaEntityType | null`.

It reuses `STORY_SCHEMA_ENTITY_TYPES` instead of creating a new constant: with the target list
equal to the list of types that receive a Story Schema (the 7), a second identical constant would
only exist in order to diverge silently later. An accepted and documented side effect: adding an
8th type to the Story Schema automatically makes it referenceable — and the requirement for that is that
it exists in `ENTITY_ROUTES` (`utils/entityNavigation.ts`), otherwise the field does not navigate.

- `null` for every existing type; required when `type === ENTITY`.
- Immutable after creation, exactly as `key` and `entityType` already are — changing the target
  would silently invalidate every value already saved.

The alternative discarded: storing `"Character:<id>"` in the `value` (the
`encodeSeeAlsoValue` pattern), which would make the value self-describing and would allow "any type"
per field. Discarded because (a) the picker ends up unrestricted and the UX gets worse in a
large story, (b) the analysis/search validation needs to know the target type in advance, (c) the declared
field allows navigating without parsing. It is recorded as an evolution path in case a
"polymorphic reference" field is ever wanted.

### 2.2 `AttributeValue.value` stores the entity's raw ULID

No change of column or type — it remains `text` in both databases, consistent with the reason
documented in `packages/shared/utils/attributeValueCodec.ts` (a single text column).
`decodeAttributeValue(ENTITY, v)` falls into the `default` (string), but gains an explicit `case` so as
not to depend on the fallback.

### 2.3 A dangling reference is allowed, it is not an error

Today nothing cleans up `attributeValues` when the owning entity is soft-deleted (verified: only
`AttributeValueService` and `GlobalSearchService` touch the table). Keeping the same stance:
deleting a referenced Character does **not** delete the value. The Detail screen shows
`attribute_entity_deleted` and the field stops being clickable; the Story Analysis raises a
`warning` (§3.7). That avoids new polymorphic cascades in 7 entity services.

### 2.4 `defaultValue` does not apply to ENTITY

A default value pointing at a specific entity is almost always meaningless and would
complicate id remapping in import/clone. The form hides the default value input
when `type === ENTITY` and writes `null`; the Zod schema refuses a non-null `defaultValue` in that case.

---

## 3. Changes per layer

### 3.1 `packages/shared`

| File | Change |
|---|---|
| `metadata/AttributeType.ts` | `ENTITY = 'entity'` |
| `metadata/StorySchemaEntityType.ts` | only a comment: the list comes to have a second role (a reference target), and every listed type has to exist in `ENTITY_ROUTES` in the client. No new constant — see §2.1 |
| `entities/StorySchemaField.ts` | `targetEntityType: StorySchemaEntityType \| null` documented as immutable |
| `schemas/StorySchemaFieldSchemas.ts` | the new field using the existing `StorySchemaEntityTypeSchema`; `.nullable().default(null)` on `Create...`; `superRefine`: `type===ENTITY ⇒ targetEntityType != null && defaultValue == null`, `type!==ENTITY ⇒ targetEntityType == null` |
| `utils/attributeValueCodec.ts` | an explicit `case ENTITY` (pass-through with `String(raw).trim()`); export `isEntityAttributeType(type)` so the call sites stop comparing a loose string |
| `index.ts` | export the new metadata/schema |

Tests: `test/utils/attributeUtils.test.ts` (the ENTITY codec), a new `superRefine` test,
`test/schemas/FullStorySchemas.test.ts` (a round trip with the new field).

### 3.2 API — database and sync

| File | Change |
|---|---|
| `apps/api/src/db/schema/tables/storySchemaFields.ts` | `targetEntityType: text('target_entity_type')` (nullable) |
| `apps/api/drizzle/0007_*.sql` | generate with `bun run --cwd apps/api db:generate` (do not write it by hand) |
| `services/entity-sync-handlers/StorySchemaFieldSyncHandler.ts` | `create`: insert `targetEntityType`; reject `type==='entity'` with no `targetEntityType` (Zod already catches it, but keep the explicit check like the handler's others). `update`: add `targetEntityType` — **and `type`** — to the list of keys removed from `changes`, along with `entityType`/`key`. Today `type` is not removed; the UI never offers to edit it, but with ENTITY the consequence of a swap becomes "every value turns into an orphaned ULID", which justifies closing the gap now. |
| `services/entity-sync-handlers/AttributeValueSyncHandler.ts` | **no change.** The server validates no polymorphic FK in any other table (`NoteRelation.relationId`, `GalleryRelation.ownerId`); introducing validation only here would create an asymmetry and a query cost per sync update. |

### 3.3 API — export/import (`StoryExportImportService.ts`)

The most delicate point of the plan. Today the `attributeValues` block (at the end of the file, ~line 916)
remaps `fieldId` and `entityId`, but treats `value` as opaque. For an ENTITY field, `value`
**is an id** and has to go through the `idMap`, otherwise the imported story points at entities of the
source story.

The plan:

1. Before the `attributeValues` block, assemble
   `entityFieldIds = new Set(storySchemaFields.filter(f => f.type === 'entity').map(f => f.id))`
   from the validated bundle (the fields are inserted just above, so the original ids
   are still at hand).
2. In the `map`, when `entityFieldIds.has(original.fieldId)`:
   `value = original.value ? (idMap.get(original.value) ?? null) : null`.
3. **Do not throw** when the target is not in the `idMap` — it becomes `null`. It is the same case as §2.3
   (a reference to a deleted/unexported entity), and different from `fieldId`/`entityId`, which
   are structural and carry on throwing.
4. The order is already correct: `attributeValues` is the last entity block, all 7 target
   types are already in the `idMap`.

The export (`exportStory`) does not change — it already carries `storySchemaFields` and `attributeValues` whole, and
the new column enters through the `findMany` without an explicit selection.

Test: an export→import round trip with an ENTITY field pointing at a Character, plus a
case with the target absent from the bundle (expecting `null`, not an exception).

### 3.4 Client — database

| File | Change |
|---|---|
| `src/db/schemas/storySchemaFields.ts` | `targetEntityType: text('target_entity_type')` |
| `src/db/migrations/0006_*.ts` **(new)** | `ALTER TABLE story_schema_fields ADD COLUMN target_entity_type text;` — SQLite accepts a nullable `ADD COLUMN` without recreating the table |
| `src/db/migrations/index.ts` | regenerated by `generate-migrations-index.js` (it runs on `prestart`); the file already appears modified in the working tree, check before committing |
| `services/storymanagement/StorySchemaFieldService.ts` | `createField` propagates `targetEntityType`; `updateField` carries on not touching it |

### 3.5 Client — the picker: extending `GroupedMultiSelectPill`

The base chosen: **`GroupedMultiSelectPill`** — the picker of the Gallery (`GalleryDetailContent`) and
of "See also" (`SeeAlsoManager`). It is already a two-step entity selector
(type → entity), with text search inside the group, a count per type, an icon per type and
a handled empty state. `LocationPickerModal` was considered and discarded: it is
`LocationSelect`-specific, has no search, and using it as a base would mean rewriting the search +
the trigger from scratch — more new code, not less.

What it lacks for the use case, and how to solve it (all additive, the 2 current call sites do not
change):

1. **Single selection.** A new prop `singleSelect?: boolean` (default `false`). With it,
   `toggleOption` replaces the selection with `[value]` instead of accumulating, and closes the modal on
   choosing. Tapping the already selected item returns `[]` — that is "clear the selection" for free, with no new
   UI. The trigger renders a single pill; the `add-circle` icon becomes `chevron-down`.
2. **A single group.** Since `targetEntityType` is fixed per field, the group list would have a single
   item and would cost an extra tap. When `groups.length === 1`, enter the group directly
   (an initial `activeGroupKey`) and hide the back button. It is a generic improvement, not a hack
   for this case.
3. **Value encoding.** The `value`s are opaque strings to the component — the current hooks
   use `"Type:id"`, but here we pass the bare ULID (§2.2). Zero change to the component.

A new `components/common/inputs/EntityPickerInput/EntityPickerInput.tsx`: very thin, it wraps
`GroupedMultiSelectPill` in `singleSelect` with a single group (the `targetEntityType`), converts
`string[] ↔ string | null`, and is what `AttributeValueInput` and `AdvancedSearchModal` render.

A new `utils/entityOptions.ts`: `loadEntityOptions(db, storyId, entityType)` returning
`{id, name}[]`. The table comes from `getEntityTable` and the name column from
`globalSearchFieldConfig[T].titleField` (`name` for Character/Location/Scene/Item/Chapter,
`title` for Note/WorldRule) — both already exist, no new mapping. Today that table/column
pair is written by hand inside `useSeeAlsoEntityOptions`; extracting it and making that
hook consume the helper keeps a single source, and it is the same pair the global search uses (§3.7.1).

A new `hooks/useEntityPickerOptions.ts`: it wraps the helper with state/loading for the input.

`LocationPickerModal`/`LocationRelationManager` stay **as they are** — they are "choose a
candidate from a list already pre-filtered by a cycle/parentage rule", a different interaction from
that of a form field. Consolidating the two is a separate refactor, not part of this feature.

A performance note (pre-existing, inherited): the modal lists the options in a `ScrollView`,
not a `FlatList` — in a story with hundreds of characters it mounts everything at once.
It already applies today to the Gallery/See also. Swapping it for a `FlatList` is contained and can come along,
but it affects the 2 existing call sites; treat it as an optional improvement, verified with the real app.

### 3.6 Client — form, detail and navigation

| File | Change |
|---|---|
| `screens/storyschema/StorySchemaFieldFormScreen.tsx` | a "target entity type" `Select`, visible only when `type === ENTITY`, `disabled` when editing (like the type Select); a "required when ENTITY" validation; hide the default value `AttributeValueInput` when ENTITY |
| `components/common/forms/CustomAttributeFields/AttributeValueInput.tsx` | a new `targetEntityType?` prop; `case AttributeType.ENTITY` → `EntityPickerInput` (falling back to a disabled `TextInput` if it arrives without a `storyId`/`targetEntityType`, the same defensive pattern as `case SUGGESTION`) |
| `components/common/forms/CustomAttributeFields/CustomAttributeFields.tsx` | pass `targetEntityType={field.targetEntityType}` along |
| `components/common/display/DetailField/DetailField.tsx` | an optional `onPress` prop; when present, the value renders in `colors.primary` inside a `TouchableOpacity` with a `chevron-forward` — the same visual treatment as `SeeAlsoManager`'s rows |
| `components/features/comments/CommentableDetailField/CommentableDetailField.tsx` | pass `onPress` along to the inner `DetailField` (on both paths: with and without the comment button). It is what preserves "clickable **and** commentable" |
| `components/common/forms/CustomAttributeFields/CustomAttributeDetailFields.tsx` | for ENTITY fields: resolve the referenced entity's name and navigate on tap |
| `utils/entityNavigation.ts` | **no change** — the 7 target types are already in `ENTITY_ROUTES` (verified: it includes `Chapter`, `Note` and `WorldRule`) |

A `CustomAttributeDetailFields` detail:

- in the same existing `fetchValues`, after loading the values, resolve the names of the ENTITY
  fields in a batch. Reuse `EntityService.getEntityIdentifier(db, type.toLowerCase(), id,
  storyId, t)`, which already returns **the name alone** (unlike `useEntityName`, which returns
  `"Type - Name"`, the wrong format for a field value);
- `displayValue` = the resolved name, or `t('attribute_entity_deleted')` when it does not resolve;
- `onPress` only when it resolved, calling `navigateToEntityDetail(navigation.getParent(), ...)`
  — the same snippet as `SeeAlsoManager.handlePress`;
- the comment's `contentSnapshot` comes to be the resolved name (not the ULID), preserving the
  snapshot's usefulness in the comment history.

### 3.7 Client — search, analysis and log

| File | Change |
|---|---|
| `packages/shared/metadata/entityFields.ts` | a new `FieldType` `'entity'` + an optional `entityTargetType?` field on `EntityFieldMetadata` |
| `utils/customAttributeFieldMetadata.ts` | ENTITY → `type: 'entity'`, `entityTargetType: field.targetEntityType`. (Mapping it to `'string'`/`'id'` would make the Advanced Search ask for a typed ULID — unacceptable.) |
| `components/common/modals/AdvancedSearchModal/AdvancedSearchModal.tsx` | a `case 'entity'` in the rendering switch → `EntityPickerInput` (the same component as §3.5, at no extra cost) |
| `utils/attributeSearchPredicate.ts` | `case ENTITY` → `eq(attributeValues.value, String(rawValue))`, an exact comparison; today it would fall into the `LIKE %...%`, which is wrong for an id |
| `services/storymanagement/GlobalSearchService.ts` | match by the **referenced entity's name**, not by the ULID — see §3.7.1 |
| `utils/storyAnalysisChecks.ts` | in `checkStorySchema`, for an ENTITY field: if `raw` is non-null and the id does not exist in `entitiesByType[field.targetEntityType]`, emit an `analysis_attribute_entity_missing` `warning`. The input already carries the 7 entity collections and the `attributeValues`; what is missing is carrying `targetEntityType` in `AnalysisStorySchemaField` |
| `services/storymanagement/StoryAnalysisService.ts` | select `targetEntityType` when assembling the analysis's input |
| `services/EntityService.ts` | in `case OperationLogEntityType.AttributeValue`, when the field is ENTITY, resolve the ULID to a name through `_resolveRelationEntityName` before assembling `attribute_value_attributed_to_entity` — otherwise the operation log shows a raw ULID |
| `exampleStories/cloneExampleStory.ts` | in the `attributeValues` `map`, remap `value` when the field is ENTITY (the same logic as §3.3, with the local `idMap`); `storySchemaFields` already passes `targetEntityType` through the spread |

`SuggestionService` needs no change: `getValueUsageCounts` is only called on the
`custom:<fieldId>` branch of SUGGESTION fields.

#### 3.7.1 The global search matches by the referenced entity's name

What the user sees in the field is the entity's **name** (§3.6) — it is by that name that they will
search. Searching "Aragorn" has to bring back the Character whose "Mentor" attribute points at
Aragorn, and the snippet has to say `Mentor: Aragorn`, not `Mentor: 01HXYZ...`.

`useEntityName` is the behavioural precedent, but it is not reusable here: it is a React hook, one
entity at a time. In a global search that would be N+1 queries per result. The same resolution is
done in SQL, with a join — an identical result to what the screen shows, in a single statement per type.

The `attributeQuery` block (today a single query) becomes two paths feeding the same result
`Map`:

1. **Text fields** — the current query, with `ne(storySchemaFields.type, 'entity')` added to the
   `where`. The ENTITY field leaves here because matching a substring against a ULID only produces noise; its
   path is (2).
2. **ENTITY fields** — it first loads the story's `type='entity'` fields
   (`id`, `name`, `targetEntityType`). If there are none, the whole path is skipped (zero
   cost for the stories that do not use the feature). If there are, it groups by `targetEntityType` and runs
   one query per target type in use: `attributeValues` ⋈ the target table on
   `attributeValues.value = target.id`, filtering by `fieldId IN (that target's fields)`,
   `target.isDeleted = false` and `target.<titleField> LIKE %term% COLLATE NOCASE`.
   The table comes from `getEntityTable`, the name column from `globalSearchFieldConfig[T].titleField`
   — no new mapping. The same `ATTRIBUTE_RESULT_LIMIT` as path (1).

The block's final stretch (resolving the **owning** entity's title, respecting the
`results.has(key) → continue` that gives precedence to a native field match, assembling the
`GlobalSearchResult`) is generic and becomes a helper shared by both paths,
taking rows in the format `{ entityType, entityId, fieldName, displayValue }` — in (1)
`displayValue` is the raw value, in (2) it is the referenced entity's name. Without duplicating the
dedup/title handling.

The cost: at most one extra query per target type effectively used, inside the `Promise.all` that
already exists, and zero when the story has no ENTITY field.

### 3.8 i18n, help and docs

`apps/client/src/locales/{en,pt}.json` — new keys:
`attribute_type_entity`, `attribute_target_entity_type`, `attribute_target_entity_type_hint`,
`attribute_target_entity_type_required`, `attribute_entity_select_placeholder`,
`attribute_entity_search_placeholder`, `attribute_entity_clear`, `attribute_entity_none`,
`attribute_entity_deleted`, `analysis_attribute_entity_missing`.
Run `bun run --cwd apps/client locales:audit` at the end.

`src/help/content/custom-attributes/{en,pt}.ts` — a section about the Entity type: what it is for,
that the target is fixed at creation, that deleting the referenced entity leaves the field "empty" instead
of deleting the attribute. Check `src/help/catalog.ts`/`fieldSources.ts` and the generated index
(`bun run --cwd apps/client help:generate`) — the client's help test validates the index.

`docs/` — there is no dedicated file for custom attributes today; do not create one just for this.

---

## 4. Suggested execution order

1. **shared**: the enum, the target metadata, the entity, Zod schemas, the codec, the exports + tests.
2. **API**: the column, `db:generate`, the sync handler, export/import + tests (including integration).
3. **client/db**: the column, migration `0006`, `StorySchemaFieldService`.
4. **client/picker**: `singleSelect` + a single group in `GroupedMultiSelectPill`,
   `utils/entityOptions.ts`, `useEntityPickerOptions`, `EntityPickerInput`. Check that
   the Gallery and "See also" remain identical (the new props are optional).
5. **client/form**: `StorySchemaFieldFormScreen`, `AttributeValueInput`, `CustomAttributeFields`.
6. **client/detail**: `DetailField`, `CommentableDetailField`, `CustomAttributeDetailFields`.
7. **client/cross-cutting**: the advanced search, the predicate, the global search, the analysis, `EntityService`,
   `cloneExampleStory`.
8. **i18n + help**.
9. `bun run typecheck` → `bun run lint` → `bun run test:report` → `bun run test:integration`.

Steps 1–3 are the "online skeleton" and should go together: an updated client talking to an API
without the column makes the sync lose `targetEntityType` silently.

---

## 5. Compatibility and migration

- **A nullable column, with no backfill.** Existing fields are left with `target_entity_type = NULL`,
  which is exactly the valid value for the 6 old types.
- **An old client × the new API**: an old client never creates an `entity` field, never sends the column;
  the `Partial` schema treats it as optional. No breakage.
- **A new client × an old API**: the old handler's insert ignores `targetEntityType` and the field
  comes back from the pull with no target → the Detail falls into "invalid reference". It does not corrupt data, but it is
  a reason to bring the API up before publishing the client.
- **Stories exported before the feature**: they import unchanged (the fields are optional).
- **`unique(storyId, entityType, key)`** is not touched.

## 6. Risks and points of attention

1. **`value` stops being opaque in import/clone.** It is the only place where an
   `AttributeValue`'s text becomes an id needing a remap. If forgotten, the imported story points
   at another story's entities — a silent failure, with no error. It is the item that most deserves a test.
2. **The order of the blocks in the import.** `attributeValues` has to carry on being after all 7
   target types. It already is; the existing comment in the file should be updated to
   mention `value` as well.
3. **A reference crossing stories.** The picker only lists entities of the current `storyId`, so
   there is no UI path to it; nothing validates it on the server (consistent with §3.2).
4. **`type` being mutable in the sync update** is a pre-existing gap that this feature turns
   into a real risk (§3.2) — close it along the way.
5. **`ScrollView` instead of `FlatList`** inside the picker (§3.5): a pre-existing performance
   risk that this feature amplifies, since the field may appear on every entity of every
   Detail/Form screen.

Not a risk: `GroupedMultiSelectPill`'s third call site. The change is "a single-selection mode"
alongside the multiple one, with optional props — covered by the component's tests (§7).

## 7. Planned test coverage

- `packages/shared`: the ENTITY codec; `superRefine` (ENTITY with no target, non-ENTITY with a target,
  ENTITY with a `defaultValue`); `FullStorySchemas` with the new column.
- `apps/api`: `StorySchemaFieldSyncHandler` (create with a target; update ignoring
  `type`/`targetEntityType`); `StoryExportImportService` (the `value` remap; a missing target → null).
- `apps/client`: `GroupedMultiSelectPill` in `singleSelect` (replacing instead of accumulating, closing on
  choosing, re-tapping clears) and with a single group (entering directly, with no back button);
  `customAttributeFieldMetadata` (ENTITY → `'entity'` + `entityTargetType`);
  `attributeSearchPredicate` (exact equality); `GlobalSearchService` (searching by the referenced
  entity's name finds the owning entity, with the snippet `Field: Name`; the ULID does **not** match;
  a story with no ENTITY field fires no extra query); `storyAnalysisChecks` (a broken reference);
  `cloneExampleStory` (the remap); rendering `CustomAttributeDetailFields` (clickable when it
  resolves, deleted text when it does not, the comment button present in both cases).
