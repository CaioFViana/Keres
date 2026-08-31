# Keres screen flow

> Updated from the original version (pre-implementation planning notes). The real navigation flow lives in `apps/client/src/navigation/` - this document summarises what is there, not the other way round; if they diverge in the future, the code wins.

Screens in React Navigation work through stacks (and, in the case of the main system, a drawer on top of several nested stacks) - keep that in mind.

`AppNavigator.tsx` is the root and switches between three stacks, according to the app's state: `ColdInstallStack`, `StorySelectionStack` and `MainSystemStack`.

## Stack 1 - Cold Install

- The welcome / initial setup screen (`ColdInstallScreen`).
  - A field for the local username.
  - Behind the scenes the system initialises the local database, populating the necessary tables (`ClientSettings`, etc.).
  - Once that is done, it moves on to Story Selection.

## Stack 2 - Story Selection (`StorySelectionStack`)

- The main screen when there is no pending Cold Install (`StorySelectionScreen`): it lists all the user's stories and which server each is linked to (or none, if offline-only).
- Story CRUD (`StoryFormScreen`): creation allows setting every field, including `type` (`linear`/`branching`); editing restricts some.
- Server CRUD (`ServerRegistrationScreen`/`ServerManagementScreen`): registering a remote Keres server (login/password) to which stories can be sent/linked.
- Friendship management (`FriendshipListScreen`, `FriendshipFormScreen`, `FriendDetailScreen`) and the user profile (`MyProfileScreen`, `ChangePasswordScreen`) - relevant for collaboration between users of the same server.
- General app settings (`AppSettingsScreen`): theme (light/dark) and language.
- Story import/export through JSON (`ImportExportScreen`).
- Example stories ready to import (`examplestories/ExampleStoriesScreen`).

## Stack 3 - Main System (`MainSystemStack`, a drawer)

A unified drawer gives access to every module of the system, with one screen per entity. The drawer items' real order:

1. **Main Dashboard** (`MainDashboard`) - the drawer's label is dynamically replaced by the current story's own title, instead of the fixed text "Main Dashboard".
2. **Global Search** (`GlobalSearch`) - a single search field that searches by text in **any** table, in **any** searchable field (native or a custom attribute), with results grouped by entity type; tapping a result navigates straight to that entity's detail (`utils/entityNavigation.ts`).
3. **Characters** (`CharactersStack`)
4. **Narrative elements** (`NarrativeElementsStack`) - it brings together chapters, scenes and choices. Expanding a chapter shows its scenes; linear stories use the scene order and branching stories use layers. Scene/choice details and forms belong to this same stack; the header opens the timeline/Gantt in linear stories (`StoryTimelineScreen`) and the map/graph in branching ones (`ChoiceViewScreen`).
5. **Plots** (`PlotsStack`) - Plot list/detail/form and graph-aware distribution in both story shapes; the linear textual reader remains linear-only. For branching stories it also contains Routes and Story Navigator.
6. **Locations** (`LocationsStack`) - it includes a graph visualization of the relations between locations (`LocationGraphScreen`).
7. **Items** (`ItemsStack`)
8. **Tags** (`TagsStack`)
9. **World Rules** (`WorldRulesStack`)
10. **Notes** (`NotesStack`)
11. **Gallery** (`GalleryStack`)
12. **Custom Attributes** (`StorySchemaStack`) - where the user defines custom fields per entity type (see `project_plan.md`, the "Story Schema Fields" section).
13. **Suggestions** (`Suggestions`) - per-story storage of free values; it is not a standard fill-in catalogue (see `project_plan.md`).
14. **Stats** (`StatsDrawer`) - only visible when `Story.statSystem` is on; it brings together the stat list, ladders, comparison and ranking.
15. **Comments** (`CommentsStack`) - a centralised list of the comments made on the fields of the story's entities.
16. **Operation Logs** (`OperationLogStack`) - an auditable history of synchronized creations/edits/deletions.
17. **Story Analysis** (`StoryAnalysis`) - a report of structural problems the author would hardly notice on their own (orphaned scenes, broken choices, etc.); it reloads on focus.
18. **Story Settings** (`StorySettings`)
19. **Literary Devices** (`StoryDevicesDrawer`) - visible when the corresponding app setting is on.
20. **Help** (`HelpDrawer`) - it opens the help catalogue without leaving the story.
21. **Story Selection** (`StorySelection`) - the "back" item: it resets the root stack back to the story list, without being stacked in the navigation history.

### The per-entity screen pattern (Characters, Locations, Chapters, Items, Item Journeys, Tags, World Rules, Notes)

Each entity has its **own** set of dedicated screens:

- **List** (`<Entity>ListScreen`) - a contacts-style list, with text search (debounced), a tag filter, sorting, a favourites filter, and an **Advanced Search** button (`AdvancedSearchModal`) that exposes every searchable field of the entity (native + the story's custom attributes, if there are any). Implemented on top of the generic `GenericFilterSortList` component, which is reused by every entity - the genericity is in the *list component*, not in a *screen* behind it.
  - Tapping an item opens that entity's Detail screen with the `id` as a parameter.
- **Detail** (`<Entity>DetailScreen`) - it displays all the entity's fields, its relations (tags, anchored notes, linked gallery, relations with other entities according to the type), and an edit button (a pencil) in the header that leads to the Form.
- **Form** (`<Entity>FormScreen`) - creation and editing use the same screen; it includes the custom fields defined in Custom Attributes, where applicable.

Exceptions to the pattern:
- **Locations** have a **graph/map** screen (`LocationGraphScreen`). The choice map (`ChoiceViewScreen`) is a Narrative elements tool in branching stories.
- **Character Relations** have no Form of their own (creating/editing a relation happens from a Character's Detail screen) - they have a List and a Graph.
- **Gallery** does not follow List→Detail→Form: it is a grid of imported media (`GalleryListScreen`, visual cards instead of list rows) with one Detail screen per item (`GalleryDetailScreen`); "creation" is the file import flow, not a form of fields.
- **Custom Attributes** (Story Schema) has a field List and Form, but no "Detail" - the field itself has no visualization separate from editing.
- **The Operation Log** is read-only: it has a List and a Detail, with no Form.
- **Comments** are cross-cutting: they can be opened beside a field on the detail screen and also appear in the centralised list; they have no entity form of their own.
- **Stats** are a story feature, not an ordinary entity: they have their own list, form, ladder, comparison and ranking screens; the character's detail/form concentrates modes and values.
- **Plots** follow List→Detail→Form only for the plot's own fields. The Plot form also owns N:N Scene membership (`PlotScene`) and its one-line notes. `PlotMatrixScreen` and `PlotProgressScreen` use linear order for linear stories and labelled graph distribution for branching stories; `PlotReaderScreen` remains linear-only. The same stack hosts branching-only Route list/detail/form/reader and Story Navigator.
- **The presence/journey matrix** is opened from the Character or Item lists or details. It compares character presence or item journeys across the scenes of linear stories.
- **Scenes** have no drawer or list of their own: they appear nested in the chapter, but keep a Detail and Form inside `NarrativeElementsStack`.

## Help

The **Help** drawer is available in the main menu and in a story's menu. The index is searchable and every mapped screen shows a contextual help icon that opens the corresponding page.
