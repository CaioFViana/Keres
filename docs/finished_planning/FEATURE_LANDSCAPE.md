# Keres product landscape

**Status:** living product decision document  
**Last audited:** 2026-09-01
**Purpose:** describe the product Keres is building, distinguish delivered capability from proposals, and make strategic trade-offs explicit. It is not a release plan or a competitor feature checklist.

## How to read this document

The codebase is the source of truth for Keres. A claim is **implemented** only when the persisted model, client behaviour, server/sync path, import/export where applicable, and relevant tests are in place. A UI-only prototype, a finished planning document, or an example story does not meet that bar by itself.

Competitor information is intentionally narrow and time-sensitive. It is based on official product pages checked on the audit date, not on pricing, marketing promises, or an exhaustive feature matrix. Re-check it before making a roadmap decision. The competitors that matter depend on the job the user is hiring Keres for:

- **Plottr** for planning a linear book.
- **World Anvil** and **Kanka** for wide worldbuilding, maps, chronology, publishing and RPG work.
- **articy:draft** and **Twine** for playable or production-ready branching narrative.
- **Scrivener**, Dabble and similar tools for drafting and compiling prose.

This distinction is important: Keres should not pretend that all of these are the same market.

---

## 1. Product thesis

Keres is a **local-first, structured story bible** for people who need to connect a work's narrative, world, entities, time and choices. It is designed to support a novel, comic, game, campaign, screenplay or animation without making one medium's craft method mandatory for every other medium.

Keres is **not** the manuscript editor, game engine or public wiki for every use case. It may integrate with those tools, but it should not absorb their entire scope at the cost of its own model.

### 1.1 A useful, non-absolute principle

"Do not limit the creator" is a decision filter, not a literal promise. Every data model limits something. The question is whether a feature creates optional expressive power or forces everyone to use one theory of narrative.

- A board, custom attribute, calendar, optional pack or relation adds capacity.
- A required POV, value shift, three-act beat or mandatory chapter ordering imposes a method.

The first is usually aligned with Keres. The second is acceptable only as an opt-in seed that the creator owns and may change or delete.

### 1.2 The claim Keres still has to earn

"Usable by any medium" is directionally right, but not yet fully true in the product. Per-story vocabulary now lets a creator rename the visible default terms without duplicating the data model; it is a meaningful proof for comics, RPGs and game narrative. It does not create medium-specific workflows by itself: an issue is still stored through the same general container model, and a session is not yet a dedicated RPG entity.

---

## 2. Verified capability today

### 2.1 Story model and organisation

- Stories can be **linear** or **branching**. Branching stories use directed Choices between scenes, with conditions and effects.
- A Scene may have no location and no container. Unchaptered scenes are valid fragments, not invalid chapters waiting to be invented.
- A container is a Chapter or an **Event**. Events have their own display order and can be anchored in chronology; they are not forced into the numbered narrative spine.
- Custom attributes, tags, notes, see-also relations, galleries, items, character relations, stats, suggestions and comments provide a configurable story bible rather than one fixed character sheet.
- Story packs seed existing entities at creation. The creator owns the generated rows immediately; packs are not permanent rails over the story.

### 2.2 Time, spatial and visual surfaces

- Custom and standard calendars can express in-world dates, negative years, eras, time of day, seasons and moons; stories can choose a primary calendar, no primary calendar, or use calendar views in parallel.
- The agenda renders calendar dates and scenes/events placed on them. Calendar edits preview the current and newly interpreted anchored values before confirmation, and each calendar exposes its anchors for later inspection and navigation.
- A Scene can retain its relative gap or declare a calendar coordinate override. The coordinate remains independent of calendar labels so it stays recoverable when a calendar definition changes; an invalid interpretation is reviewable rather than silently rewritten.
- The linear timeline separates narrative order from anchored Events and chronology.
- Boards provide freeform entity pins, notes, arrows, card display modes, contextual card notes,
  direct resize and explicit stacking. Boards can be duplicated or deleted from their list items.
- Location Maps provide a structured location graph over saved image bases, with direct image resize,
  explicit stacking, free markers, and optional navigation from a point to another map. Maps can be
  duplicated or deleted from their list items.
- Story maps render the Choice graph for branching stories; location and character relation graphs provide other structural views.

These are authoring and inspection surfaces. A Location Map is **not** yet an uploaded geographic image with coordinate pins, layers and discoverable regions.

### 2.3 Data ownership and collaboration

