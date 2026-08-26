# Choice mechanics in Keres

This document details how Choices are implemented and managed in the Keres system, distinguishing between linear and branching stories.

## 1. The `Choice` entity

The `Choice` entity is fundamental for defining transitions between scenes in a story. Its main fields are:

*   **`id`**: The choice's unique identifier.
*   **`sceneId`**: The id of the source scene, that is, the scene where the choice is presented to the reader.
*   **`nextSceneId`**: The id of the target scene, where the reader is taken after making this choice.
*   **`text`**: The text describing the choice (e.g. "Turn left into the forest").
*   **`createdAt`, `updatedAt`**: Creation and last-update timestamps.

In the current implementation, choices always connect **scenes** to one another. There is no smaller "moment" entity inside a scene that could be the source or target of a choice.

## 2. Story types and choice management

The `type` field on the `Story` entity (`'linear'` or `'branching'`) determines how choices are handled by the system.

### 2.1. Linear stories (`Story.type = 'linear'`)

In linear stories the narrative flow is sequential and no `Choice` row ever exists. Navigation is dictated entirely by the scenes' `index` within each chapter (`SceneService.getPreviousNextScenes`), with no explicit edge connecting them.

### 2.2. Branching stories (`Story.type = 'branching'`)

In branching stories (Interactive Fiction/CYOA), the author has full control over the choices, allowing multiple narrative paths.

*   Users create, update and delete choices explicitly through the API and the user interface.
*   Each choice defines a text and a target scene, allowing one scene to have multiple exits.
*   Navigation is not dictated by the scenes' `index`, but by the choices the author defined.

### 2.3. Conversion between the two types

A story's type can be converted by the user themselves (the Story Settings screen), implemented in `StoryService.convertStoryType`/`checkLinearCompatibility` (`apps/client/src/services/storymanagement/storyTypeConversion.ts`):

*   **Linear -> Branching**: always allowed. An explicit choice is generated for each pair of consecutive scenes (by `index`, within each chapter), including a "bridge" choice between a chapter's last scene and the next chapter's first - it is what preserves the sequence between chapters as explicit, editable data.
*   **Branching -> Linear**: only when the choice graph is compatible with a simple sequence - no forks (more than one choice leaving the same scene), no convergences (more than one choice arriving at the same scene), no cycles, no scenes disconnected from the rest of the chapter, and no chapter-crossing choices outside the "last scene of chapter M -> first scene of chapter M+1" pattern. When compatible, the scenes are reindexed following the chain found and every choice in the story is deleted.

## 3. Connection between scenes and implications

At present, every choice (implicit or explicit) connects a `sceneId` to a `nextSceneId`. That means the branching granularity happens at the scene level.
