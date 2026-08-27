# Plan: Events

## 1. What an Event is

A container of scenes that has no place on the narrative spine.

"The Three Hundred Year War" is a thing that happened in the story's world. Today the only way to
record it with scenes is to make it a chapter, which forces it into the numbered spine — the reader
of the timeline sees "Chapter 4" where the writer meant "an era". The Event is the same container
with the numbering removed and a chronology of its own.

This is a §2 item from [`FEATURE_LANDSCAPE.md`](../FEATURE_LANDSCAPE.md): a constraint Keres imposes
on the writer rather than a feature it lacks. The story's shape is currently **derived from scenes**,
and every scene must belong to a numbered chapter, so anything a writer records with scenes acquires
a position in narrative time whether it has one or not.

---

## 2. Two axes, not one

Everything in this plan follows from separating two things the schema currently conflates:

| Axis | Question it answers | Where it lives |
| --- | --- | --- |
| **Narrative order** | In what order is this *told*? | `chapters.index`, the numbered spine |
| **Chronology** | *When* did this happen? | `chapterAnchors`, §5 |

A story tells its middle first; the events behind it still happened in one sequence. A single
counter cannot carry both, which is why the feature is not merely "a chapter without a number".

---

## 3. Storage: one column, not one table

### 3.1 The container

```ts
type: text('type').$type<'chapter' | 'event'>().notNull().default('chapter')
```

An enum rather than `isEvent: boolean`, matching `stories.type` (`linear | branching`) in the same
codebase. A boolean closes the door on a third kind and forces every call site to read `!isEvent`,
which is worse prose than `type === 'chapter'`. The default makes the migration non-destructive:
every existing row becomes a chapter with no data step.

### 3.2 Why not an `events` table

Two designs were weighed:

| | The container | The scene |
| --- | --- | --- |
| **New `events` table** | Clean: own table, own index space, no filtering | `Scene.chapterId` becomes a polymorphic parent, or two nullable FKs with an "exactly one" rule |
| **A `type` column on `chapters`** | A filter in a few places | Untouched |

**The scene decides it.** Everything that walks `scene → chapter` would have to learn about a second
kind of parent: `storyTimelineLayout`, the plot views, the presence matrix, the story graph,
`StoryAnalysisService`, and the export. A polymorphic parent poisons all of it, permanently, to keep
one table tidy.

By contrast, `chapters` is read in **10 client files and 9 API files**, and most of them
(`entityTableRegistry`, `EntityService`, `ChapterClientSyncHandler`) are generic and never look at
the value.

This is the same weighing that made `packs` a table of its own rather than a row in `stories` (see
the comment at the top of [`db/schemas/packs.ts`](../apps/client/src/db/schemas/packs.ts)) — and it
comes out the other way for the same reason. A pack is not a story wearing a disguise; **an Event
genuinely is a chapter that is not numbered.**

That decision pays off again in §5: because Events *are* chapters, the anchor table needs no
polymorphism at all.

### 3.3 The operation log keeps storing `Chapter`

The original note asked for it to *show* "Event"; that is display, derived from the row's current
`type`. Storing the kind in the log would make history lie about itself the moment somebody toggles a
container — the operation was what it was.

---

## 4. List order: the `reorderTarget` precedent

Reordering chapters is a **story-level** operation, and the server demands that the payload contain
exactly the story's non-deleted chapters, with indices contiguous from 1
([`StorySyncHandler.ts:150`](../apps/api/src/services/entity-sync-handlers/StorySyncHandler.ts),
[`reorderIndices.ts:34`](../packages/shared/rules/reorderIndices.ts)). An Event that shared that
space would consume a slot in the numbered spine — exactly what it exists not to do.

That is already solved elsewhere. `StoryReorderingStoryUpdateSchema` carries an optional
discriminator ([`SyncSchemas.ts:151`](../packages/shared/schemas/SyncSchemas.ts)):

```ts
reorderTarget: z.literal('StorySchemaField').optional(),
schemaEntityType: z.enum(STORY_SCHEMA_ENTITY_TYPES).optional(),
```