- The client stores data locally and synchronizes through an operation log.
- The server supports roles, asynchronous collaboration, optimistic concurrency and user-facing conflict resolution.
- Stories, relations and supported media can be exported and imported as packages.
- Comments are field-anchored and can be reviewed across entities. Automatic prose links now also provide a derived, navigable mentioned-in/backlinks panel, counting referring entities separately from total mentions.

This is a meaningful architectural differentiator, but it is not a license to claim perfect reliability. Sync, conflict and import/export are critical infrastructure: every new persisted feature must prove its full lifecycle before it is described as production-ready.

### 2.4 Deliberate boundaries

Keres does not currently provide:

- a long-form manuscript editor, word-count workflow, editorial revision history or book compiler;
- a game runtime, playable branching reader, engine export or scripting language;
- real-time co-editing with cursors;
- a full public-world publishing and permission system;
- geographic region discovery, controlled reveal, map comparison/overlay or persistent geographic layers;
- a series-level shared entity model across Stories. Arcs now exist as an optional
  editorial subdivision *inside* one Story (Customization, vocabulary, default arc,
  `chapters.arcId`). The drawer can switch Arc context when more than one exists; chapter/event
  lists and the timeline follow that filter (only the selected Arc’s chapters and events;
  unchaptered scenes stay visible). Character, location
  and item details show a derived “appears in” list. Cross-story mentions are not shipped.

The operation log is not draft history. It records entity changes for synchronization and conflicts; it is not a safe substitute for snapshots of prose.

---

## 3. Constraints and partial capabilities

These are the places where Keres should be honest rather than letting a nearby feature imply more than it does.

| Area | Current reality | Product consequence |
| --- | --- | --- |
| Story shape | A Story is linear or branching; there is no neutral world-bible mode. | A reference setting must still choose a narrative shape. |
| Vocabulary | Per-story vocabulary changes visible entity terminology and packs may provide a vocabulary seed. | It improves fit across media without inventing a separate comic, RPG or game model. |
| Branching | Choices, checks, effects, graph analysis, Plot membership, Routes and an in-memory Story Navigator exist. | Keres now plans and inspects branching paths, but deliberately does not publish or execute a player-facing runtime. |
| Time in branching | The global narrative Timeline intentionally renders only linear stories. A valid Route has its own derived Timeline, ordered by RouteSteps and able to show gaps, durations and calendar dates. | A route describes one authored traversal, not a universal chronology for every branch. |
| Plot views | Linear views use narrative order; branching views use labelled graph/catalogue distribution. | Plot membership now works honestly across both story shapes; route-specific reading remains explicit. |
| Knowledge graph | Forward auto-links, manual see-also relations and a derived mentioned-in panel exist. | Discovery is purposeful for narrative entities, but remains narrower than a general connected-notes ecosystem. |
| Maps | Image bases, positioned Location points, free markers, saved layouts and point-to-map navigation exist. Images remain below points; creators can set stacking order within each visual class. | It is a private spatial planning canvas, not yet interactive cartography with regions, layers, controlled reveal or geographic discovery. |
| Series | Story is the top-level ownership boundary. | Shared canon across books or campaigns requires copying/importing today. |

### 3.1 Events in branching stories

An Event is a container of scenes, not an edge in the Choice graph. Choices can lead into or out of its scenes because Choices point at scenes, never at containers. Its index is a display order only; it never establishes the reader's route through a branching story.

That model is sound. The missing piece is presentation: a linear timeline cannot truthfully turn a graph of possible routes into one sequence. Do not solve this by silently choosing an arbitrary order.

### 3.2 Plots in branching stories

The existing Plot plus PlotScene model is already suitable for **membership**: a plot can mark a set of scenes, including scenes reached through different branches. This is the recommended first extension because it needs no new relationship shape.

It does **not** define a route. If a Plot must mean "take Choice A, then B, then C", Keres needs a separate route/step model that records selected Choices and supports variants, loops, deleted edges and validation. Do not pretend that an ordered list of PlotScenes is such a route.

---

## 4. Competitive reality

### 4.1 Keres is not competing on feature count

Worldbuilding and writing products have had years to accumulate categories, templates, publishing systems and integrations. Matching them one feature at a time is a losing strategy. Keres should compete on a coherent combination of local ownership, structured relationships, multiple visual views and safe asynchronous collaboration.

