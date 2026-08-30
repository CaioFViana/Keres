# Branching parity, Routes and Story Navigator

**Status:** implementation in progress  
**Scope:** Priority 2 of `FEATURE_LANDSCAPE.md`  
**Last updated:** 2026-08-30

## Objective

Make branching a first-class **planning** mode without lying about what a graph can tell the
writer. Linear and branching stories must share neutral capabilities such as Plots, scene
membership, notes, events, calendars, maps, search and export. When their topology differs, the
screen must present the difference explicitly instead of silently inventing a reading order.

This plan also introduces two complementary concepts:

- **Route** is an authored, persisted possible path through a branching story.
- **Story Navigator** is a temporary, in-memory simulation of choices, checks and effects.

Keres remains a story-bible and planning tool. A Navigator is not a public game runtime, a script
engine, a save-game system or a publishing/export format for interactive fiction.

## Implementation status — 2026-08-30

The delivery order below remains the source of truth. This section records what is actually in the
product so a later change does not mistake a proposal for delivered behaviour.

- [x] Shared narrative projection: honest linear order, branching catalogue/layers and derived
  linear edges.
- [x] Plot parity: services, forms, detail/list, matrix/distribution and map filtering work for
  both story types. A Plot is authored in its own form; that form also owns its Scene membership
  and one-line relation notes. This deliberately replaces the earlier proposal to edit the same
  relationship from the Scene form.
- [x] Story Flow: linear stories use the shared graph surface with derived consecutive edges.
- [x] Route foundation: shared entities/schemas, generated client and server migrations, local
  operation log, sync handlers, export/import migrations and round-trip coverage.
- [x] Route UX: list, guided step editor, validity reporting, detail and route-specific Reader.
- [x] Navigator evaluator and UI: in-memory checks, block/enable reasoning, item/trigger effects,
  active state and current-scene navigation.
- [x] Contextual Help: dedicated Routes page and contextual shortcut on every Route/Navigator
  screen; the Plots page now documents branching parity correctly.
- [x] Navigator persistence boundary: the author can save the simulated traversal as a new Route
  or replace a selected Route, with an explicit confirmation before writing.
- [x] Route global-search entry and direct entity navigation from search.
- [ ] Route-scoped chronology/date presentation, only after the persistence and usage model has
  been exercised.
- [ ] Final cross-layer audit: conversion preservation, offline sync/conflict recovery and
  branching Plot/Route package round trips need their remaining explicit integration tests.

## Product decisions

### Three kinds of narrative information

Every feature in this area must name which of these it operates on.

| Kind | Linear story | Branching story | Persistence |
| --- | --- | --- | --- |
| Narrative structure | Chapter and Scene indexes | Scene nodes and Choices | Existing entities |
| Presentation order | Canonical narrative order | Catalogue order or graph layers | Derived only |
| Reader path | The canonical order | A selected Route | Derived for Linear; stored for Branching |
| World chronology | Gaps/durations on the canonical sequence, plus anchors | Explicit anchors only until a Route or explicit scene chronology exists | Existing anchors; later extension only if needed |

No screen may call a catalogue order a reading order. No screen may make an inferred graph edge
persist merely to draw a convenient visualisation.

### Plot is membership, not a path

`PlotScene` continues to mean only: “this Scene participates in this Plot, with this short note.”
It does not say that the Scene follows another Scene, that the Plot is complete, or that the Scene
appears on every route. The existing `Plot` and `PlotScene` model is sufficient for this extension;
the current linear-only guards are the limitation.

### A Route is not a Plot

A Route is an intentional traversal. It must identify the exact Choice chosen between two
consecutive Scene visits. The same Scene can appear more than once, which is necessary for loops.
A Route may cross many Plots and a Plot may be present in many Routes. Neither entity owns the
other in the first version.

### Navigator state is ephemeral

The Navigator starts with an empty simulation state, unless a future explicit scenario/template
feature supplies initial inventory or triggers. It never writes items, triggers, visit counts or
effects into the story database. The only intentional persistence action is **Save as Route** (or
update an existing Route), which writes the selected sequence of visits and Choices.

