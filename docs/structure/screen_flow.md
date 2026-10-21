# Keres screen flow

> The real navigation lives in `apps/client/src/navigation/`. This document summarises what is there, not the other way round; if they diverge, the code wins. The drawer menus are built by `navigation/drawer/mainDrawerMenu.ts` and `navigation/drawer/storySelectionMenu.ts`.

Screens in React Navigation work through stacks. The main system is a drawer on top of several nested stacks, and the drawer is a grouped menu (groups remember being open or shut, per story).

`AppNavigator.tsx` is the root and switches between four root screens, according to the app's state: `ColdInstall` (`ColdInstallStack`), `LegalUpdate` (re-agreement with a changed app terms text), `StorySelection` (`StorySelectionStack`) and `MainSystem` (`MainSystemDrawer`).

## Root 1 - Cold Install

- The welcome / initial setup (`ColdInstallStack`): the local username, the app terms and privacy policy (each must be opened and agreed to before **Proceed** opens; rows show which are accepted and a note lists what is still missing).
  - Behind the scenes the system initialises the local database, populating the necessary tables (`ClientSettings`, etc.).
  - Once that is done, it moves on to Story Selection.

## Root 3 - Story Selection (`StorySelectionStack`)

A drawer with the list of stories on top, then groups:

- **Stories** (`StorySelectionScreen`): lists all the user's stories and which server each is linked to (or none, if offline-only). Story creation (`StoryFormScreen`) asks how to begin (the medium of the first work), whether the story is adults-only (+18) and its `type` (`linear`/`branching`); editing restricts some fields.
- **Create** group: packs (`PacksDrawer`: `PackList`, `PackForm`, `PackBrowse`, `ShippedPacks`), example stories (`ExampleStories`) and story import from a package file (`ImportStory`).
- **Server** group (absent in a serverless build): servers and friends.
  - Servers (`ServerManagement`, `ServerDetail`, `ServerRegistration`, `ServerPlan`, `ServerPaymentHistory`, `ServerVerification`, `Conversation`, `MyProfile`, `PublicProfile`, `ChangePassword`): the list shows each registered server compactly (address, user and `@tag`, last sync, and whether it answers); opening one shows `ServerDetail`, which has everything that can be done with it - the `@tag` (inline), the plan with its use and the person's own stories there with their entity count, plan and payment screens (only when the server sells plans), finishing the age check, messages to its administrators, profile and avatar, the author page (biography, links and palette shown on the server's public showcase), password and recovery codes, terms and privacy as accepted, *Download my data*, *Delete my account*, the connection and removal. Registering a remote Keres server (login/password) is how stories get sent/linked to it.
  - Friends (`FriendshipList`, `FriendshipForm`, `FriendDetail`) and messages (`MessageInbox`, `Conversation`): friendships live per server; the inbox has one line per conversation over every server. Messages are online-only: the server is the only copy.
- **Footer**: help (`HelpDrawer`) and app settings (`SettingsHome`, `Credits`): theme, language, terms and privacy, guided tours, the music tools switch, reset.

## Root 4 - Main System (`MainSystemDrawer`)

A grouped menu gives access to every module of the story, with one stack per module. Groups and leaves, in order:

**Search** (above the groups): **Global Search** (`GlobalSearch`) - a single field that searches by text in any table and any searchable field (native or custom attribute), with results grouped by entity type and labelled with their arc; tapping a result navigates straight to that entity's detail (`utils/entity/entityNavigation.ts`).

1. **Write** (open by default)
   - **Dashboard** (`MainDashboard`) - works as cards, a twelve-tile story overview and shortcuts; the label can show the story's own title.
   - **Narrative elements** (`NarrativeElementsStack`) - chapters, events, scenes and choices. Expanding a chapter shows its scenes; linear stories use the scene order and branching stories use layers. The stack also hosts the scene editor (`SceneEditor`), scene pages (`ScenePages`), scene music (`SceneMusic`), campaign `NewSession`, `FountainImport`, and the header opens the timeline/Gantt in linear stories (`StoryTimeline`) and the choice map in branching ones (`ChoiceView`).
   - **Manuscript** (the same stack: `Manuscript`, `ManuscriptExport`) - the compiled text, with options per format.
   - **Share** (`StoryShare`: `StoryShareIndex`, `StoryPublish`, `ManuscriptExport`) - publish a work to a server or export the story.
2. **Components** (open)
   - **Characters** (`CharactersStack`, with the relation graph `CharacterRelationView`), **Locations** (`LocationsStack`: list, detail, form, `LocationView` graph, `LocationMapList` and `LocationMap`), **Items** (`ItemsStack`, with item journeys), **Plots** (`PlotsStack`) and **Stats** (`StatsStack`, only visible when `Story.statSystem` is on: list, ladder, comparison, ranking). The entity labels follow the story's vocabulary.
   - `PlotsStack` holds Plot list/detail/form, `PlotMatrix`, `PlotProgress` and the linear-only `PlotReader`, and for branching stories also Routes (`Routes`, `RouteForm`, `RouteDetail`, `RouteSteps`, `RouteReader`, `RouteTimeline`) and `StoryNavigator`.