and the handler filters by scope *before* validating 1..N, so `storySchemaFields` already maintains
**seven independent index spaces inside one table**, one per entity type.

Events follow it exactly: `reorderTarget: 'Event'`, filter `type = 'event'`, own 1..M. Absent means
chapters, as today.

### 4.1 An Event's index is list order and nothing more

`chapters.index` is `notNull`, so an Event carries a value whether or not it means anything. With
chronology living in the anchors (§5), what it means is **the order the writer wants to see them
on screen** — nothing about when they happened.

That is a real thing to want (an eras list read top to bottom the way its author arranged it) and it
costs one branch in machinery that already exists. But it must not be read as chronology anywhere:
the timeline reads the relation graph, never the index.

Two things this feature does *not* need, because they already exist:

- **Duration.** A scene carries `duration` + `durationType`, and
  [`sceneTiming.ts`](../apps/client/src/utils/sceneTiming.ts) already understands units up to
  `millennia`. "Three hundred years" is expressible on the Event's scenes today.
- **Scene ordering inside an Event.** `ChapterReorderingStoryUpdateSchema` already reorders scenes
  within a chapter, and an Event is a chapter. Nothing to add.

---

## 5. `ChapterAnchor` — when a container happens

The one new entity in this plan, and the reason Events ship complete rather than as a container with
an ordering that over-claims.

**This section was rewritten.** It first specified `ChapterRelation`: qualitative interval relations
between two containers (`before`, `during`, `overlaps`, `simultaneous`), modelled on
`CharacterRelation`. That model was built, drawn, and rejected in review. §5.1 records why, because
the reason is the argument for what replaced it.

### 5.1 Why the relation model failed

Interval relations say how two things sit *relative to each other*. They never say **when**.

A writer who states "the war overlaps chapter 3" has not said whether it starts in the first
paragraph or the last. Drawing it therefore required inventing a position, which is how the graph
ended up with tiers and bands that looked authoritative while asserting things the writer never
said. Three further problems were structural rather than cosmetic:

- **No place to pause.** A war fought, paused, and resumed is one interval or three relations that
  cannot be told apart from three separate wars.
- **`during` and `overlaps` are indistinguishable to a reader.** The question was asked directly in
  review, and the honest answer was that the difference only shows up in the layout code.
- **Contradiction was possible and had to be hunted.** Cycles across transitive statements needed a
  dedicated integrity check (the old §7.2).

The timeline screen already places scenes on a real measured axis. Everything needed to say *when*
was there; the relation model simply refused to use it.

### 5.2 A stretch, stated against the scenes

An anchor is one stretch of story time: **from a moment to a moment**, where a moment is a scene, a
place inside that scene, and optionally a distance from it.

| The writer says | The row |
| --- | --- |
| "from the start of scene 3 to the end of scene 7" | one anchor, no offsets |
| "it happens during the middle of chapter 4's second scene" | one anchor, both points that scene |
| "the war pauses and resumes" | two anchors, `order` 1 and 2 |
| "300 years before the first scene" | one anchor, `startOffset: -300`, `startOffsetUnit: 'years'` |

The last row is the *ghost anchor*: the case no scene can express, because it is outside everything
the story shows. A negative offset means before, which follows the convention `Scene.gap` already
set. The layout converts it with the same scale the scene bars use, so three hundred years is as
wide there as three hundred years is anywhere else on the drawing.

Both kinds of container can be anchored. An event because it has no chapter number at all; a
chapter because a flashback happens at a different time from when it is told — the capability the
old §5.2 also wanted, kept.

### 5.3 Shape

```ts
export const chapterAnchors = sqliteTable('chapter_anchors', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  chapterId: text('chapter_id').notNull(),
  order: integer('order').notNull().default(1),
  startSceneId: text('start_scene_id').notNull(),
  startPosition: text('start_position').notNull().default('start'),
  startOffset: integer('start_offset'),
  startOffsetUnit: text('start_offset_unit'),
  endSceneId: text('end_scene_id').notNull(),
  endPosition: text('end_position').notNull().default('end'),
  endOffset: integer('end_offset'),
  endOffsetUnit: text('end_offset_unit'),
  // ...the usual sync columns
});
```