## Shared narrative projection

Introduce a pure shared package utility, tentatively `buildNarrativeProjection`. It receives
active Scenes, Chapters, Events and Choices and returns only derived information. Screens must use
this projection rather than inventing local sorting rules.

### Required outputs

- active Scene lookup and valid Choice lookup;
- component, reachability and graph-layer information;
- an honest `presentationOrder`;
- labels explaining that order (`narrative-order`, `catalogue-order`, or `graph-layer`);
- implicit Linear edges for visualisation only;
- detached/dangling nodes and invalid links for diagnostics;
- scene grouping by Chapter/Event without treating a container as a graph edge.

### Linear projection

- Canonical order is Chapter index, then Scene index.
- The projection may derive an edge from every Scene to its immediate successor, including the
  transition to the next non-empty Chapter.
- Those derived edges are used by a future **Story Flow** map and by common graph renderers. They
  are never stored as Choices and never enter the operation log.

### Branching projection

- The graph is defined only by stored Choices.
- Presentation order is deterministic but non-narrative: connected component, graph layer,
  Chapter index, Scene index and name are suitable tie-breakers.
- Cycles, backward edges, convergence and detached nodes remain visible facts, not errors to be
  flattened away.

The projection and the existing Story Map layout should share the same layer semantics. There must
not be one definition of a layer for maps and another for Plot matrix columns or Item journeys.

## Phase 1 — Plot parity

### Data and services

- Remove Linear-only rejection from `PlotService` and `PlotSceneService`.
- Keep all existing same-story, duplicate-relation, soft-delete, permission and one-line note
  validation.
- Make `useStoryPlots` consume the shared narrative projection and accept either story type.
- Replace every `selectedStory?.type === 'linear' ? storyId : undefined` guard in Plot screens and
  hooks with type-aware presentation behaviour.

### Conversion

- Linear → Branching must retain every Plot and PlotScene relation. The derived consecutive
  Choices created by conversion do not alter Plot membership.
- Branching → Linear continues to require a graph that can truthfully become one sequence. When it
  is compatible, Plots and PlotScene relations stay intact.
- Remove the current conversion block that forces the author to delete Plots before becoming
  branching.

### Plot screens

| Surface | Linear presentation | Branching presentation |
| --- | --- | --- |
| Plot list/form | Same feature | Same feature |
| Scene form | Plot membership editor | Same editor |
| Plot detail | Scenes in narrative order | “Scenes in this Plot, organised by graph flow”; show layer/component context where useful |
| Plot matrix | Scenes in narrative order, grouped by Chapter | Scenes grouped by graph layer and component; Chapter remains a secondary colour/grouping cue |
| Coverage | Narrative coverage | **Plot distribution**: scenes in the Plot / all active scenes, optionally reachable-only or detached-only |
| Reader | Existing all-scenes/Plot reader | Not available without a selected Route |

In branching mode, copy must use “scenes”, “distribution” and “graph flow”; never “next Scene”,
“progress through the story” or “reading order”.

### Story Map integration

Add a Plot filter to Story Map:

- select one or multiple Plots;
- give participating nodes a stable Plot colour/border and show overlap accessibly;
- include the selected Scene's Plots in its node sheet;
- include a Plot's Scenes in its sheet and navigate between plot, Scene detail and map node;
- retain all selection/filter state locally to the screen, never in `Plot` rows.

## Phase 2 — Route model and route-aware Reader

### Persisted model

Add two entities, with the standard ownership, soft-delete and version fields.

```text
Route
  id, storyId
  name
  details nullable
  createdAt, updatedAt, version, isDeleted, deletedAt

RouteStep
  id, storyId, routeId
  position (1..N)
  sceneId
  selectedChoiceId nullable
  createdAt, updatedAt, version, isDeleted, deletedAt
```

`selectedChoiceId` belongs to the transition *out of* this step. It is null only for the final
step. This intentionally permits repeated Scene ids because the identity of a visit is `RouteStep`,
not `sceneId`.

### Integrity rules

