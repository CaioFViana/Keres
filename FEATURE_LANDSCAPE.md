# Keres feature landscape

What comparable tools offer that Keres does not, what Keres offers that they do not, and which gaps
are worth closing — read through Keres's own design premise. An input to product decisions, not a
commitment.

**Basis and confidence.** Everything stated about Keres was verified against the code in
`packages/shared/entities/`, `packages/shared/metadata/`, `apps/*/src/db/`,
`apps/client/src/storyDevices/content/`, `apps/client/src/utils/storyAnalysisChecks.ts` and the
archived plans in `docs/finished_planning/`. Those claims are checkable and should be re-checked
when this document ages. Everything stated about other products is general knowledge of the
category, not a tested feature matrix — treat competitor rows as "verify before acting on". No
pricing, versions or third-party roadmaps are recorded, because those go stale fastest.

Reference points: Scrivener, Plottr, Dabble, Bibisco, yWriter, Storyist, LivingWriter, Novelcrafter,
Sudowrite, Campfire, World Anvil, Kanka, LegendKeeper, Obsidian, Milanote, Aeon Timeline,
Fictionary, Ellipsus.

---

## 1. The design premise

Two commitments define the product, and every recommendation below is filtered through them:

1. **Do not limit the writer in anything.**
2. **Keres is not the text editor — it is the dictionary of a story, usable by any medium.**

"Any medium" means the same story bible has to serve a novel, a comic, a game, an RPG campaign, a
screenplay or an animation. That is a wider claim than any competitor in §9 makes, and it is the
sharpest thing Keres has.

### 1.1 The test this premise implies

**A missing feature limits nobody — you simply do not use it. An imposed constraint limits
everybody.**

That inverts the usual product question. "What do competitors have that we lack?" is the wrong first
question for Keres; the right first question is **"what does Keres currently force the writer to
do?"** A gap is optional by nature. A constraint is not.

The second filter follows from it: **does this feature add capability, or does it encode one
school's ontology into every story in the app?** A freeform canvas adds capability. A required
"value shift" field encodes a specific theory of novel craft into a comic script.

---

## 2. What Keres currently forces (highest priority)

These are present-tense constraints, verified in the code. Under §1 they matter more than anything
in the gap list, because they affect every user and cannot be opted out of.

### 2.1 ~~Every scene must have a location and a chapter~~ (location done; chapter now optional)

`Scene.locationId` is `string | null` — a scene may happen nowhere in particular. That constraint
from the first draft of this document is gone.

`Scene.chapterId` is also `string | null`. A fragment, a study, a design note with scenes no longer
has to invent a numbered chapter. Unchaptered scenes sit in a list bucket at the end ("Unchaptered" /
"Sem capítulo"), sorted alphabetically by default (they have no 1..N of their own) and following the
list's sort-by otherwise. They do not occupy the narrative spine, cannot be reordered as a chapter
would, and are not offered as timeline anchors.

What remains of this item is lighter: the *labels* are still Chapter/Scene (see §2.5).

### 2.2 A story must be linear or branching

`Story.type` is `'linear' | 'branching'`. There is no third state. A world bible with no narrative
order at all — a setting, a reference wiki, a campaign world — must still declare itself one of two
narrative shapes it does not have. `Plot` compounds this: plots exist only in linear stories, so
choosing "branching" removes a whole organizing tool.

### 2.3 ~~The timeline assumes the story is an ordered sequence of scenes~~ (Events exist)

The timeline's **axis** is still the numbered spine (chapter → scene order). That is intentional:
narrative order and chronology are two questions.

What this section originally asked for is in the product: a container that is not a numbered chapter.
`chapters.type` is `'chapter' | 'event'`. An Event holds scenes without a spine number; `chapterAnchors`
place it against the spine (or measure it from the scenes it contains, or mark it as an instant).
World history that is not "Chapter 4" has a home. Unchaptered scenes (§2.1) are the remaining
fragments that do not even join an Event.

### 2.4 Story Analysis opinions are opt-in

The partition in `storyAnalysisChecks.ts` is written down and enforced. The six opinionated keys
(`analysis_character_no_scenes`, `analysis_character_no_relationships`, `analysis_location_unused`,
`analysis_location_no_connections`, `analysis_item_unused`, `analysis_tag_unused`) live in
`COMPLETENESS_FINDING_KEYS` and fire only when `Story.completenessChecks` is on — **off by default**.