Unique on `(storyId, chapterId, order)` — plain columns, so unlike the relation model's
`MIN`/`MAX` pair index, drizzle-kit emits it correctly and it needs no hand-written migration.

`ScenePosition` is `start | middle | end`, with fractions 0 / 0.5 / 1. Three values and not a
percentage on purpose: a writer knows which third of a scene something happens in, and does not know
that it is 38%. The fraction interpolates across the scene's measured bar.

### 5.4 What absence means, and what cannot go wrong

No anchor means *it happens when it is told*. That is the ordinary case, it is the default, and it
costs nothing to leave alone — an important difference from the relation model, where saying nothing
and saying "unordered" looked the same.

Contradiction is nearly designed out. Two anchors on one container are two stretches, not a
disagreement, so there are no cycles to hunt and the old §7.2 check is gone. One failure remains:
a stretch that **ends before it begins**, which is what a writer produces by picking the two scenes
the wrong way round. `checkAnchorsRunForwards` reports exactly that (§7.2).

---

## 6. Toggling

Three operations, and all of them go through the log:

| Direction | What happens | Asks the writer |
| --- | --- | --- |
| chapter → event | update `type`; reorder the remaining chapters to close the gap; append to the event list | nothing |
| event → chapter | update `type`; reorder the remaining events to close the gap; insert into the chapter order | **where it falls** in the telling |

`chapter → event` asks nothing because the event list is display order (§4.1) — appending claims
nothing about when it happened. `event → chapter` must ask, because the numbered spine has no natural
slot for a new arrival and every position is an assertion about the telling.

Existing `chapterAnchors` survive a toggle untouched: they point at the container row, and the row
is still there. A chapter that becomes an event keeps whatever placement it had — which is exactly
right, since an anchor says *when* and the toggle changes only *how it is listed*.

For **branching** stories the position question is close to meaningless (the order of chapters is not
the order of reading), but the invariant still requires a contiguous index, so the same insert
happens with the end of the list as the default.

This is the riskiest part of the feature and §13 says why.

---

## 7. Story Analysis must change

### 7.1 The chapter index check breaks on day one

[`storyAnalysisChecks.ts:502`](../apps/client/src/utils/storyAnalysisChecks.ts) validates that
chapter indices are 1..N with no holes or repeats, and `StoryAnalysisService` feeds it **every**
chapter of the story. With two index spaces, a story with 3 chapters and 2 events hands it
`[1, 2, 3, 1, 2]` — duplicates.

Every story containing an Event would be accused of corrupted numbering. This is an **integrity**
finding, not an opinion, so the "less harsh analysis" toggle does not silence it.

The fix partitions **inside the check**, not in the query. Filtering events out of the analysis
input would also stop checking the numbering of the scenes *within* them - how a war began, the war
and its aftermath are as ordered as any chapter's scenes, and the API refuses a crooked reorder
there for the same reason. So the service feeds both kinds with their `type`, the spine check reads
only the chapters, and the scene check reads every container. This is not optional and belongs in
the same phase as the column.

It is the same class as the export bug the testing roadmap uses as its reference case: the data is
right, the validation went stale.

### 7.2 A new integrity check: anchors that run backwards

The anchor model retired the cycle search this section originally specified. Two anchors on one
container are two stretches rather than a disagreement, so there is no relation graph to contradict
and nothing to hang on.

What remains is a stretch that **ends before it begins** — the writer picked the two scenes the wrong
way round, and nothing else in the app would notice. `checkAnchorsRunForwards` compares the two
scenes by container index, then scene index, then position fraction, which is the same ordering the
timeline draws. It is an integrity finding: no arrangement of the story satisfies it.

A scene the analysis was not given is skipped rather than reported — that is a filtered view, not a
defect in the story.

### 7.3 What analysis should not do

Counting events among "your story has 40 chapters" would be wrong, as would applying spine-shaped
craft checks to them. Every existing chapter check needs a decision: does it mean the spine, or does
it mean containers?