- Route, RouteStep, Scene and Choice belong to the same Story.
- Active positions are unique per Route and form a contiguous `1..N` sequence.
- The first RouteStep needs no incoming Choice.
- For every non-final step, `selectedChoiceId` exists, starts at that step's `sceneId`, and points
  to the next step's `sceneId`.
- A final step has no `selectedChoiceId`.
- A deleted Choice or Scene does not erase historical intent. The Route becomes **invalid** and
  explains the broken step; it is never silently rewritten.
- Routes are available for branching stories. Linear stories expose a derived “Narrative spine”
  route to the Reader but do not store duplicate RouteStep rows in this phase.

### Route authoring UI

- New `Routes` entry under Narrative Elements for branching stories.
- List: name, number of visits, validity and last update.
- Detail: ordered visits, selected choice text, brief Scene summary and broken-step warnings.
- Form: starts by selecting a Scene; each following step offers only outgoing Choices of the
  current Scene. It supports ending a Route, editing a choice, removing a suffix and appending a
  visit. It does not offer a generic arbitrary Scene picker after the first step.
- Scene detail may show which Routes include that Scene, but this is a derived relation, not an
  editable Scene field.

### Reader

The Reader becomes `Reader(story, route?)`:

- Linear defaults to the derived narrative spine and preserves the existing Reader behaviour.
- Branching requires a valid Route selector. It shows the route's Scenes in visit order and an
  unobtrusive “choice taken” divider between visits.
- An invalid Route can be opened for repair but cannot be read as a trustworthy sequence.
- Plot filtering remains a Linear Reader option only in the first implementation; filtering a
  Route by Plot would create holes and falsely imply contiguous reading.

## Phase 3 — Story Navigator

### Purpose and boundary

Navigator lets an author walk a branching story as a planning simulation. It answers:

- Which Choices are currently available?
- Why is a Choice blocked?
- What state change will this Scene or Choice cause?
- Which visits, inventory and triggers led here?

It does not render a player-facing game, save progress, execute external code, write story rows or
claim that it has tested every possible state.

### Shared evaluator

Extract a pure evaluator from the existing Choice analysis logic. It accepts:

```text
SimulationState
  sceneVisits: Map<sceneId, number>
  inventory: Set<itemId>
  triggers: Set<triggerName>

evaluateChoice(choice, groups, checks, state) ->
  available
  checks with readable outcomes
  block/enable explanation
  effects that would apply

applyEffects(state, effects) -> nextState
```

The Navigator, diagnostics and later route validation must use this evaluator. A condition cannot
be “available” in the Navigator but impossible according to analysis.

Scene-entry effects apply exactly once when a Scene visit is entered. Choice effects apply exactly
once when the author takes that Choice. Re-entering a Scene in a loop creates another visit and
applies its entry effects again; the history makes this visible.

### Navigator screen

- Available only for branching stories, launched from Story Map, a Scene detail or Routes.
- Start at a chosen start Scene; if more than one exists, require the author to choose.
- Show the current Scene's summary and outgoing Choices.
- Each Choice displays its text, availability, check descriptions and effect preview.
- Blocked Choices remain visible by default, with the precise unmet condition; a compact setting
  can hide them after the writer has inspected them.
- Show a compact state panel: visit counts, current inventory and active triggers.
- Keep a history stack. Going back restores the exact prior state rather than attempting to reverse
  effects heuristically.
- Actions: restart, choose another start Scene, copy a diagnostic trace, save current history as a
  new Route, or replace a Route after confirmation.
- A story change while Navigator is open revalidates the current position. It warns and pauses on
  a removed Scene/Choice rather than silently continuing with stale data.

## Phase 4 — shared graph value for Linear stories

Create **Story Flow** for Linear stories using only derived consecutive edges from the shared
projection. It reuses Story Map infrastructure and gains the same visual filters:

- Plot highlights;
- Chapter colours;
- Scene details and entity navigation;
- detached/uncontainered scene diagnostics.

The UI calls it “Story Flow”, not “Choice Map”, because no authored Choice exists. This is how
Linear stories benefit from the graph work without storing fake data.

