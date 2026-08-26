# Support for dynamic story structures (Interactive Fiction/CYOA)

This document summarises the discussion and the plan for adapting Keres's data structure to support non-linear narratives, such as Interactive Fiction (IF) or "Choose Your Own Adventure" (CYOA), without compromising the existing experience for linear stories.

## The initial problem

The current structure of stories in Keres is linear, defined by the `index` fields on `Chapters` and `Scenes`. That prevents representing branching narrative paths.

## Goal

To let authors create stories with multiple paths and choices, keeping things simple for linear stories and without needing complex game logic or worrying about migrating existing data.

## Proposed approach: hybrid support (linear and branching)

The solution involves introducing a new `Choice` entity and a `type` field on the `Story` entity, letting the system adapt dynamically to the kind of narrative.

### 1. Data model adjustments

*   **Keep `index` on `Chapter` and `Scene`:** the `index` field will be kept. For linear stories, it will carry on defining the sequential order. For branching stories, it will serve as an organizational tool (e.g. the default display order in lists).

*   **Add `type` to `Story`:**
    *   A new field `type: 'linear' | 'branching'` will be added to the `Story` entity (and its corresponding Zod schemas).
    *   New stories will have `type` set to `'linear'` by default, guaranteeing the existing experience is not altered.

*   **Introduce the `Choice` entity:**
    *   A new `Choice` entity will be created to represent choice-based transitions between scenes.
    *   **The `Choice` entity's fields:**
        *   `id` (ULID)
        *   `sceneId` (ULID, an FK to the `Scene` where the choice is presented)
        *   `text` (string, the choice's text, e.g. "Turn left")
        *   `nextSceneId` (ULID, an FK to the `Scene` this choice leads to)
        *   `createdAt`, `updatedAt`

### 2. Backend logic (API)

*   **Conditional `Choice` management:**
    *   **For `linear` stories:** no `Choice` ever exists - the order is only the `Scene`'s `index` within the chapter. The API rejects any attempt to create/update/delete a `Choice` through sync while the story is `linear` (`ChoiceSyncHandler`).
    *   **For `branching` stories:** `Choice` objects will be created, updated and deleted explicitly by users through the API.
    *   **Conversion between the two:** done by the user (not automatically) - see `StoryService.convertStoryType`/`checkLinearCompatibility` in `apps/client/src/services/storymanagement/storyTypeConversion.ts` and section 2.3 of `docs/choice_mechanics.md`.

### 3. Frontend experience

*   **Story settings:** the user will be able to select the story's `type` (`linear` or `branching`) when creating a new story or in the story's settings.

*   **Preserving the linear experience:**
    *   When `Story.type` is `linear`, the existing user interface for creating/editing chapters and scenes will remain unchanged.
    *   The `index` field will carry on guiding the display order and implicit navigation.
    *   Implicit `Choice`s will exist in the data, but will not be exposed or directly editable in the linear UI.

*   **The new branching experience:**
    *   When `Story.type` is `branching`, a new user interface will be activated.
    *   This UI will let users explicitly define the choices for each scene (the choice's text and the target scene).
    *   A graph visualization tool may be implemented to display scenes as nodes and explicit `Choice`s as directed edges, visually representing the branching narrative.

## Benefits of this approach

*   **Backward compatibility:** existing and new linear stories will carry on working as before.
*   **A clear separation:** the `Story.type` field lets the backend and frontend logic adapt to the kind of narrative.
*   **A universal underlying graph:** every story, including linear ones, will have a graph representation, making future features such as visualization or type conversion easier.
*   **No game logic:** the focus stays on organizing and visualizing data, without the complexity of game states or choice conditions.

This approach allows a gradual introduction of branching narratives, starting with the changes to the data model and API, and later developing the specific user interfaces for creating and visualizing branching stories.
