# Gemini's Project Context for Keres

This document summarizes the current understanding of the Keres project, including its goals, architecture, and specific implementation details, as learned by Gemini.

## 1. Project Overview

Keres is an offline-first story organizer designed for solo or collaborative writing. It aims to provide a robust and intuitive tool for writers to organize all aspects of their narratives, from characters and locations to scene structure and world rules. Key features include intelligent synchronization between local devices and a remote server.

The project supports both linear and branching (Interactive Fiction/CYOA) story structures, managed by a `type` field on the `Story` entity and a dedicated `Choice` entity.

## 2. Monorepo Structure

The project is organized as a monorepo with the following structure:

```
keres-monorepo/
├── apps/
│   ├── api/        # Backend API (Elysia/Bun)
│   └── client/     # Frontend (React Native/Expo)
├── packages/
│   ├── shared/     # Shared types, utilities, Zod contracts, and entities
│   ├── db/         # Drizzle ORM schema and migrations
│   └── config/     # Common configurations
├── docker-compose.yml
├── package.json
└── README.md
```

## 3. Key Entities & Concepts

All persistent entities include a `version: number;` field crucial for conflict detection and resolution during synchronization.

*   **Story:** Main entity, includes `type: 'linear' | 'branching'`.
*   **Choice:** Represents transitions between scenes.
    *   `isImplicit: true` for system-generated choices in linear stories.
    *   `isImplicit: false` for user-defined choices in branching stories.
*   **Chapter & Scene:** `index` field maintained for linear story ordering; serves as an organizational tool for branching stories.
*   **User:** Supports multiple logins, each user can have multiple stories.
*   **Characters, Gallery, Locations, World Rules, Notes, Tags, Suggestions:** Other core entities for story organization.
*   **Relational Tables:** Character X Scene, Character X Character.

## 4. Client Architecture (Offline-First)

The client is built with React Native/Expo for a unified codebase across mobile and web, operating offline-first with a local SQLite database and synchronizing with a remote API.

### Proposed Architecture Layers:

*   **Presentation Layer (UI/Views):** React Native Components & Screens, React Navigation.
*   **Application Layer (State Management & Business Logic):** Zustand for global state, Use Cases/Services for business logic.
*   **Data Layer:**
    *   **Local Database:** SQLite (via `expo-sqlite`) for primary data persistence, managed by a custom synchronization engine.
    *   **API Client:** Axios for remote API communication.
    *   **Synchronization Engine:** A critical component for:
        *   Tracking local changes.
        *   Queueing operations for sync.
        *   Handling network status.
        *   Optimistic UI updates.
        *   Conflict resolution (using `version` field).
        *   Fetching and applying remote updates.
*   **Shared Layer (`@keres/shared`):** Entities, Zod Schemas, common utilities.

### Current Client Setup:

*   Expo project scaffolded in `apps/client`.
*   Dependencies installed: `zustand`, `axios`, `expo-sqlite`.
*   `@keres/shared` linked as a workspace dependency.
*   `apps/client/src` directory created with subdirectories: `navigation`, `screens`, `components`, `state`, `data/local`, `data/remote`, `sync`, `services`, `utils`.
*   Existing `components` and `hooks` from Expo's default scaffold moved into `apps/client/src/components` and `apps/client/src/hooks` respectively.
*   `apps/client/tsconfig.json` updated with path aliases:
    *   `@/*`: `./src/*`
    *   `@keres/shared`: `../../packages/shared`

## 5. Backend (API) Overview

The backend (`apps/api`) will use:
*   **Elysia (Bun):** For REST/JSON routes.
*   **Zod:** For input/output validation.
*   **Drizzle ORM:** For database persistence.
*   **ULID:** For unique identifiers.
*   **Synchronization Engine:** An operation-based replication engine.

## 6. Synchronization Strategy

*   **Offline-First:** All user interactions and changes are first persisted to the local database.
*   **Change Tracking:** The sync engine monitors local DB for pending operations.
*   **Online Sync:** When online, pending operations are uploaded to the backend, and then updates are downloaded from the server.
*   **Conflict Resolution:** The `updated_at` timestamp will be the primary field for Last-Write-Wins (LWW) conflict resolution. The `version` field, managed by the server, will be used to ensure sequential updates and detect outdated client data.

### Detailed Synchronization Mechanism

1.  **Format of Operations (`StoryUpdates`):** Operations will be defined as JSON objects describing the change.
    *   `{"type": "create", "entity": "EntityName", "data": {...}}`
    *   `{"type": "update", "entity": "EntityName", "id": "ulid", "changes": {"field": "new_value"}}`
    *   `{"type": "delete", "entity": "EntityName", "id": "ulid"}`
2.  **Mechanism for Change Tracking:** The client-side ORM (or custom database layer) will intercept all create, update, and delete operations. For each operation, it will generate a `StoryUpdate` record (as defined above) and store it in a local "operations log" table. This log will be the source for synchronization.
3.  **Communication Protocol:** WebSockets will be used for real-time notifications of changes. A REST API will be used for pulling and pushing information, allowing for manual requests for changes.
4.  **Authentication and Authorization:** JWT (JSON Web Tokens) will be used for authentication. The server administrator will register clients, and clients will receive either an API key or use login/password to obtain a JWT and a refresh token.
5.  **Initial Synchronization (Bootstrapping):** The system will support an import/export function for stories as JSON. The server can send an entire story at once. Story tables are agnostic to user IDs and use ULIDs for universal uniqueness.
6.  **Logic for Merging Different Fields:** For changes to different fields within the same entity, all non-conflicting changes from both sides will be applied. If a conflict occurs on the *same* field, the Last-Write-Wins (LWW) strategy (based on the `updated_at` timestamp) will be applied.
7.  **Management of "Last 500 Updates":** A dedicated "operations log" table will store updates. For offline stories, when the number of entries exceeds 500, the oldest entries will be deleted. This can be determined using `ROW_NUMBER()` ordered by `updated_at` in descending order.
8.  **Error Handling and Retries:** Each synchronization operation sent will be treated as a transaction. If not all operations from the server are successfully processed, no changes will be applied (all or nothing).
9.  **Integration of Custom Local Database:** The `packages/shared/entities` directory contains the initial, idealized mapping of tables. The custom local database implementation will adhere to these entity definitions.
10. **Complex Conflict Detection:** If a field has been updated recently (e.g., within a few hours), a notification will be displayed on the screen to inform the user of the recent change.

## 7. Development Environment & Tools

*   **Package Manager:** Bun (used for both client and backend).
*   **Database:** PostgreSQL for the server, SQLite for the client.
*   **Environment Variables:** `.env` files for `DATABASE_URL` and `JWT_SECRET` (different values for server and client).
*   **Docker:** `docker-compose.yml` for setting up a PostgreSQL database.