## Chronology and calendars

Routes make a route-specific elapsed sequence possible, but they do not automatically solve
chronology. A Scene's existing gap/duration is presently interpreted in the Linear spine. In a
branching story it cannot be assigned a date merely because one arbitrary path reaches it.

Therefore:

1. Do not enable the existing calculated Timeline/Agenda for all branching Scenes merely by
   removing its guard.
2. Continue to show explicitly anchored Chapters/Events as chronological facts independent of
   narrative paths.
3. After Routes exist, offer a route-scoped duration/date view only when every visited Scene has a
   meaningful gap/duration interpretation. Label it with that Route's name.
4. If users need global dates for branching Scenes, design a later, explicit Scene chronology field
   (absolute in-world instant or range). That is a new persisted feature and must not be smuggled
   into `gap` semantics.

## Lifecycle work for Route and RouteStep

Every new entity must be added together, not incrementally per screen:

1. shared entities, Zod schemas, exports and `FullStoryExportSchema`;
2. client SQLite and API database tables, foreign-key/index strategy and generated migrations;
3. client services, ownership/role checks, versioning, soft deletion and operation-log records;
4. client and server sync handlers, event names, conflict display naming and recovery metadata;
5. export/import, duplicate/id remapping, format migration and example-story builders;
6. global search for `Route` by name/details, entity navigation and contextual help;
7. translations in every supported language, including honest route/navigator terminology.

Migrations are generated only with `bun run db:generate`; they are never hand-authored.

## Test strategy and acceptance criteria

### Pure-domain tests

- Linear and Branching narrative projections are deterministic.
- Projection handles cycles, convergence, backward edges, dangling Choices and detached Scenes.
- Route validation accepts a valid route, accepts repeated visits in a loop and rejects wrong
  Choice/Scene pairs, cross-story rows, gaps and broken final steps.
- Simulation evaluator covers AND/OR groups, `block`/`enable`, scene visit counts, inventory,
  triggers, Scene effects, Choice effects and revisits.

### Service and database tests

- Plot and PlotScene create/update/delete work identically in both story types.
- Linear ↔ Branching conversion preserves Plots and PlotScene rows.
- Route and RouteStep operations record exactly one correct local operation per changed entity.
- Soft-deleted/removed Scene or Choice invalidates a Route without rewriting it.
- Role policy, duplicate relation and cross-story integrity are enforced outside UI.

### Synchronization, conflicts and packages

- API integration covers Route and RouteStep create/update/delete, stale-version conflict and
  remote application.
- A branching Plot relation and a Route survive offline creation followed by sync.
- Full export/import and clone round trips preserve Plot membership and Route validity.
- Importing an older package defaults new optional collections safely.

### UI and accessibility tests

- Branching Plot screens never display linear-only Reader/progress terminology.
- Story Map Plot filtering preserves selection and supports entity navigation/back navigation.
- Reader requires a valid Route in branching and retains the derived spine in Linear.
- Navigator explains unavailable Choices, applies state only in memory and restores exact state on
  Back.
- Save-as-Route confirmation makes the only persistence boundary explicit.

## Delivery order

1. **Projection contract and Plot parity:** pure projection, services, conversion, Plot screens,
   matrix/distribution and Story Map filters.
2. **Route foundation:** schema, generated migrations, services, sync, package lifecycle and tests.
3. **Route UX and Reader:** Routes stack, authoring, validation, Reader selector and navigation.
4. **Navigator engine:** shared evaluator with exhaustive tests before UI.
5. **Navigator UI:** state/history, diagnostics, save as Route and route replacement.
6. **Linear Story Flow:** derived graph visualisation and shared filters.
7. **Chronology follow-up:** only after route usage clarifies whether explicit Scene chronology is
   required.

## Completion definition

Priority 2 is complete only when a writer can create a Plot in either story type, see its Scene
membership accurately in list/detail/matrix/map views, convert story type without losing neutral
data, define and read a valid branching Route, and inspect Choices/checks/effects in Navigator
without the simulator mutating the story. All of those behaviours must survive sync and a full
export/import round trip.