---

## 8. Views

- **The Narrative Elements drawer** lists Events in the same list as chapters, reusing the same UI,
  before the chapters, with an icon instead of a number. A sort option ("events first") with a
  sensible default rather than a rule — eras above chapters is right for a world bible and wrong for
  a novel with one flashback.
- **The narrative timeline** shows an Event by name — "The Three Hundred Year War" — instead of
  manufacturing "Chapter 4: ...".
- **The timeline draws both**, and this replaced the separate historical-timeline screen the section
  originally called for. Once an anchor states *when* against the same measured axis the scenes are
  already on, a second canvas has nothing extra to say: `buildStoryTimelineLayout` takes the anchored
  containers, resolves each stretch to pixels, packs them into lanes above the scene rows, and the
  screen gains an **Events** toggle beside the scale control.

  The earlier argument for two drawings — "drawing both axes on one canvas re-creates the conflation
  this feature removes" — was answered by the model change rather than overruled. The conflation it
  feared was *interleaving two numberings into one order*. Bands do not do that: the axis stays the
  chapters', and an anchored container is drawn against it rather than inserted into it. The user
  asked for one screen, and by then the model made it the simpler thing to build.

- **Sort by chronology**, once §5 exists: the chapter list gains a "timeline" sort that reads the
  relation graph instead of the index — the story rearranged into the order things happened. It is a
  **topological** sort, not a total one: unrelated pairs have no stated order, so they fall back to
  the narrative index. Worth saying out loud in the UI, because a list that silently invents an order
  for unrelated chapters would be the total-order problem coming back through the front door.
- **Plots** need nothing: `plotScenes` references scenes, not chapters, so an Event's scenes join a
  plot like any other.

### 8.1 What comes free, and can be squandered

| | Why |
| --- | --- |
| **Auto-linking Events** | `MENTIONABLE_ENTITY_TYPES` already includes `'Chapter'`, so an Event's name becomes linkable with no work — **but the mention navigation must route a chapter of type event to the right screen**, or the link exists and leads nowhere |
| **See also** | `seeAlsoRelations` is polymorphic by type: Event ↔ WorldRule, Event ↔ Character, at no cost |
| **Favourites, search, comments** | Inherited from chapter |

### 8.2 A decision that must be made, not inherited

`CharacterScene` exists, so characters in an Event's scenes appear in the presence matrix
automatically. "Who fought in the war" is useful; mixed into narrative presence it pollutes, because
the matrix starts answering two questions at once. **Suggested: a filter, with events excluded by
default.**

### 8.3 Choices pointing into an Event

`choices.nextSceneId` references a scene, never a chapter, so a choice leading into an Event is
already expressible and should stay so — a choice that leads to a flashback is a real thing a writer
wants. The only cost is that reachability analysis must know an Event's scenes are reachable without
being on the spine.

---

## 9. The world bible

`FEATURE_LANDSCAPE.md` §2.2 records that **a world bible with no narrative order has no honest option
today**, and lists reconsidering the `linear | branching` binary as a recommendation.

Events answer it without adding a third value: a story of **zero chapters and N events** is a world
bible. Empty spine, chronology of its own, scenes with durations, characters and locations attached
as usual.

This was not in the original notes and may be the largest thing the feature unlocks.

**Audited.** The single `chapters[0]` in the codebase was already guarded, and the analysis over a
story of no chapters and nothing but events is covered in
`StoryAnalysisService.events.test.ts`: no numbering finding for a spine that does not exist, scenes
inside the eras still checked, and a report that comes back rather than throwing.

Two things remain untested rather than unknown, and both are screens: the narrative timeline is
empty for such a story (correct - there is no spine to draw), and the container list shows only
events. Neither has a suite yet, which is Phase 5 of `TESTING_ROADMAP.md`.

---

## 10. Compatibility: the protocol gate

**Done.** Implemented ahead of the rest, because Phase 6 cannot ship without it.

### 10.1 The protocol is not the release

