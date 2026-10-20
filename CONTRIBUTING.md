# Contributing to Keres

This is the short path from "I want to change something" to "the change is safe to merge". Setup and the commands that run each part are in the [README](README.md#quick-start); the architecture is in [`docs/structure/`](docs/structure/).

## What kind of change is it?

| If you are... | Read first | Risk |
| --- | --- | --- |
| Fixing a text, a translation or a help page | `apps/client/src/locales/`, `apps/client/src/content/help/`; run `bun run locales:audit` | Low. Both languages must carry the same keys. |
| Changing how a screen looks or lays out | [`docs/structure/screen_flow.md`](docs/structure/screen_flow.md), [`docs/structure/file_structure.md`](docs/structure/file_structure.md) | Low. Screens never talk to the database or the network directly. |
| Changing a rule (counting, layout maths, validation) in `packages/shared` | The test next to the rule | Medium. The client and the server both run it. |
| Adding a field or a whole entity | [`docs/procedures/adding_an_entity.md`](docs/procedures/adding_an_entity.md) | High. It touches the contract, the server, the device, sync and export. |
| Touching sync, conflicts or the operation log | [`docs/structure/conflict_resolution_client_strategy.md`](docs/structure/conflict_resolution_client_strategy.md) and [`docs/structure/sync-failure-modes.md`](docs/structure/sync-failure-modes.md) | Highest. This is the only code that can lose a writer's work on a machine nobody is looking at. Ask before starting. |
| Cutting a release | [`docs/procedures/release_process.md`](docs/procedures/release_process.md) | The version numbers in `ReleaseVersions.ts` move only here. |

The product's boundaries (what Keres will not become) are in [`docs/product/FEATURE_LANDSCAPE.md`](docs/product/FEATURE_LANDSCAPE.md); the code-grounded map of what exists is [`docs/product/feature_inventory.md`](docs/product/feature_inventory.md).

## Where things live

[`docs/structure/file_structure.md`](docs/structure/file_structure.md) has the full rules. In short:

- `packages/shared` - the contract both sides agree on: entities, Zod schemas, pure rules and engines. No app imports here, and no framework.
- `apps/api` - the server. Routes in `src/modules`, logic in `src/services`, sync handlers in `src/services/entity-sync-handlers`.
- `apps/client` - the app. Screens call hooks; hooks call services; services own the database and the log. A screen does not import another screen.
- `apps/admin`, `apps/site`, `apps/desktop` - the admin panel and showcase, the landing page, the Electron shell.

Folders are `kebab-case`, imports use the aliases (`@/src/...`), never `../`, and a file stays under 600 lines of code. These are enforced by tests, not by taste.

## How to work

1. Make the change in small steps; keep one idea per commit.
2. Run what your change touches, then the whole check before you push:

   ```bash
   bun run typecheck
   bun run lint
   bun run check          # formatting and static checks (Biome)
   bun run test:report    # every suite, coverage floors, a summary per workspace
   ```

   On a small machine run one workspace at a time (`bun run --cwd apps/client test`); the client suite is already limited to two workers.
3. Read a failing architecture test as a message: its name says what you forgot (see the table in [`docs/procedures/adding_an_entity.md`](docs/procedures/adding_an_entity.md)). Do not weaken a test to make it pass; coverage floors only go up ([`docs/structure/testing.md`](docs/structure/testing.md)).
4. Commit messages are one short line with an area prefix: `(APP)`, `(API)`, `(SHRD)` for the shared package, `(ADMIN)`, `(SITE)`, `(DESKTOP)`, `(DOCS)`, `(REPO)` for tooling. Combine areas with a slash when a change really spans two (`(APP/API)`).
5. Update the document that describes what you changed in the same commit. A document that disagrees with the code is worse than none.

## Rules that are easy to break

- **Never write to a story table outside its service.** The service records the operation that makes the change reach the server; a row written around it is a sync bug nobody sees.
- **Deleting is a tombstone**, not a `DELETE`.
- **Do not log with `console`.** Use `logger` from `@/src/utils/logging/logger`.
- **Events are typed.** A new event goes in `apps/client/src/state/events/entityEvents.ts` before it can be emitted or listened to.
- **Do not change `ReleaseVersions.ts`** outside a release.
- **Code, comments, tests and documents are in English.** The app's texts exist in English and Portuguese.
- **Licence:** MPL-2.0 (see `LICENSE`).
