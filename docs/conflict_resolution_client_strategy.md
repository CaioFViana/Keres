# Synchronization and conflict resolution

A document of the **current** behaviour (`SyncService` / `SyncEngineService` / `SyncConflictService`). It is not a plan: what is here is what the code does.

## Overview

Every synchronizable entity has a `version` (optimistic concurrency on the *row*, not on the log). Every local write becomes a row in the operation log. The sync cycle:

1. **Pull** the server's operations since the cursor (`lastServerSyncedLog`).
2. Apply the remote ones, silently merging fields that do not clash with pending local edits.
3. **Push** the local operations not yet accepted.
4. Transfer media after the metadata.

The server is the source of truth. The log only retransmits what the handler actually wrote, not the client's raw JSON.

## Roles

| Role | May write content | May delete the story / change the owner, `type`, `favoriteBehavior`, `allowReaderComments` |
|---|---|---|
| `owner` | yes | yes |
| `writer` | yes | no |
| `reader` | only their own `Favorite` and, if the story allows it, their own `Comment` | no |

A `Story` create with an id different from the URL's is refused. Transplanting an entity (`changes.storyId` / `userId`) is refused.

## Protocol

Routes authenticated by JWT: `POST /sync/:storyId`, `GET /sync/:storyId/pull`, `GET /sync/pullpreviews`.

The common envelope: `type`, `entity`, `id` (a ULID; required on create/update/delete/reorder), the *entity's* `version`, `operationTime` (ISO), `clientOperationId` (the local id, echoed in the response).

| Type | Extra fields | OCC base |
|---|---|---|
| `create` | `data` | — (a new id; resending the same id with the same data is idempotent) |
| `update` | `changes` **with `changes.version` required** | `changes.version` is the base the client read, not the envelope's |
| `delete` | — | `version` in the envelope. Required for child entities. The owner may omit it when deleting their *own* Story (`deleteStory` / `unlinkFromServer`); the server fills in the current version |
| `reorder` | `reorderItems` (`id` + 1-based `newIndex`) | The Story's `version` (chapters / attributes) or the Chapter's (scenes) |

Omitting `changes.version` on an update does **not** become last-write-wins: the schema answers 422 and the whole batch is refused. The client engine derives the base as `payload.version - 1` (the local log stores the *resulting* version).

Limits: a push carries at most 200 operations per POST (`MAX_SYNC_BATCH_SIZE`); a pull at most 500 per page (`MAX_SYNC_PULL_BATCH`). Rate limit ~120 req/min per user.

## Server

`SyncService.processAndRecordUpdates` applies the batch **operation by operation**, not all-or-nothing. Each entity write and the log row run in the same transaction. The `stories.lastOperationVersion` counter is incremented atomically.

OCC compares the base for **equality** with the current version (`checkVersionConflict`). The `UPDATE` / tombstone also uses `WHERE version = :base`. With no base (except a Story delete by the owner) the operation is refused with `validation`.

The push's response: `applied[]` + `conflicts[]`. Only the accepted ones should be marked `isSynced` on the client. Later operations on the same entity within the same batch, after a conflict, are blocked (`blockedEntities`).

The payload written to the log is the sanitized one (identity/`version`/`storyId`/`userId` fields do not travel). The pull rebuilds the `StoryUpdate` from that payload + the log's metadata (`entityVersion`, `originatingUser`).

Media: a Gallery create/update with a hash **already existing in storage** only passes if this story already references it. A hash that does not exist yet is new media whose upload comes later.

## Client

`SyncEngineService.performSync`:

- Story policy mutations (`type`, `favoriteBehavior`, `allowReaderComments`) and the story's delete/unlink are refused locally if the role is not `owner` (`assertStoryIsOwned` / `StoryService.updateStory` / `convertStoryType`), so as not to queue a push the server would refuse forever. A writer can still edit content.
- The pull runs in pages until the response comes back incomplete. The cursor only advances to the last **applied** operation. A failure in the middle of a page does **not** skip the operation: the cycle stops on it.
- The timer and `requestSync` (websocket / a local write) share the same lock; the cycles do not overlap.
- The push slices the queue into blocks of 200, in `operationVersion` order. After each block it processes `applied`/`conflicts` before the next, so as not to resend what the server refused. With no progress in the batch, it stops.
- A local update with no `version` in the payload is skipped (it does not poison the batch).

### Automatic merge vs. the conflict screen

Bookkeeping fields (`id`, `storyId`, `version`, timestamps) never enter the comparison.

- **Disjoint fields:** the side that does not clash is applied; the local operation is rebased on the new version and goes in the next push without asking. It applies both on the pull and in the `version_conflict` response when the server sends `changedFields`.
- **The same field, different values:** a `concurrent_edit` conflict. The banner on the dashboard opens the review sheet (`SyncConflictService`).
- **Deletion vs. edit:** it is not "deletion always wins". The user chooses to restore, to accept the deletion, or to keep the local delete (resent over the server's current version).
- **Reorder:** the whole order is the value in dispute, not a scalar field. "Keep mine" only updates the base of the pending reorder operation.

Options in the UI: keep the local one, keep the server's, merge field by field, restore, postpone. A pending conflict takes those operations out of the push queue; the rest of the story carries on synchronizing.

## What is no longer true

Old documents and comments spoke of last-write-wins by `updated_at`, an all-or-nothing batch, a `clientVersion < serverVersion` comparison, and "omitting the version turns OCC off". None of that holds. Nor does a deletion automatically beat a concurrent edit.

## Reference code

- Server: `apps/api/src/services/SyncService.ts`, `apps/api/src/services/entity-sync-handlers/BaseSyncEntityHandler.ts`, `apps/api/src/modules/sync/sync.route.ts`
- Client: `apps/client/src/services/SyncEngineService.ts`, `apps/client/src/services/SyncConflictService.ts`, `apps/client/src/utils/syncUtils.ts`
- Contract: `packages/shared/schemas/SyncSchemas.ts`
