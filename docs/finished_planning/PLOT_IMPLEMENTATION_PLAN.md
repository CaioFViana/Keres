# Implementation plan: Plots

## Goal

To add **Plots** as narrative threads for linear stories. A Plot groups scenes that
may belong to more than one narrative thread. Each association explains, in a short note, that
scene's role in that Plot.

Plots will not exist in branching stories at this stage.

## Confirmed decisions

- `Plot` is an entity of its own, with a form and a detail screen.
- `PlotScene` is an N:N relation between Plot and Scene, with a one-line note.
- The relation will be edited inside `SceneFormScreen`; there will be no `PlotSceneFormScreen`.
- There will be no tags, favourites, comments, suggestions or custom attributes for Plots.
- Plots will enter the Global Search by name and details. `PlotScene` does not: it is a relation, not
  an independent destination.
- The Plot reader is textual, in a vertical flow, and not a collection of cards.

## Data model

### Plot

```text
id, storyId
name
details
createdAt, updatedAt, version, isDeleted, deletedAt
```

### PlotScene

```text
id, storyId
plotId
sceneId
note
createdAt, updatedAt, version, isDeleted, deletedAt
```

Integrity rules:

- a unique index on `(plotId, sceneId)`;
- `note` required, with no line breaks, with a short limit (recommendation: 160 characters);
- the Plot, the Scene and the relation must belong to the same story;
- the services and sync handlers reject creation/editing in stories that are not linear;
- a linear story with Plots cannot be converted to branching until its Plots are
  removed. The interface must explain the block;
- reads, charts and the Reader ignore soft-deleted records and relations with removed scenes.

## Navigation

A new `PlotsStack` drawer, below `NarrativeElementsStack`, available only for linear
stories:

```text
PlotsStack
├─ PlotListScreen
├─ PlotDetailScreen
├─ PlotFormScreen
├─ PlotMatrixScreen
├─ PlotProgressScreen
└─ PlotReaderScreen
```

The drawer item is hidden in branching stories. Protecting the services remains mandatory,
since hiding a screen does not protect synchronized or imported data.

## Screens and flows

### PlotListScreen

- A simple list, with search by name and basic sorting; no Advanced Search.
- Each item shows the name, an excerpt of the details and the number of related scenes.
- Header: create a Plot, open the Plot Matrix and open the Plot Coverage.
- A Plot with no scenes is valid, but must be visually identifiable as `0 scenes`.

### PlotFormScreen

- Creates and edits `name` and `details` only.
- It does not manage scenes: that avoids the same relation having two competing editors.

### SceneFormScreen: the "Plots" section

A new section visible only in linear stories, inspired by the character relation
management:

- existing relations appear as `Plot name + note`;
- adding a relation chooses an available Plot and fills in the one-line note;
- editing changes only the note or swaps the Plot, respecting uniqueness;
- removing undoes only the relation;
- when the Scene is saved, pending PlotScene changes are persisted using the same operation log,
  synchronization and feedback patterns already used by the character relations.

`PlotDetailScreen` is deliberately a reading view: it shows the name, the details and the related
scenes in narrative order. The scene's row opens the Scene's detail; editing the relation
stays centralised in `SceneFormScreen`.

## A shared narrative order

Extract or reuse a single function for sorting linear scenes by:

1. the Chapter's index;
2. the Scene's index.

That order will be used in the Plot's detail, the Reader, the Matrix and the Coverage. Do not duplicate the
local sorting present today in the Matrix, the Item Journey and the Timeline.

## PlotMatrixScreen

An SVG, interactive chart inspired by the presence matrix:

- rows: the selected Plots;
- columns: the scenes in narrative order, visually grouped by Chapter;
- cell: the PlotScene relation's note;
- clicking the row opens the Plot; clicking the cell or the header opens the Scene;
- a MultiSelectPill, a guided empty state, an initial limit of 12 and a select-all option;
- zoom, fit to screen and SVG export;
- colours, light/dark and the export follow the current SVGs' patterns.

Instead of fitting Plot into the global Presence Matrix modal, extract the common infrastructure into
a series × scenes matrix. Characters use a checkmark, Items use a state and Plots use a note.
Each product stays in its own screen and stack.

## PlotProgressScreen

A coverage chart, also exportable as SVG:

```text
Main plot   ███████░░░  7/12 scenes · 58%
```

- the denominator: all of the story's active scenes;
- the average in the header: the total number of PlotScene relations divided by the number of Plots, including
  empty Plots;
- bars sorted by name, with a future option to sort by coverage;
- tapping a bar opens the Plot;
- a short warning: scenes may belong to several Plots, so the percentages need not add up to 100%.

The metric's correct name is **coverage**, not participation, since Plots may overlap.

## PlotReaderScreen

A structural reading mode, with an `All scenes` or single-Plot selector.

- `All scenes`: each Scene appears once, in narrative order.
- A selected Plot: only the scenes related to that Plot, in the same order.
- Deliberately textual rendering: the Scene's small number/title followed by the `summary` in
  a continuous paragraph, with discreet dividers — no cards, card borders or editing
  controls.
- Tapping the title leads to the Scene's full detail.
- The header states the scope and the count, for example `Redemption plot · 6 scenes`.

The Reader does not show the PlotScene note in the main body: its aim is to read the story's
summary, not to review metadata. The note stays available in the Plot's detail and in the Matrix.

## Data, synchronization and import

Add Plot and PlotScene to every layer already required by the story's entities:

1. Shared entities and Zod schemas; `@keres/shared` exports.
2. `OperationLogEntityType`, recoverable types and operation presentation.
3. Tables, ORM relations and migrations in the SQLite client and the API/Postgres.
4. Client-side services with linear-story validation, uniqueness, soft delete, a local operation and
   `plot_changed` / `plot_scene_changed` events.
5. Client and server sync handlers, registration in the Sync Engine and remote events.
6. Full export/import, id remapping, version migration and example cloning.
7. Global Search: `Plot` searches `name` and `details`, uses an icon of its own and opens `PlotDetailScreen`.

PlotScene is not added to the Global Search, Tags, Comments, See Also or Favorites at this stage.

## Tests and acceptance criteria

- Create, edit, remove and synchronize a Plot and a PlotScene.
- Reject a duplicate association, a Scene from another story, an empty note and a branching story.
- Block the conversion from linear to branching with active Plots.
- Guarantee an identical narrative order in the detail, the Reader and both charts.
- Validate export/import and a cloned example with Plots and relations.
- Validate the Matrix, the coverage SVG, the average including an empty Plot, Plot overlap and the light/dark
  theme.
- Validate the Reader in `All` and with a selected Plot.
- Validate discovery through the Global Search and the correct return to the previous screen.
- Update the translations, the contextual help, the help catalogue and the release/format documentation.

## Delivery sequence

1. The shared model, database, sync, import/export and service tests.
2. `PlotsStack`, the list, the form and the detail.
3. The Plots section inside `SceneFormScreen`.
4. Global Search, help and documentation.
5. The Plot × Scene matrix and its export.
6. Plot coverage and its export.
7. The Plot Reader, responsive validation and a full regression.
