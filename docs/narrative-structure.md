# Narrative structure: chapters, scenes, events, anchors, plots, routes and choices

This document describes how Keres's narrative objects connect. It is a reference for the model and its behaviour: the names can change through the story's Vocabulary, but the types, ids, synchronization and rules below stay the same.

## Overview

```text
Story
├── Chapter / Event (editorial containers)
│   ├── Scene (narrative and temporal unit)
│   └── ChapterAnchor (when the container happens on the timeline)
├── Plot ──< PlotScene >── Scene       (plot: N:N membership)
└── [branching]
    ├── Scene ── Choice ──> Scene      (reading graph)
    ├── ChoiceCheckGroup ─< ChoiceCheck (when a choice is available)
    ├── Scene / Choice ── Effect        (changes the simulation state)
    └── Route ──< RouteStep              (an authored path through the graph)
```

One scene can belong to a chapter, to several plots, to a route and to several choices. These relations answer different questions; none of them should stand in for another.

## The story's three axes

There are three independent ways to organize the same narrative.

| Axis | Question it answers | Main objects |
|---|---|---|
| Editorial | "In what order does the author present this?" | Chapter, Event and the Scene `index` |
| Temporal | "When does this happen in the universe?" | gap, duration, start date, calendar, fixed date and ChapterAnchor |
| Causal / reading | "Where can the reader go?" | Choice, checks, effects and Route |

For example, a flashback can be the fifth chapter in editorial order, happen before the first chapter on the timeline and be reachable through one specific choice in the graph. That is valid, and it is exactly why the axes do not share a single "order".

## Chapter and Event

`Chapter` and `Event` use the same persisted container, told apart by `type`:

- **Chapter** groups scenes and stands for the ordinary editorial organization of a story.
- **Event** stands for an occurrence, period or historical layer that can cut across scenes or exist only as temporal context.

Each type has its own index space. The chapters' index forms the editorial spine used by the linear timeline; the events' index serves the author's organization and does not claim a universal chronology. Scenes may have no chapter: fragments, studies and narrative notes do not have to be forced into a container.

A chapter or event can exist without an anchor. It then does not declare when it takes place, and remains useful as editorial or thematic structure.

## Scene: the fundamental unit

A `Scene` is the smallest narrative unit the system measures. It can have:

- an optional Chapter and an `index` within the editorial organization;
- an optional Location;
- `gap` + unit: the interval between the end of the previous scene on the spine and the start of this one;
- `duration` + unit: how long the scene itself lasts;
- an optional fixed date (`calendarDateOverride`), in normalized coordinates, tied to the internal Gregorian calendar or to a custom calendar;
- start/end markers and descriptive content.

In a linear story, scenes of consecutive chapters form the **temporal spine**: gap, start, duration and end are computed cumulatively from the Story's initial date/time, when there is one. A Scene with a fixed date is an explicit exception to that relative reading for that scene; the value is stored as coordinates, not as month/era text, so that it survives calendar renames.

`gap` is not an absolute date. It keeps describing the relative narrative interval. Dates, calendars and anchors only offer ways to interpret or position that spine.

In a branching story, the choice graph does not invent a chronology. The temporal screens use the editorial spine that is available; an author should not infer that two scenes on different branches happen in sequence just because a Choice points from one to the other.

## ChapterAnchor: placing a container in time

`ChapterAnchor` does not anchor a Scene. It anchors a Chapter or Event to one or more stretches of the scene spine.

Each anchor defines:

- the container (`chapterId`);
- a start point: Scene + position `start`, `middle` or `end`;
- an optional offset, negative included, in a time unit;
- an optional end point, with the same structure.

Without an end point the stretch stays open and the duration is read from the container's own scenes. With an end point it declares an explicit interval. A container that pauses and resumes can have several stretches, ordered by `order`; an open stretch cannot coexist with another one of the same container, because there would be no way to tell where to split its contents.

Use an anchor to state, for instance, "this war began 300 years before Scene A" or "this flashback chapter takes place between the middle of Scene X and the end of Scene Y". It does not reorder scenes, does not change a Choice and does not write a new date onto the reference scenes.

## Plot and PlotScene: a plot is not a path

`Plot` is a thematic/narrative line: a romance, a conspiracy, a character arc, a mystery and so on. It works in both linear and branching stories.

A scene joins a plot through `PlotScene`, an N:N relation with:

- `plotId`;
- `sceneId`;
- a required short note explaining that scene's role in the plot.

A scene can belong to several plots, and a plot can start empty. In a linear story the membership can be read by following the editorial order; in a branching one the interface shows the distribution over the graph, without pretending there is a single reading order.

A Plot does not pick transitions, does not limit Choices and is not a Route. The Plot answers "what is this scene about in this narrative line?", not "which path did the reader take?".

## Choice, checks and effects: the branching graph

A `Choice` is an explicit edge:

```text
Source Scene (sceneId) ── Choice: text ──> next Scene (nextSceneId)
```

It exists only in branching stories. Linear stories advance by scene order, with no explicit Choices.

### Availability of a choice

A Choice can have groups of conditions (`ChoiceCheckGroup`).

- Inside a group, checks combine with **AND** or **OR**.
- Between groups of the same Choice, every group must pass (**AND**).
- A check in `enable` mode passes when its condition is true.
- A check in `block` mode passes when its condition is false; if the condition becomes true, it blocks the Choice.

Checks can evaluate:

- the number of visits to a Scene;
- the presence/absence of an Item in the simulated inventory;
- the set/unset state of a named trigger.

`Effect` is the side that writes that state. A Scene or Choice can grant/remove an Item or set/unset a trigger. When the story is simulated, entering a scene records the visit and applies the scene's effects; picking a Choice applies its effects. That state is transient to the Navigator or Reader: it does not change the Story's data, real items or persisted triggers.

## Route and RouteStep: a verifiable authored path

A `Route` belongs only to a branching story and stands for a possible path the author wants to name, review or offer to the Reader. It is neither a save game nor a Plot.

`RouteStep` records a **visit**, not just a Scene:

- `position` is continuous, from 1 to N;
- `sceneId` is the visited scene;
- `selectedChoiceId` is the Choice taken when leaving it;
- on the last step, `selectedChoiceId` is `null`.

Storing steps instead of a list of scene ids makes loops unambiguous: a route can visit the same Scene more than once. Validation confirms that each Choice exists, leaves the step's scene and arrives at the next step's Scene. Invalid routes are not deleted automatically: they remain the author's historical intent and are shown as needing review.

The Story Navigator uses the same check/effect rules for a shallow simulation. The visited path can become a Route; the simulated state of items and triggers is not saved in the Route.

## Practical examples

### Linear story with a flashback

1. The chapter "Return" is chapter 5 in editorial order.
2. Its scenes have ordinary gaps/durations for reading.
3. A ChapterAnchor places it 20 years before Scene 1.
4. The Plot "Origin of the conflict" includes two scenes of that chapter and one present-day scene.

The reader still meets the flashback at the chosen editorial point. The timeline explains that it happens earlier; the Plot explains why the three scenes belong to the same arc.

### Branching story with a route

1. Scene A has Choices to B and C.
2. The Choice A → B requires the trigger `hasKey` to be set.
3. The earlier scene, or the Choice that finds the key, has the effect `triggerSet(hasKey)`.
4. The Route "Escape through the archive" records A, the Choice A → B, B and so on.

If the Choice is changed to point at D, the Route is not silently rewritten. Validation reports that it no longer represents a valid path, and the author can adjust it consciously.

## Quick-pick rules

| If you want to… | Use… |
|---|---|
| Group scenes the way the reader meets them | Chapter |
| Record an occurrence/period that can cut across the story | Event |
| Measure what happens and how long it lasts | Scene + gap/duration |
| Say when a chapter or event happened relative to the story | ChapterAnchor |
| Show a scene's role in a thematic arc | Plot + PlotScene |
| Create a reading fork | Choice |
| Restrict a Choice by narrative state | ChoiceCheckGroup + ChoiceCheck |
| Change the state that checks use | Effect |
| Declare one possible path from end to end | Route + RouteStep |

## Persistence and synchronization

Every object in this document is a synchronizable entity of the Story. They take part in export and import, the operation log, tombstones and conflict resolution. Relations such as `PlotScene`, `RouteStep`, `ChapterAnchor`, checks and effects are not disposable interface details: they are authored data and must travel with the Story when it leaves or returns to the device.

For details on checks and effects, see also [choice_mechanics.md](choice_mechanics.md). For the screen flow, see [screen_flow.md](screen_flow.md).