Integrity findings (dangling choices, unreachable scenes, unsatisfiable checks, schema violations
the writer declared, crooked 1..N numbering) stay always on. That is the boundary §5.1 asked to
write before the checks multiplied. Keep it: craft checks must not become warnings.

### 2.5 The vocabulary is prose-shaped

The entities are named `Chapter`, `Scene`, `Character`, `Location`. A comic has issues, pages and
panels; a game has quests and levels; an RPG has sessions and encounters; a screenplay has
sequences. The underlying graph fits all of them — the *labels* do not.

A per-story vocabulary layer (rename `Chapter` → "Issue", `Scene` → "Page", `Location` → "Set") is a
label mapping over existing entities, not a schema change. It is the most direct expression of "any
medium" available, and it costs no new entity.

---

## 3. The scope boundary: settled

Keres is not a text editor. The model confirms this is structural: `Scene` has `summary` and no
`content`; there is no `wordCount`, `draft`, `status` or `povCharacterId` anywhere in
`packages/shared/entities/`; `Story` has no target word count, deadline or cover.

This is not a gap to close. Under §1 it is the premise: a dictionary that also owned the prose would
constrain which medium the prose belongs to.

Everything below follows from that decision and should not be revisited feature by feature:

| Absent from Keres | Typical of |
| --- | --- |
| Prose editor, distraction-free mode | Scrivener, Dabble, Bibisco, yWriter, Novelcrafter |
| Word-count targets, deadlines, streaks, output charts | Dabble, Scrivener, Bibisco |
| Snapshots of prose, draft-to-draft diffing | Scrivener, Novelcrafter, Ellipsus |
| Compile to DOCX/EPUB/PDF | Scrivener, Storyist, LivingWriter |
| Prose analysis: readability, adverbs, repetition | Fictionary, ProWritingAid, AutoCrit |

> The operation log is not draft history. It has per-entity `version` and full change tracking, but
> that answers "what changed and in what order" — synchronization bookkeeping — not "show me this
> scene as it read in draft two".

---

## 4. Gaps that fit the premise

Ranked by how well they add capability without imposing an ontology.

| # | Gap | Typical of | Fit with §1 | Status in Keres |
| --- | --- | --- | --- | --- |
| 1 | **Freeform canvas / corkboard with dragging** | Scrivener, Plottr, Milanote, Campfire | **Excellent** — the least prescriptive surface that exists. Imposes no structure; works for panels, quests, encounters or scenes alike. | Graphs are auto-laid-out and view-only; the LocationGraph plan says "no visual editing" explicitly. |
| 2 | **`Event` decoupled from `Scene`** | Aeon Timeline, World Anvil | **Excellent** — removes the constraint in §2.3 rather than adding a rule. | **Shipped.** Not a new table: `chapters.type = 'event'` plus `chapterAnchors`. Scenes still live in a container; the container is no longer forced onto the spine. |
| 3 | **Mention-based auto-linking and backlinks** | Obsidian, World Anvil (`[[…]]`) | **Excellent** — this is literally how a dictionary works. Additive, ignorable. | **Forward links shipped** (`Story.autoLinkMentions`): names in text become tappable, nothing is persisted. `SeeAlsoRelation` stays manual. **No "mentioned in" panel** (backlinks). |
| 4 | **Custom in-world calendars** | World Anvil, Kanka, Fantasy Calendar | **Good** — describes a world, prescribes no narrative. | `AttributeType.DATE` is a deliberately floating civil date; scene timing reaches "eras". No custom months, leap rules or in-world arithmetic. |
| 5 | **Image maps with pinned locations** | World Anvil, LegendKeeper, Kanka | **Good** — pure description, medium-agnostic. | There is a location *graph* (`contains` / `connected_to`) and a Gallery, but no map image with coordinates. |
| 6 | **Research and reference items** — URLs, PDFs, clippings | Scrivener (Research), Milanote | **Good** — a dictionary that cannot hold a reference is odd. | `MEDIA_TYPES` is exactly `['image', 'video', 'audio']`. No link entity, no document entity. |
| 7 | **Family trees / genealogy** | Kanka, World Anvil, Family Echo | **Good** — descriptive; optional per story. | `CharacterRelation` is a typed unordered pair drawn radially; no generation or descent semantics. |
| 8 | **Series above Story** | LivingWriter, Campfire, World Anvil | **Good** — a shared dictionary across works is the premise scaled up. | `Story` is the top container. Sharing a character across two works means export/import, which clones with new ids. |
| 9 | ~~**Generators** — names, tables, dice~~ | Kanka, World Anvil | **Cut** — ships one list shared by every user; see §5.4. | Absent. |
| 10 | **Prebuilt entity-sheet templates** | Campfire, World Anvil | **Neutral if opt-in** — see §5.2. | Packs at creation (§5.4). Shipped: Comic, Novel craft, Tabletop stats. |
| 11 | **Guided questionnaires** — character interviews, thesauri | Bibisco, One Stop for Writers | **Careful** — helpful as prompts, prescriptive if they become required fields. | Mechanism exists (Suggestions, custom attributes); content does not. |
| 12 | **Structure templates** (Save the Cat, 3-act, Story Circle) | Plottr | **Only as seeds** — see §5.2. | 54 device pages exist as *reading material* only. |
| 13 | **AI assistance** | Sudowrite, Novelcrafter, Campfire | **Conflicts** — an AI that suggests is an AI with an opinion about your story. | Absent. Offline-first and self-hosting already make this read as a stance. |
| 14 | **Real-time co-editing** — live cursors | Ellipsus, Google Docs | **Neutral** — orthogonal to the premise. | Asynchronous collaboration with OCC, conflict resolution, roles and field-anchored comments; no live presence. |
| 15 | **Scene craft fields** — POV, goal/conflict/outcome, value shift | Fictionary, Save the Cat method | **Conflicts as native fields** — see §5.2. | Absent as columns; expressible today as custom attributes. |

