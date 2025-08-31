# Keres - Project Context for Gemini CLI

This document provides essential context for the Keres project, a Story Organizer application, to facilitate effective interaction with the Gemini CLI.

## Project Overview

Keres is a self-hosted and/or offline application designed for organizing stories, catering to both solo and collaborative writing efforts. Its primary goal is to offer a robust and intuitive tool for writers, enabling them to manage all aspects of their narratives, from characters and locations to scene structures and world-building rules. The system prioritizes efficient content organization and ease of use.

**Key Technologies:**
- **Backend:** Hono (for routes/validation), Zod (for validation), Drizzle ORM (for persistence), ULID (for identifiers).
- **Frontend:** React Native, Expo, and React Native Web for a unified codebase across web and mobile.

## Building and Running

As of now, specific build and run commands are not yet defined for all components. However, testing commands are now available:

- **`bun run test`**: Runs all tests using Vitest.
- **`bun run coverage`**: Runs all tests and generates a test coverage report using Vitest.

The project structure outlined in `docs/project_plan.md` suggests a monorepo setup with `apps/api`, `apps/client`, and `packages/` directories, implying that build and run commands will likely be defined within these sub-projects or at the monorepo root once development progresses.

**TODO:** Define and document the primary build and run commands for the project components (API, Client, etc.) once they are established.

## Development Conventions

Based on the `docs/project_plan.md`, the project adheres to the following conventions and architectural patterns:

- **Monorepo Structure:** Organized into `apps/` (for distinct applications like API, client) and `packages/` (for shared code, database schemas, and configurations).
- **API Development:** Utilizes Hono for REST/JSON routes, Zod for input/output validation, Drizzle ORM for database interactions, and ULID for unique identifiers.
- **Frontend Development:** Utilizes React Native, Expo, and React Native Web for a unified codebase across web and mobile platforms, with a focus on offline capabilities via local SQLite and future synchronization with the online API.

## Data Modeling

- **Dynamic Story Structures:** The project plans to support both linear and branching (interactive fiction/CYOA) narrative structures. This involves introducing a `Choice` entity and a `type` flag for `Story` entities, allowing for flexible story representation without disrupting the existing linear flow. More details can be found in `docs/dynamic_story_structure.md`.
- Employs a detailed data schema with ULID primary keys, including fields for `is_favorite`, `extra_notes`, `created_at`, and `updated_at` across most entities to support user preferences and tracking.
- Customizable Lists (Enumerators): A flexible system for managing predefined and user-customizable lists (e.g., genres, races, genders) with support for both global and story-specific scopes.
- **Testing:** Uses Vitest as the testing framework, with test files typically located in a `tests/` directory at the root, or within individual app/package directories.

## Next Steps (from `docs/project_plan.md`)

- Define migrations in `packages/db` (Drizzle).
- Create Zod contracts in `packages/shared`.
- Implement base CRUD routes (users, stories, characters).
- Add support for JSON export/import.