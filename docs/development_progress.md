# Keres - Development Progress Log

This document tracks the ongoing development progress of the Keres project, detailing completed tasks and the next planned steps.

## Current Status

*   **Database Schema:** Updated to support dynamic story structures (added `type` to `story` table, introduced `choices` table). Drizzle migrations generated and applied. `World Rules` schema added and migrated. `Notes` schema added and migrated. `Tags` schema added and migrated. `Listas Customizáveis (Suggestions)` schema added and migrated.
*   **Dynamic Story Structures:**
    *   `Choice` entity (domain, repository, use cases, controller, routes) implemented.
    *   `Story` use cases (`CreateStoryUseCase`, `UpdateStoryUseCase`) updated to handle the `type` field.
    *   `Scene` use cases (`CreateSceneUseCase`, `UpdateSceneUseCase`, `DeleteSceneUseCase`) updated to manage implicit choices for linear stories.
*   **Project Configuration:** Root `package.json` scripts updated for Drizzle commands (`db:generate`, `db:migrate`, `db:push`, `db:studio`). `packages/shared` configured for proper compilation and module resolution.
*   **Moment Entity CRUD:** Full CRUD operations (repository, use cases, controller, routes) implemented and integrated.
*   **World Rules Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Notes Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Tags Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Listas Customizáveis (Suggestions) Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.
*   **Authentication and Authorization:** Implemented JWT-based authentication, including token generation on login, and a middleware for protecting API routes.
*   **Frontend Integration:**
    *   Initial setup: Added `axios` for API calls, created a basic API client, and implemented a login form in `App.tsx` to demonstrate authentication.
    *   Story Management: Implemented `StoryListScreen.tsx` for displaying, creating, updating, and deleting stories. Integrated into `App.tsx` after successful login.
    *   Character Management: Implemented `CharacterListScreen.tsx` for displaying, creating, updating, and deleting characters. Integrated into `StoryListScreen.tsx` for navigation.
*   **Backend Refactoring:** Refactored `apps/api/src/application/use-cases/` to organize use case files into entity-specific subfolders for better modularity and maintainability.
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