---

## 5. Recommendations

### 5.1 Constraint removals — what landed, what is left

Nothing in §4 is worth as much as §2, because §2 affects every user and cannot be opted out of.

**Done**

1. **`Scene.locationId` nullable** (§2.1).
2. **Story Analysis boundary** (§2.4) — `completenessChecks`, off by default.
3. **`Event` as a container that is not a numbered chapter** (§2.3 / §4 #2) — type column, not a new table.
4. **`Scene.chapterId` nullable** (§2.1) — fragments listed under Unchaptered; not on the spine.

**Still open**

5. **A per-story vocabulary layer** (§2.5) — the most direct expression of "any medium" available,
   with no new entity and no change to the graph. The Comic pack adds fields; it does not rename Chapter → Page.
6. **Reconsider the `linear | branching` binary** (§2.2), including whether `Plot` must stay
   linear-only. A world bible with no narrative order has no honest option today.

### 5.2 What changed from the earlier draft of this document

An earlier version of this analysis recommended, as its second priority, **adding native scene craft
fields** — POV, goal/conflict/outcome, value shift — on the grounds that they would feed Story
Analysis. **That recommendation is withdrawn.** Under §1 it is the worst item on the list: it
encodes one school of novel craft (Swain's scene/sequel, Fictionary's model) into the schema of
every story in the app, including comics, campaigns and games that have no use for it. Worse, its
stated benefit — feeding Story Analysis — is precisely the prescription leak identified in §2.4.

The correct form is a **prebuilt custom-attribute pack** the writer opts into: a "novel craft" set
that creates those fields through `StorySchemaField`, which already exists and was built for exactly
this. Zero schema change, zero imposition, same capability for whoever wants it.

**Structure templates** (§4 #12) survive, but only in a specific shape:

- they **generate** entities the writer then owns, edits and deletes freely;
- they **never validate** afterwards — no "your story does not match the beat sheet";
- they **never appear in Story Analysis**;
- they are **labelled by origin** (Save the Cat is screenplay-derived; Kishōtenketsu is not
  novel-specific), so the writer chooses knowingly.

A seed you can throw away does not limit anyone. A rail does.

### 5.3 The list, consolidated

The single ordered view. Tier A first because it affects every user and cannot be opted out of;
within each tier, cheapest and most aligned first.

**Tier A — remove a constraint** (the premise in §1 applied to what exists today)

| # | Item | Ref | Cost |
| ---: | --- | --- | --- |
| 1 | ~~Make `Scene.locationId` nullable~~ | §2.1 | **Done** |
| 2 | ~~Write down the Story Analysis boundary — structural vs. opinion~~ | §2.4 | **Done** |
| 3 | Per-story vocabulary layer (Chapter → "Issue", Scene → "Page", …) | §2.5 | Low |
| 4 | Reconsider `linear \| branching`, and `Plot` being linear-only | §2.2 | Medium — needs design first |
| 5 | ~~Reconsider the chapter requirement on `Scene`~~ | §2.1 | **Done** — unchaptered bucket; index unused |

**Tier B — add capability without imposing an ontology**

| # | Item | Ref | Cost |
| ---: | --- | --- | --- |
| 6 | Freeform canvas / corkboard with dragging | §4 #1 | Medium |
| 7 | ~~`Event` decoupled from `Scene`~~ | §4 #2 | **Done** — `type` on `chapters` + anchors, not a new table |
| 8 | Mention auto-linking ~~and backlinks~~ | §4 #3 | Forward links **done**; backlinks still open |
| 9 | Family trees / genealogy | §4 #7 | Medium — may reuse `CharacterRelation` with a directional type |
| 10 | Research and reference items (URLs, PDFs) | §4 #6 | Medium/high |
| 11 | Custom in-world calendars | §4 #4 | High — new entity |
| 12 | Image maps with pinned locations | §4 #5 | High |
| 13 | Series above `Story` | §4 #8 | High — touches every story-scoped query |

**Tier C — opt-in content, no imposition** — all of it is one feature; see §5.4

| # | Item | Ref | Cost |
| ---: | --- | --- | --- |
| 14 | **Story packs**, chosen at story creation — carries schema fields, suggestion catalogues, tags, structure skeletons, stat systems and story settings | §5.4 | Low mechanism, content is the cost |
| — | ~~Generators — names, tables, dice~~ | §5.4 | **Cut** — see the shipped-content rule |

**Tier D — does not follow from the premise**

| # | Item | Ref | Verdict |
| ---: | --- | --- | --- |
| 19 | Real-time co-editing | §4 #14 | Neutral — orthogonal; the async model is stronger offline |
| 20 | AI assistance | §4 #13 | Conflicts — worth stating publicly as a stance rather than leaving as a silent gap |
| — | ~~Native scene craft fields~~ | §5.2 | **Withdrawn** — ships as #14 instead |

**Suggested next batch:** 3 (vocabulary) and 6 (corkboard). The original first batch's constraint
removals have landed; these two are still the cheapest remaining items that add no entity.

### 5.4 Story packs

Items 14–17 of the earlier draft were four names for one mechanism, and item 18 was cut. What
follows is the agreed shape.

**Chosen at story creation, never applied later.** Applying a pack to an existing story would flood
the operation log with dozens of synthetic operations interleaved with real history, and would risk
colliding with fields the writer already filled in. At creation there is no history to pollute and
nothing at stake: a new story uploads to a server whole, through the bootstrap path
(`uploadNewStoryToServer` / `POST /stories/import`), not as incremental operations.

**Collisions are deliberate.** Because the writer picks several packs in one moment, two packs
claiming the same `StorySchemaField` key is a decision the picker presents — conflict or merge — not
an accident against existing work.

**Payload.** Any subset of, all of them existing entities:

| Content | Serves |
| --- | --- |
| `storySchemaFields` | custom fields; `description` doubles as the interview question for questionnaire packs (already rendered under the field) |
| `suggestions` | value catalogues |
| `tags` | a starter tag set |
| `chapters` + `scenes` | a structure skeleton — a beat sheet is 15 named scenes with empty summaries |
| `stats` + `statStrengths` | a stat system with its tier ladder — "D&D stats" is six `Stat` rows plus a ladder |
| story settings | `type`, `statSystem`, `statNotation`, `normalizeSceneTiming` — safe to set **only** at creation |
| `worldRules` / `notes` | reference or prompts |

Examples worth shipping: a novel-craft field pack (the withdrawn native scene fields, as opt-in
fields), a Save the Cat / three-act / Story Circle skeleton, "D&D stats", "film skeleton", and
medium packs that pair with the vocabulary layer (§2.5) — a "Comic" pack installing the vocabulary
map *and* the fields *and* the catalogues is the concrete delivery of "any medium".

**It cannot become a rail.** Nothing records that a pack was applied — no `packId` column anywhere.
Creation-time-only makes this structural rather than merely a rule: a pack that exists only before
the story does cannot validate the story afterwards. Everything it creates is an ordinary entity the
writer owns, edits and deletes from the first second.

**Risks.** Creation-time-only removes most of them:

| Risk | Status |
| --- | --- |
| Key collisions with existing work | Gone — becomes a deliberate choice between packs in the picker |
| Uninstall losing `AttributeValue` data | Gone — there is no data yet |
| Operation-log flood on a synced story | Gone — a new story bootstraps whole |
| Seed becoming a rail | Structurally prevented |
| **Translation and bundle maintenance** | **Remains** — every pack is content in two languages, the problem already documented in the risks of `EXAMPLE_STORIES_PLAN.md` |

**Why generators were cut.** A generator would ship one list shared by every Keres user. The app
today contains no strings that limit it — everything is either translated UI chrome or entered by
the writer. That yields a general rule worth keeping:

> Shipped content is acceptable when installing it **transfers ownership** — the writer gets an
> ordinary copy they can edit and delete. It is not acceptable when it stays an external shared list
> the writer draws from but never owns.

Packs and example stories pass that test; a name generator does not. The cheap version that does
pass is a "pick at random" button over the story's own `Suggestion` catalogue, which is the writer's
own list.

---

## 6. Cost model

From `docs/finished_planning/PLOT_IMPLEMENTATION_PLAN.md`, a new entity costs: a shared entity and
Zod schema, two database schemas and migrations (SQLite and Postgres), two sync handlers,
export/import with id remapping, an `OperationLogEntityType` entry, global search integration, help
content in two languages, and tests across all of it.

| Item | New entity? | Relative cost |
| --- | --- | --- |
| Nullable `locationId` | No — one column, one migration each side | **Done** |
| Analysis boundary | No — categorisation plus documentation | **Done** |
| Nullable `chapterId` | No — one column; list bucket; numbering skipped | **Done** |
| Vocabulary layer | No — a label map on `Story` | **Low** |
| Structure templates | No — generates existing entities | **Low** (packs ship skeletons) |
| Custom-attribute packs | No — uses `StorySchemaField` | **Done** (mechanism + three shipped packs) |
| Freeform canvas | No — coordinates on existing rows | **Medium** |
| Mention linking + backlinks | Possibly none — derivable from text scanning | Forward **done**; backlinks open |
| `Event` | **No** — discriminator on `chapters`, plus `chapterAnchors` | **Done** (cheaper than a new table) |
| Custom calendars | **Yes** | **High** |
| Image maps | **Yes** (or Gallery extension) | **High** |

Calendars still deserve their own plan. Vocabulary and corkboard do not.

---

## 7. What Keres has that most of the category does not

Recorded so these are not traded away by accident:

- **Genuine offline-first**, with a real synchronization engine, optimistic concurrency and a
  user-facing conflict resolution flow. Most competitors are web-only or single-device.
- **Self-hostable**, with a documented API and a no-Docker home-server binary.
- **Structural story analysis** — unreachable scenes, dangling choice references, choice
  satisfiability, numbering integrity. Rare anywhere in the category. (See §2.4 for the part that
  should stay structural.)
- **Branching and linear in one tool**, with checks, effects, inventory and flags, plus a validated
  conversion between the two.
- **Per-story custom schema** across 7 entity types with 8 attribute types — the mechanism most
  competitors approximate with fixed templates.
- **The stats system** — axes, per-stat tier ladders, character modes, radar and ranking.
- **Item journeys** — possession and state tracked scene by scene.
- **Presence matrix and plot coverage** charts.
- **Public Showcase** — publishing a read-only story bible to the web.
- **Field-anchored comments** with five criticality levels and a cross-entity list.
- **54 story-device pages** in Portuguese and English, alongside a full help catalogue.
- **Story packs** at creation (no `packId` on the story): Comic, Novel craft, Tabletop stats.

---

## 8. Open questions

- Does `Story.type` need a third value, or should `Plot` simply stop being linear-only (§2.2)?
- Is the AI absence (§4 #13) worth stating publicly as a product stance? Under §1 it is a
  consequence of the premise, not an omission.
- Does "any medium" extend to the Showcase — should a published bible be presentable as something
  other than a story (a setting, a campaign)?
- Unchaptered scenes are off the spine and cannot be timeline anchors. Is that enough, or should a
  fragment be pin-able the way an Event is?
- Backlinks ("mentioned in") were deferred when auto-linking shipped. Still worth a panel?