| User job | Strong reference products | Their verified strength | Keres's honest position |
| --- | --- | --- | --- |
| Plan a conventional book quickly | [Plottr](https://plottr.com/features/) | Mature drag-and-drop timeline, scene cards, plotlines, templates, filtering and series planning. | Behind in focused linear-planning polish and series workflows. Keres is more structurally connected, not faster for the ordinary outline. |
| Build and present a large world or campaign | [World Anvil](https://www.worldanvil.com/about), [Kanka](https://kanka.io/features) | Broad object catalogues, interactive maps, calendars, timelines, permissions and presentation/community surfaces. | World Pieces and spatial maps now cover structured private authoring for fauna, flora, mythology, rules, entities and places. Keres remains behind by a large margin in catalogue breadth, interactive cartography, public discovery and RPG-specific workflows. |
| Manage exact chronology | [Aeon Timeline](https://release.aeontimeline.com/version1/manuals/AeonTimeline_UserManualMac.pdf) | Chronology-centered events, arcs and custom calendars with historical ranges. | Keres has calendars, timeline foundations and route-scoped branching chronology, but remains behind in mature chronology tooling and deliberately has no universal date order for a branching graph. |
| Create interactive branching content | [articy:draft](https://www.articy.com/en/articydraft/feature-list/), [Twine](https://twinery.org/) | Visual flow, execution/simulation, variables or scripting, and publishing/engine paths. | Keres has a useful planning graph and story-bible context, but is not yet an interactive-fiction authoring or runtime tool. |
| Draft, revise and compile prose | Scrivener, Dabble, Novelcrafter and similar | Manuscript editing, revision workflow, targets and publishing export. | Deliberately outside Keres's scope. The right relationship is coexistence or integration, not feature parity. |
| Build a linked personal knowledge base | Obsidian and similar tools | Backlinks, graph navigation, local files and ecosystem extensibility. | Keres is stronger in first-class narrative entities and rules; it is weaker in backlink discovery and general-purpose extensibility. |

### 4.2 The competitive omission to correct

Any discussion of Keres branching must include articy:draft and Twine. Treating only Plottr or World Anvil as competitors hides the key distinction:

- Keres currently models and analyses a branching plan.
- articy:draft and Twine let the author execute, test or publish a branching experience.

Keres may intentionally remain on the first side of that boundary. If so, say it plainly. If it wants to cross it, that is a separate product strategy requiring a runtime, state persistence, playtesting, production export and a much stronger branching model.

### 4.3 A defensible position

The strongest positioning hypothesis is:

> Keres is a local-first story bible for complex works: it connects narrative, world, time, relationships, choices and spatial planning without forcing a single writing method or storing the manuscript.

This is a hypothesis, not a market fact. It becomes credible only when its weak points — vocabulary, branching parity and infrastructure reliability — no longer contradict it.

---

## 5. Strategic priorities

### Priority 0 — trust before breadth

The operation log, synchronization, conflict resolution, migrations, import/export and local data cleanup are the foundation of Keres. New features that persist or synchronize data must include real-database service tests and server integration coverage where they cross the network.

No visual novelty compensates for losing work or leaving a user unable to synchronize it.

### Priority 1 — make the multi-medium promise visible

Completed: per-story vocabulary now overrides the visible default terms while keeping the shared model, services, sync and export intact. Packs can offer a vocabulary seed. The remaining work is medium-specific workflow polish, not another terminology layer.

### Priority 2 — make branching a first-class planning mode

Completed: Plot membership extends to branching stories and each view is adapted honestly:

- plots highlight scenes/nodes in the Choice graph;
- detail and matrix use a labelled catalogue order, not a fictional reading order;
- coverage is described as scene coverage/distribution, not path progress;
- the branching Reader uses an explicit, valid Route; the linear Reader keeps its derived spine;
- conversion between linear and branching preserves ordinary PlotScene membership.

This has more strategic value than adding another isolated entity: it repairs a contradiction in the current model.

A valid Route can also be inspected as its own Timeline. Its axis follows RouteSteps, so revisiting a
Scene remains a distinct visit; gaps, durations, the story start and scene date overrides are read
through the existing calendar model. This is deliberately a derived, read-only projection: it does
not create a global chronological order for scenes outside that Route and does not persist dates.

### Priority 3 — improve connected discovery

Completed first step: auto-links now expose a derived, non-persisted mentioned-in panel with entity navigation. It reports both the number of referring entities and the total occurrences, avoiding inflated counts when one entity mentions a name repeatedly.

The next question is discovery breadth: richer graph exploration, filters and cross-story canon remain separate decisions.

### Priority 4 — choose the next expansion by audience

Do not pursue all of these simultaneously:

| If the target user is… | Invest next in… | Do not mistake it for… |
| --- | --- | --- |
| novelist / screenwriter | polish of Boards, calendar/timeline, Plot and external writing workflow | becoming a manuscript editor |
| worldbuilder / GM | map comparison, geographic layers, events and controlled reveal | instant parity with World Anvil/Kanka |
| game narrative designer | route modelling, graph validation, path inspection and later export | a runtime before the model is ready |
| multi-book creator | a deliberate series/canon model | a simple folder around Stories |

### Deliberately not a priority

- Native mandatory craft fields. Ship optional packs and custom attributes instead.
- AI assistance as an assumed feature. It requires an explicit privacy, cost and product stance.
- Real-time cursors before asynchronous collaboration is boringly reliable.
- A generic generator with centrally imposed lists. Creator-owned suggestion catalogues and packs are the compatible alternative.

---

## 6. Story packs: the permanent rule

Packs are creation-time seeds, not frameworks installed over an existing story. They may create existing rows such as custom fields, suggestions, tags, chapters, scenes, stats, World Pieces and notes. The creator may then edit or delete every one of them.

This preserves three properties:

1. No operation-log flood is retroactively added to a lived, synced story.
2. No pack owns user data or becomes a validation rail.
3. A structure template is a starting point, not an authority that judges the work later.

Content remains the cost: a pack requires useful, translated, maintained material. The mechanism is not the product by itself.

---

## 7. Decision gates for a new feature

Before implementation, every feature proposal should answer:

1. **User job:** which user and concrete problem does it solve?
2. **Boundary:** is it story-bible capability, manuscript editing, public presentation or a game runtime?
3. **Model:** does it require a new persisted entity, or can an existing relation/model express it?
4. **Topology:** does it assume a linear order, a graph route, chronology, or none of these?
5. **Lifecycle:** what happens on create, update, delete, sync, conflict, export, import, clone and story-type conversion?
6. **Honest UI:** does the screen say exactly what the data means, without inventing an order, path or certainty the creator did not provide?
7. **Verification:** which real-database and API integration tests make regression observable?

The fifth and seventh questions are mandatory for any stored feature. This is where a feature stops being a screen and becomes a reliable part of Keres.

---

## 8. Maintenance rule

Update this file in the same change that materially changes a capability or strategic boundary.

- Mark each claim as implemented, partial, proposed or deliberately out of scope.
- Link plans only as historical rationale; do not let a completed plan substitute for current code.
- Re-audit competitor statements when a roadmap decision depends on them.
- Keep release notes, roadmap and this document separate: one records change, one schedules work, and this one explains why the product exists.

## 9. 2026-09-01 capability record

Today's completed work tightened the boundary between linear and branching authoring as well as the reliability checks behind it:

- Routes, route steps and the Story Navigator support an explicit possible path through a branching story. The reader can use that path without pretending that the graph has one inherent order.
- A valid Route has a dedicated, calendar-aware Timeline. It uses route-step order rather than the
  chapter spine, so loops are visible and the global Timeline remains honest about branching
  ambiguity.
- Plot membership is available across story shapes, while the server now rejects stale Plot and PlotScene sync writes after a story is converted to branching. This protects conversion from offline operation-log resurrection.
- Example stories are rebuilt in the current export format, including routes collections, vocabulary and scene calendar-override fields; the example-package test guards this contract.
- The calendar, vocabulary and backlinks work described above is covered by client/shared/API lifecycle and architectural tests rather than being treated as UI-only capability.
- World Pieces extend the world model beyond rules: fixed Sections organise fauna, flora, mythology,
  people, knowledge and other world concepts, while creator-owned Types remain section-scoped.
  They participate in favorites, search, custom entity attributes and the existing reciprocal
  see-also system instead of adding a competing relation manager.
- Boards now support rich, resizable entity cards with live entity summaries and board-local notes,
  alongside direct stacking controls. Their list items expose confirmed duplication and deletion.
- Location Maps now use gallery image bases, positioned location points and map-only markers. A
  point can create or open another map as a cartographic destination; markers retain their own
  title, note, icon and colour without requiring a false Location entity. Images always render
  below points, while creators can control the stacking of images and points. Their list items
  expose confirmed duplication and deletion.

The remaining map boundary is intentional: Keres does not yet model geographic regions, reveal
states, persistent overlay alignment or a public interactive map. These maps are private story
planning documents, not a replacement for dedicated cartography or campaign-publishing systems.
