# Keres - Development Progress Log

This document tracks the ongoing development progress of the Keres project, detailing completed tasks and the next planned steps.

## Current Status

*   **Database Schema:** Updated to support dynamic story structures (added `type` to `story` table, introduced `choices` table). Drizzle migrations generated and applied. `World Rules` schema added and migrated.
*   **Dynamic Story Structures:**
    *   `Choice` entity (domain, repository, use cases, controller, routes) implemented.
    *   `Story` use cases (`CreateStoryUseCase`, `UpdateStoryUseCase`) updated to handle the `type` field.
    *   `Scene` use cases (`CreateSceneUseCase`, `UpdateSceneUseCase`, `DeleteSceneUseCase`) updated to manage implicit choices for linear stories.
*   **Project Configuration:** Root `package.json` scripts updated for Drizzle commands (`db:generate`, `db:migrate`, `db:push`, `db:studio`). `packages/shared` configured for proper compilation and module resolution.
*   **Moment Entity CRUD:** Full CRUD operations (repository, use cases, controller, routes) implemented and integrated.
*   **World Rules Entity CRUD:** Full CRUD operations (schema, domain, repository, use cases, controller, routes) implemented and integrated.

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
*   **CharacterRelation:** Complete.
*   **Choice:** Complete (implemented in this session).
*   **World Rules:** Complete.

### Entities with Schema Defined in `docs/project_plan.md` but NOT YET IMPLEMENTED in `packages/db/src/schema.ts` (and thus no CRUD):

*   **Notes:** Schema defined in `docs/project_plan.md`, but not yet in `packages/db/src/schema.ts`.
*   **Tags:** Schema defined in `docs/project_plan.md`, but not yet in `packages/db/src/schema.ts`.
*   **Listas Customizáveis (Suggestions):** Schema defined in `docs/project_plan.md`, but not yet in `packages/db/src/schema.ts`.

## Next Task

*   [To be determined]