Compatibility is decided by `SYNC_PROTOCOL_VERSION`, a number of its own in
[`packages/shared/metadata/SyncProtocol.ts`](../packages/shared/metadata/SyncProtocol.ts), modelled
on `CURRENT_STORY_FORMAT_VERSION`. Gating on `major.minor` would have refused 1.5 against 1.6 even
when nothing between them changed how a story travels — and most releases do not touch the wire.

Both ends declare a **range**, not a single number:

| Constant | Meaning |
| --- | --- |
| `SYNC_PROTOCOL_VERSION` | what this build speaks |
| `MIN_SUPPORTED_SYNC_PROTOCOL` | the oldest it still understands |

A peer is served when its version falls inside the range. Raising the minimum is the release where
old peers are cut off, and it should be a decision rather than a side effect.

### 10.2 Where it is enforced

| Where | What happens |
| --- | --- |
| `GET /kerescheck` | Publishes `{ version, syncProtocol: { current, minSupported } }`. `version` stays first and unchanged — every existing client reads it |
| Every client request | Announces `x-keres-sync-protocol` from the Axios request interceptor, so no call site can forget |
| `POST /sync/*`, `GET /sync/*` | **426 Upgrade Required** when the announced protocol is absent or outside the range |
| Server registration | Refuses a server whose published range excludes this build, before the account exists |

The server half is the one that protects anybody: the client half lives in the client, and an old
client does not have it. The gate runs **before** authentication, so a mismatched client is never
told "unauthorized" for a version problem.

Only `/sync` is gated. A mismatched client must still reach `/kerescheck` to learn why, and log in so
the app can say something better than nothing.

### 10.3 The gate is inert until somebody bumps the number

`SYNC_PROTOCOL_VERSION` is **1**, and every build that has ever announced one announces 1. The gate
therefore refuses only builds predating it — which is correct and is the point, but it means **the
Events work has to bump it itself**. Phase 6 is where that happens, and §12 says so.

Bump it in the release that makes `Scene.locationId` nullable, and raise `MIN_SUPPORTED_SYNC_PROTOCOL`
to match: a 1.5 client's table declares `location_id TEXT NOT NULL`, so a pull carrying a null fails
the insert and wedges that story's sync in a retry loop with no way out from inside the app. Events
reaching an old client are merely ugly by comparison — shown as numbered chapters, with reorders
refused — which is why they can ship at protocol 1 and the nullable column cannot.

---

## 11. What the testing roadmap requires first

This feature lands on the least-tested critical machinery in the repository. From
[`TESTING_ROADMAP.md`](../TESTING_ROADMAP.md):

| Roadmap item | Why it becomes blocking |
| --- | --- |
| §3.1 — four of five `ConflictResolution` values have **zero** test files | Toggling is a reorder whose meaning changes. Doing that on top of untested conflict paths is the one failure mode that is silent, remote and retroactive. |
| §5.3 — "index renumbering invariants (`ChapterService`) — 1..N with no holes, since the API refuses anything else" | Exactly the invariant this feature splits in two. `ChapterService.ts` is 109 lines at **56%**. |
| §5.2 — `reorder` + `keep_local`: "the whole order is the disputed value" | Two clients toggling different containers produce two reorders over two different scopes. |
| §6.2 — `StorySyncHandler` at 63.6% | It gains a third scope branch. |

**`ChapterService` coverage and the reorder conflict cells are a prerequisite, not a follow-up.**
They are Phase 1B work that was going to happen anyway, and cheap: `test/helpers/testDb.ts` gives a
real SQLite database with the production migrations applied.

---

## 12. Phases

