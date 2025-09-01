# Keres - Development Progress Log

This document tracks the ongoing development progress of the Keres project, detailing completed tasks and the next planned steps.

## Current Status

*   **Database Schema:** Updated to support dynamic story structures (added `type` to `story` table, introduced `choices` table). Drizzle migrations generated and applied. `World Rules` schema added and migrated. `Notes` schema added and migrated. `Tags` schema added and migrated. `Listas Customizáveis (Suggestions)` schema added and migrated.
*   **Dynamic Story Structures:**
    *   `Choice` entity (domain, repository, use cases, controller, routes) implemented.
    *   `Story` use cases (`CreateStoryUseCase`, `UpdateStoryUseCase`) updated to handle the `type` field.
    *   `Scene` use cases (`CreateSceneUseCase`, `UpdateSceneUseCase`, `DeleteSceneUseCase`) updated to manage implicit choices for linear stories.
*   **Project Configuration:** Root `package.json` scripts updated for Drizzle commands (`db:generate`, `db:migrate`, `db:push`, `db:studio`). `packages/shared` configured for proper compilation and module resolution.
*   **API Documentation:** Configured Swagger UI and OpenAPI JSON endpoint to be publicly accessible without authentication.
*   **Moment Entity CRUD:** Full CRUD operations (repository, use cases, controller, routes) implemented and integrated.
*   **World Rules Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Notes Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Tags Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Listas Customizáveis (Suggestions) Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Authentication and Authorization:** Implemented JWT-based authentication, including token generation on login, and a middleware for protecting API routes.
*   **Frontend Integration:**
    *   Initial setup: Added `axios` for API calls, created a basic API client, and implemented a login form in `App.tsx` to demonstrate authentication.
    *   **Navigation System:** Implemented React Navigation (`@react-navigation/native`, `@react-navigation/stack`) to manage screen navigation. All entity list screens are now integrated into a stack navigator.
    *   **UI Library:** Integrated React Native Paper for improved UI/UX.
    *   **UI/UX Improvements:** Applied React Native Paper components (e.g., `Button`, `TextInput`) to `StoryListScreen.tsx`, `App.tsx` (login form), `CharacterMomentListScreen.tsx`, `CharacterRelationListScreen.tsx`, and `RelationListScreen.tsx` for a more consistent and modern look.
    *   Story Management: Implemented `StoryListScreen.tsx` for displaying, creating, updating, and deleting stories. Integrated into the navigation stack.
    *   Character Management: Implemented `CharacterListScreen.tsx` for displaying, creating, updating, and deleting characters. Integrated into the navigation stack.
    *   Chapter Management: Implemented `ChapterListScreen.tsx` for displaying, creating, updating, and deleting chapters. Integrated into the navigation stack.
    *   Scene Management: Implemented `SceneListScreen.tsx` for displaying, creating, updating, and deleting scenes. Integrated into the navigation stack.
    *   Moment Management: Implemented `MomentListScreen.tsx` for displaying, creating, updating, and deleting moments. Integrated into the navigation stack.
    *   Location Management: Implemented `LocationListScreen.tsx` for displaying, creating, updating, and deleting locations. Integrated into the navigation stack.
    *   Gallery Management: Implemented `GalleryListScreen.tsx` for displaying, creating, updating, and deleting galleries. Integrated into the navigation stack.
    *   Note Management: Implemented `NoteListScreen.tsx` for displaying, creating, updating, and deleting notes. Integrated into the navigation stack.
    *   Tag Management: Implemented `TagListScreen.tsx` for displaying, creating, updating, and deleting tags. Integrated into the navigation stack.
    *   World Rule Management: Implemented `WorldRuleListScreen.tsx` for displaying, creating, updating, and deleting world rules. Integrated into the navigation stack.
    *   Suggestion Management: Implemented `SuggestionListScreen.tsx` for displaying, creating, updating, and deleting suggestions. Integrated into the navigation stack.
    *   Character Moment Management: Implemented `CharacterMomentListScreen.tsx` for displaying, creating, updating, and deleting character moments. Integrated into the navigation stack.
    *   Character Relation Management: Implemented `CharacterRelationListScreen.tsx` for displaying, creating, updating, and deleting character relations. Integrated into the navigation stack.
    *   Relation Management: Implemented `RelationListScreen.tsx` for displaying, creating, updating, and deleting relations. Integrated into the navigation stack.
*   **Backend Refactoring:** Refactored `apps/api/src/application/use-cases/` to organize use case files into entity-specific subfolders for better modularity and maintainability.

## CRUD Audit Report

Below is the audit status for core entities, indicating whether their CRUD (Create, Read, Update, Delete) implementation is complete across Repository, Use Cases, Controller, and Routes.

### Entities with Complete CRUD Implementation:

*   **User:** (Assumed complete from project plan, not audited in detail)
*   **Story:** Complete (including new `type` field).
*   **Character:** Complete.
*   **Chapter:** Complete.
*   **Scene:** Complete (including implicit choice logic).
*   **Moment:** Complete.
*   **Location:** Complete.
*   **Gallery:** Complete.
*   **Relation:** Complete.
*   **CharacterMoment:** Complete (for join table operations).
*   **CharacterRelation:** Complete (for join table operations).
*   **Choice:** Complete (implemented in this session).
*   **World Rules:** Complete.
*   **Notes:** Complete.
*   **Tags:** Complete.
*   **Listas Customizáveis (Suggestions):** Complete.

### Entities with Schema Defined in `docs/project_plan.md` but NOT YET IMPLEMENTED in `packages/db/src/schema.ts` (and thus no CRUD):

*   [All entities implemented]

## Next Task

*   All entities defined in `docs/project_plan.md` have been implemented.
*   Next steps will involve integrating these APIs with the frontend, and implementing authentication/authorization.