3. **World** (shut by default)
   - **World pieces**: "All" and one leaf per category (`WorldRulesStack`: rules, people, mythology, knowledge, fauna, flora) and **Calendars** (`CalendarsStack`: `StoryCalendarList`, `StoryCalendarForm`, `StoryAgenda`).
4. **Material** (open)
   - **Gallery** (`GalleryStack`), **Boards** (`BoardsStack`: `BoardList`, `BoardCanvas`), **Sketches** (`SketchStack`: `SketchList`, `SketchCanvas`) and **Songs** (`SongStack`: `SongList`, `SongEditor`).
5. **Organize and review** (shut by default)
   - **Notes** (`NotesStack`), **Tags** (`TagsStack`), **Story Analysis** (`StoryAnalysisStack`: the report and `StoryEntityCount`), **Comments** (`CommentsStack`), **Operation Logs** (`OperationLogStack`, an auditable history of synchronized changes) and **Story devices** (`StoryDevicesDrawer`, visible when the app setting is on).

**Footer**: **Story settings** (`StorySettings`: general, appearance, collaboration, vocabulary, custom attributes, suggestions; `StorySettingsStack`), **Help** (`HelpDrawer`) and **Story selection** (`StorySelection`) - the "back" item: it resets the root stack to the story list, without being stacked in the navigation history.

The Arcs (works) of the story are listed and edited from the dashboard (`ArcsStack`: `StoryArcList`, `StoryArcForm`), and the drawer can switch the active Arc when there is more than one; chapter/event lists and the timeline follow that filter.

### The per-entity screen pattern (Characters, Locations, Items, Item Journeys, Tags, World Pieces, Notes, Chapters)

Each entity has its **own** set of dedicated screens:

- **List** (`<Entity>ListScreen`) - a contacts-style list, with text search (matches highlighted), a tag filter, sorting, a favourites filter, and an **Advanced Search** button (`AdvancedSearchModal`) that exposes every searchable field of the entity (native + the story's custom attributes, if there are any). Implemented on top of the generic `GenericFilterSortList` component, which is reused by every entity - the genericity is in the *list component*, not in a *screen* behind it.
  - Tapping an item opens that entity's Detail screen with the `id` as a parameter.
- **Detail** (`<Entity>DetailScreen`) - it displays all the entity's fields in tabs (Details, Relations, Other), its relations (tags, anchored notes, linked gallery, mentioned-in backlinks, relations with other entities according to the type), and an edit button (a pencil) in the header that leads to the Form.
- **Form** (`<Entity>FormScreen`) - creation and editing use the same screen; it includes the custom fields defined in Custom Attributes, where applicable.

Exceptions to the pattern:
- **Locations** have a **graph** screen (`LocationGraphScreen`) and **maps** (`LocationMapListScreen`, `LocationMapScreen`). The choice map (`ChoiceViewScreen`) is a Narrative elements tool in branching stories.
- **Character Relations** have no Form of their own (creating/editing a relation happens from a Character's Detail screen) - they have a List and a Graph.
- **Gallery** does not follow List→Detail→Form: it is a grid of imported media (`GalleryListScreen`, visual cards instead of list rows) with one Detail screen per item (`GalleryDetailScreen`); "creation" is the file import flow, not a form of fields.
- **Boards, Sketches and Songs** are lists that open a dedicated editor (canvas or lead-sheet editor) instead of Detail/Form pairs.
- **Custom Attributes** (Story Schema) has a field List and Form inside Story settings, but no "Detail" - the field itself has no visualization separate from editing.
- **The Operation Log** is read-only: it has a List and a Detail, with no Form.
- **Comments** are cross-cutting: they can be opened beside a field on the detail screen and also appear in the centralised list; they have no entity form of their own.
- **Stats** are a story feature, not an ordinary entity: they have their own list, form, ladder, comparison and ranking screens; the character's detail/form concentrates modes and values.
- **Plots** follow List→Detail→Form only for the plot's own fields. The Plot form also owns N:N Scene membership (`PlotScene`) and its one-line notes. `PlotMatrixScreen` and `PlotProgressScreen` use linear order for linear stories and labelled graph distribution for branching stories; `PlotReaderScreen` remains linear-only.
- **The presence/journey matrix** is opened from the Character or Item lists or details. It compares character presence or item journeys across the scenes of linear stories.
- **Scenes** have no drawer entry or list of their own: they appear nested in the chapter, but keep a Detail and Form inside `NarrativeElementsStack`.

## Help

The **Help** entry is available in the main menu and in a story's menu. The index is searchable and every mapped screen shows a contextual help icon that opens the corresponding page. Guided tours (`docs/procedures/guided_tours.md`) anchor to screen elements.