| Phase | Scope | Ends with |
| --- | --- | --- |
| **0** | `ChapterService` + the reorder conflict cells covered (roadmap Phase 1B, scoped to chapters) | The invariant this feature edits is verified before it is edited |
| **1** (**done**) | The protocol gate (§10): `SyncProtocol.ts`, `/kerescheck`, the request header, the 426 on `/sync`, the registration check | Incompatible peers refuse each other, loudly and early |
| **2** (**done**) | The `type` column, `reorderTarget: 'Event'`, the API branch, the service, and the Story Analysis fix (§7.1) | An Event exists, syncs, reorders in its own space, and does not trip a false integrity finding |
| **3** (**done**) | The combined list grouped events-first, the hourglass, the kind switch at creation, the conversion modal, reordering scoped per kind | A writer can make one |
| **4** (**done**, **rebuilt**) | `ChapterAnchor`: table, schemas, both sync handlers, service, export format V7, the "When does this happen?" section on the chapter screen, `checkAnchorsRunForwards` (§7.2) | When a container happens is recordable |
| **5** (**done**, **rebuilt**) | Anchor resolution and event lanes in `storyTimelineLayout` + `storyTimelineSvg`, the Events toggle on the timeline screen, the presence-matrix events filter | When a container happens is visible, on the screen that already draws time |
| **6** (**done**) | `Scene.locationId` nullable, the protocol raised to 2 (§10.3), the narrative timeline confirmed spine-only, the world-bible audit (§9) | The constraint in §2 of the landscape is retired |

Phase 0 is not optional and does not depend on the rest. Phase 1 gates Phase 6 specifically: nulls
must not reach an older client, and the gate only starts refusing anybody when Phase 6 bumps the
protocol number. Phase 2 must not ship without §7.1 — the column without the analysis fix
is a visible bug in every story that uses the feature.

---

## 13. Risks

1. **The toggle's conflict story.** Two devices toggling different containers in the same story
   produce reorders in two scopes whose combination has never been exercised. This is the reason
   Phase 0 exists, and the single thing most likely to be got wrong.
2. **`ChapterAnchor` is a new entity inside sync.** Unlike `packs`, which sits outside the engine
   entirely, this needs a client handler, an API handler, an operation-log entity type, conflict
   behaviour and three migrations. It is the largest single piece of work in the plan, and the reason
   it has a phase to itself.
3. ~~**The chronology graph can be contradicted, and the layout must not hang.**~~ Retired with the
   relation model: a stretch cannot participate in a cycle, so there is nothing for the layout to
   hang on. What replaced it is smaller — a stretch anchored to a scene the reader has filtered out.
   The layout lists those by name (`unanchoredNames`) rather than dropping them, because an anchor
   the writer stated and the app silently omits reads as lost data.
4. **An old client that already holds a newer story.** The gate stops new damage; it does not undo a
   story already pulled. The client is in beta and older clients are already drifting out of
   compatibility, which is the argument for accepting this rather than building a migration path.
5. **Forgetting to bump the protocol** (§10.3). The gate is machinery, not a decision: it refuses
   exactly what the number says to refuse. Shipping the nullable column without raising it would
   leave the failure it was built to prevent fully in place, and nothing would complain.
6. **Every existing chapter check needs a decision** (§7.3). The ones nobody revisits will quietly
   start counting eras as chapters.

---

## 14. Pending: the example stories

The six bundled examples were bumped to format V7 and declare `chapterAnchors: []`. They are valid
packages, and it is true of them - a story written before chronology existed states none. But the
guard over them is named *"ships every public-domain example as a complete showcase of applicable
features"*, and on that promise they now fall short: nothing in the catalogue demonstrates an event
or a relation between two of them.

Closing it is **content work**, not code: each example needs at least one era or off-spine happening
that belongs to its source material, and a chronology relating it to the spine. Alice's Wonderland
has a before-the-fall; Cinderella has the years between the mother's death and the ball; the
Little Mermaid has whatever the sea witch did to the last one who asked. Inventing those is a
decision about the adaptations, so it waits for somebody to make it.

Until then the feature ships undemonstrated, which is a real cost: the examples are how a new writer
finds out a feature exists at all.

---

## 15. Deliberately out of scope

- **Nested Events.** An era containing eras turns the list into a tree and the chronology into a
  forest. The relation's `during` type already expresses containment without a hierarchy.
- **Events shared between stories.** A series with a common world wants this; Keres is `storyId`
  end to end. It is a different feature.
- **Full interval algebra.** Allen's thirteen relations are the complete vocabulary; the four in
  §5.4 are the ones a writer says out loud. The rest can be added without changing the shape.
