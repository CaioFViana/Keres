# Sync failure modes

Checklist of how the sync handles each failure mode: expected behavior plus the
test file that covers it. Paths are relative to the repo root.

## Failure modes

1. **Invalid local payload (update/delete without a version, unparseable JSON,
   unknown op shape)** — `SyncPush` quarantines the operation as a visible
   `validation` conflict the user can discard, instead of skipping it in silence
   (the edit would sit unsynced forever) or aborting the whole push. One bad row
   never blocks the valid ones. The quarantine carries no server snapshot, so
   resolving it discards the operation and leaves the row untouched at its
   version (a discarded local delete restores live flags) — never a resend of
   the unpushable payload, never a deletion. Folded into a pending real conflict,
   the quarantine contributes only its operation ids and local values: the stored
   reason and snapshot stay, so the decidable conflict is never demoted into a
   discard. Dismissing follows the same restore rule as resolving. Tests:
   `apps/client/test/services/SyncPushHardening.test.ts`
   (`turns an update without a version into a visible conflict and takes it out of
   the queue`,
   `quarantines a corrupted payload without aborting the push of the rest`),
   `apps/client/test/services/SyncConflictService.test.ts`
   (`validation quarantine without a server snapshot`,
   `folding a validation quarantine into a pending conflict`).
   Area: push + conflicts.

2. **Lost push response (server applied it, the reply never arrived)** — the op
   stays unsynced and is resent; the server recognizes the `clientOperationId`
   and answers with the ORIGINAL operation version (never the current max), so
   the client's echo check keys on the right row. No false `version_conflict`,
   no duplicate application, no new log rows. Tests:
   `apps/api/test/modules/sync.idempotency.integration.test.ts`
   (`answers a resent update with its original versions instead of a false
   conflict`), `apps/client/test/services/SyncPush.test.ts`
   (`keeps operations pending when the push response is lost, and lands them on
   resend`). Area: server + push.

3. **Throwing apply handler (corrupt/invalid remote payload)** — the engine
   retries the op on the next cycles (transients recover), and after 3
   consecutive failures retires it (recorded, cursor
   advanced) while still reporting it — a poisoned op never stalls the story's
   pull forever. While the batch is stopped the cycle reports `failed`, so a
   stuck pull never looks healthy. One consolidated `remoteUpdatesFailed`
   notification per cycle.
   Tests: `apps/client/test/services/SyncEngineHardening.test.ts`
   (`retries a failing operation, then skips past it on the third failure and keeps
   the batch moving`,
   `recovers when a transient failure stops before the third attempt`).
   Area: engine (`SyncPullApply`).

4. **Unknown entity or operation type (server newer than the app)** — no registered
   handler, or a type this build cannot interpret, means the pull stays blocked with
   a loud `protocolMismatch` notification rather than skipping ops the cursor would
   lose forever, and the cycle reports `failed` until an upgrade unblocks it. Tests:
   `SyncEngineService.test.ts`
   (`treats an entity it cannot store as a protocol mismatch, still blocking the pull`,
   `blocks the pull loudly on an update type it does not know`).
   Area: engine.

5. **Pull 500 / reachable-server failure** — contained and reported (`syncFailed`),
   never mistaken for offline — and it no longer vetoes the push: local work
   still uploads in the same cycle. The scheduler backs off instead of
   fast-retrying. Tests: `SyncEngineService.test.ts`
   (`reports a reachable-server pull failure instead of treating it as offline`),
   `SyncEngineHardening.test.ts`
   (`still pushes local work when the pull itself fails with a server error`),
   `SyncScheduler.test.ts` (backoff). Area: engine + scheduler.

6. **Offline (server unreachable)** — expected in an offline-first app: no user
   notification, fast 5s retry cadence. Tests: `SyncEngineService.test.ts`
   (`reports being offline, so the caller retries sooner`), `SyncScheduler.test.ts`
   (offline cadence). Area: engine + scheduler.

7. **Refused op resent forever** — ops with a pending conflict (`conflictState` set) are
   excluded from the pushable queue, and the chunk loop stops when a round makes no queue
   progress. Tests: `SyncPush.test.ts`
   (`stops when a valid response makes no queue progress`,
   `folds multiple refused operations of one entity into one decision`). Area: push.

8. **Sequence race (push order / pull cursor)** — local writers sequence
   `operationVersion` under a per-story mutex and the database enforces
   uniqueness per story, so concurrent writes can neither duplicate a version
   nor push dependent creates out of order (a deterministic `id` tiebreak
   covers legacy ties). Recorded remote ops take numbers from the same local
   counter — the column holds one sequence per story; the server's number lives
   in `serverOperationVersion`, so the two independent counters can never
   collide. The pull marker advances only to the highest operation actually
   received, never to `serverMaxOperationVersion` (read in a separate server
   query). Tests: `test/services/opLogMutex.test.ts` (concurrent writes stay
   dense and unique), `SyncPull.test.ts` (`numbers recorded remote ops from the
   local counter`, `keeps one dense sequence when local writes interleave`),
   `SyncPush.test.ts`
   (`reads every unsynced operation of one entity in operation-version order, held ones included`),
   `SyncEngineService.test.ts`
   (`advances the cursor only to the highest operation it actually received`).
   Area: push / pull / engine + server (versioning contract).

9. **Recurring server error (repeated 500s)** — the scheduler applies exponential backoff
   with ±25% jitter (30s × 2^min(fails,4), cap 5min); an `ok` cycle resets the streak to
   the base interval. Test: `SyncScheduler.test.ts` (failure backoff:
   exponential growth + cap, reset on `ok`, `failedRetryDelayMs` unit tests).
   Area: scheduler.

10. **Batch ceilings** — push sends at most 200 ops per post (`MAX_SYNC_BATCH_SIZE`) for
    at most 50 chunks per cycle; pull follows at most 20 pages of 500
    (`MAX_SYNC_PULL_BATCH`), stopping at the first short page; larger backlogs span
    cycles. Hitting a ceiling with backlog left is logged (op counts), never silent.
    Tests: `SyncPush.test.ts`
    (`drains a queue longer than one batch across several rounds`), `SyncPull.test.ts`
    (`follows full pages until an incomplete one, advancing the cursor`),
    `SyncEngineService.test.ts`
    (`splits a backlog larger than the server batch cap into multiple posts`,
    `drains a remote backlog page by page before it starts pushing local work`).
    Area: push / pull.

11. **Schema migration (old server without per-operation results)** — `applyPushResult`
    keeps the legacy all-or-nothing behavior (whole batch marked applied) instead of
    stalling, stamping versions back from the batch max in batch order so echoes still
    match; a missing `changedFields` disables silent auto-merge (fail-closed to a
    visible conflict). Tests: `SyncPush.test.ts`
    (`supports legacy all-or-nothing server responses`,
    `defaults the server version to zero on a legacy response without one`,
    `stamps a legacy batch back from the max in batch order so echoes still match`),
    `SyncEngineService.test.ts`
    (`does not auto-merge when the server response has no changedFields (older server)`).
    Area: push / engine.

12. **Newer-server fields (unknown keys / local bookkeeping in remote data)** —
    `protectRemoteUpdate` strips unknown keys and client-protected columns before a
    handler sees them, so one foreign field cannot fail the apply and block the cursor.
    Test: `apps/client/test/services/syncPure.test.ts`
    (`drops unknown keys from an update so a newer server field cannot stall the pull`).
    Area: engine (shared pure helper).

13. **Version conflict with no real dispute** — when the server's `changedFields` prove
    nobody touched the client's fields, the edit auto-merges and rebases instead of
    prompting; a genuine overlap (or a server-side delete) becomes one conflict per
    entity. Tests: `SyncPush.test.ts`
    (`silently merges disjoint stale fields and rebases the local edit`,
    `records a conflict when the same field changed on both sides`),
    `SyncEngineService.test.ts` (`always opens a conflict for a deletion on the server,
    never auto-merges`). Area: push / engine.

14. **Failed Favorite op vs the public-favorites cursor** — a Favorite failure blocks
    the pull like any other op (both cursors freeze below it; after 3 consecutive
    failures it is retired like any poisoned op and the cursors advance). The
    authoritative public snapshot still reconciles collaborators' favorites on every
    cycle. Test: `SyncEngineService.test.ts`
    (`imports a changed public favorite snapshot and announces it to its target entity`).
    Area: engine.

15. **Container orders** — the protocol has none: a row's place is its own
    `rank`, moved by an update of that row. A push of a `reorder` is refused as
    an operation the protocol does not have, and nothing moves; a queued row of
    that type (a development build's) is quarantined, never sent. Tests:
    `SyncSchemas.test.ts` (`has no container order`), `syncResume.integration.test.ts`
    (`container orders`), `SyncPushHardening.test.ts` (`quarantines an operation
    the protocol does not have`). Area: protocol.

16. **Abort / stop mid-cycle** — an `AbortError` unwinds quietly with no failure
    notification and the chain stays on the healthy cadence; `cycleBinding` pins the
    in-flight cycle to its original story/server/db so a later context switch cannot mix
    work. Tests: `SyncScheduler.test.ts`
    (`treats an aborted cycle as neither failure nor offline`),
    `SyncEngineService.test.ts`
    (`does not let an abandoned cycle deactivate a different active story`).
    Area: scheduler + engine.

17. **Sync-history trim failure** — trimming synced logs past the newest 100 is
    best-effort; a trim error is logged and never fails the push that just succeeded.
    Test: none dedicated — trim itself is covered in
    `apps/client/test/services/syncUtils.test.ts`
    (`keeps the newest synced operations and drops the rest`); the swallow-on-error path
    in `SyncPush.pushPendingOperations` has no direct test. Area: push (gap).

18. **Concurrent duplicate push (two tabs, same batch)** — the idempotency key makes
    the race converge: exactly one twin appends a log row and both callers get
    success with the same original version — whether the loser arrives before or
    after the twin commits (pre-check hit, conflict-path hit, or unique-race
    fallback). Test: `sync.idempotency.integration.test.ts`
    (`applies exactly once when the same batch is pushed concurrently`).
    Area: server.

19. **Unknown operation type in pull history (legacy/future row)** — rows of a type
    the SERVER does not know are skipped with a warning carrying story/op/version;
    the rest of the page still goes out instead of failing the whole pull (and,
    previously, vetoing the push too). Types the server knows but the client does
    not are still delivered — and blocked loudly on arrival (item 4), never
    skipped. Genuinely corrupt rows of a KNOWN type still fail loudly. An unknown row
    sitting at the tip is re-fetched (and re-warned) every cycle until an upgrade
    makes it convertible: the cursor advances over delivered updates only, so it can
    never skip past the row — the refetch is the upgrade path, not a stall. Test:
    `sync.idempotency.integration.test.ts`
    (`skips the row with a warning instead of failing the page`, sqlite-only).
    Area: server.

20. **Stale conflict metadata within one pull batch** — when two remote updates hit
    the same entity with pending local edits, the recorded conflict's `clientVersion`
    is re-read from the database (an earlier update in the batch may have rebased
    the ops already). Content matching is unaffected (version is bookkeeping the
    merge ignores). Test: `SyncPushHardening.test.ts`
    (`records the rebased client version when two remote updates hit the same
    entity`). Area: pull.

21. **Merged dual-cursor page (public stories)** — the main log and the favorites
    history are separate cursors joined into one page, but the client advances a
    single max-cursor per page. The server keeps the merged page to the lowest
    batch, so the page stays prefix-closed: favorites above the main page top wait
    for the next page instead of dragging the cursor past undelivered main rows
    (which would skip them forever). The client also advances its favorites cursor
    per page, so pages never re-fetch the same favorite rows. Tests:
    `apps/api/test/modules/sync.integration.test.ts`
    (`keeps a merged page prefix-closed so the client max-cursor cannot skip main
    rows`), `apps/client/test/services/SyncPull.test.ts`
    (`advances the favorites cursor per page instead of refetching the same rows`).
    Area: server + pull.

22. **Failed quarantine write** — if recording the `validation` conflict throws
    after the op was marked conflicted, the op is released back to the pushable
    queue for the next push instead of parked out-of-queue with no conflict row to
    resolve it, and the rest of the batch still goes out. Test:
    `apps/client/test/services/SyncPush.test.ts`
    (`releases a quarantined operation back to the queue when recording the conflict
    fails`). Area: push.

23. **Apply without record (crash between the two writes)** — each remote operation's
    entity write and its op-log record commit in one transaction under the story's
    op-log lock, so a failure between them rolls the apply back instead of leaving
    a half-applied op the next launch would apply twice (each apply bumps the
    row's version). The record's own insert and counter bump are
    atomic too. Test: `apps/client/test/services/SyncEngineHardening.test.ts`
    (`rolls the apply back when the record fails, and bumps versions exactly once
    on recovery`). Area: pull.

24. **Retried board-clone resolution** — the clone commits before keepServer runs, so
    a failure between the two (or a retried tap) re-enters with the copy already
    saved. A live same-named board with byte-identical content — other than the
    conflict's own row — is that copy: the create is skipped and the keepServer
    half finishes, instead of a duplicate board per attempt. Test:
    `apps/client/test/services/SyncConflictService.test.ts`
    (`creates no second copy when the resolution is retried after the clone
    committed`). Area: conflicts.

25. **Client clock ahead of the server** — the server clamps a future
    `operationTime` to its own clock (log `createdAt`, `updatedAt`, `deletedAt`)
    instead of refusing the operation. Refusing turned every edit of a drifting
    device into a `validation` conflict, and a refused create resolves by
    discarding the user's work. A malformed time is still refused. Tests:
    `apps/api/test/modules/sync.integration.test.ts`
    (`clamps a future operation timestamp to the server clock instead of refusing
    the operation`), `apps/api/test/services/syncEntityHandlers.integration.test.ts`
    (`clamps an operation time in the future to the server clock and applies the
    edit`). Area: server.

26. **One malformed operation in a batch** — the server validates each element
    on its own (`safeParseStoryUpdate`, shared), so a bad envelope becomes one
    `validation` conflict instead of a 422 for the whole batch, resent and refused
    every cycle. The client checks every built envelope against the same schema
    and quarantines what the server would refuse, so even a server that still
    validates the array as a whole is never poisoned. Tests:
    `sync.integration.test.ts` (`refuses a malformed operation alone, applying the
    valid ones around it`), `SyncPushHardening.test.ts` (`quarantines an envelope
    the server schema would refuse instead of poisoning the batch`).
    Area: server + push.

27. **Remote operations while a conflict is open** — the entity's held
    operations stay in the reconcile set, so a later remote operation folds into
    the pending conflict (`refreshServerSnapshot`): its snapshot merges newer
    values over older ones and never moves back to an older version. Resolving
    later accepts the server as it is now, not as it was when the conflict
    opened. Tests: `SyncConvergence.test.ts` (`keep-server takes the newest server
    value, not the snapshot taken when the conflict opened`),
    `SyncConflictService.test.ts` (`server snapshot freshness`). Area: pull +
    conflicts.

28. **Resolutions that strand local work** — keep-server and dismiss end with
    the row equal to the server: the snapshot at its version, a local deletion
    undone when the server still has the entity, and local fields the snapshot
    says nothing about sent on as a rebased edit (never left showing unsynced).
    With no server copy (a create refused because what it pointed at was deleted
    meanwhile) dismiss removes the row as keep-server does: kept, it would live on
    that device alone and never sync. Keep-local lays the snapshot under the local values; keep-local on a
    deletion sends the edits made before it and then the deletion, and aligns
    without resending when both sides already deleted. A resolution runs under
    the op-log lock against the conflict as it is now, and a second tap is a
    no-op. Tests: `SyncConvergence.test.ts` (`open conflicts and later remote
    operations`), `SyncConflictService.test.ts` (`resolution safety`,
    `dismissConflict`). Area: conflicts.

29. **Pull lagging behind the push** — a pull that keeps failing (or is blocked)
    while pushes land, or a push landing after the pull in the same cycle. The
    echo check skips this device's own operation, but an older remote operation
    on the same fields still arrives afterwards. It is masked by the history the
    device already incorporated (`maskSupersededUpdate`: the last write in server
    order wins per field, the version never moves back); in reconciliation, a
    remote operation at or below the pending chain's base is already held, the
    rebase only moves forward, and the remote version is never merged as a
    field. Tests: `SyncConvergence.test.ts` (`a pull lagging behind the push`),
    `syncPure.test.ts` (`maskSupersededUpdate`). Area: pull.

30. **Local edits racing a decision** — the pull reads an entity's unsynced
    operations under the op-log lock before deciding, and a push refusal
    (silent merge or conflict) covers the entity's whole unsynced chain as it is
    when the response arrives - including edits typed while the request was in
    flight. An edit made while the entity's conflict is open joins the conflict
    (scalar edits into scalar conflicts; never into a quarantine or an order
    dispute), so the decision covers the latest intent. Tests:
    `SyncConvergence.test.ts` (`rebases an edit made while the push was in flight
    instead of conflicting with its own history`), `syncUtils.test.ts`
    (`recordLocalOperation with a pending conflict on the entity`).
    Area: push + pull + local writes.

31. **Tombstones drifting** — a deletion records the whole tombstone and a
    restore the whole restored row (additive `data` on pulled deletes; old rows
    keep the id-only payload). A remote deletion aligns the local tombstone's
    content and version (`applyRemoteDelete`, version only moves up), a pending
    conflict takes the tombstone as its snapshot, and this device's own deletion
    or restore echo aligns the row's content when nothing is pending on it.
    Tests: `sync.integration.test.ts` (`records deletions and restores with the
    whole row, so drifted tombstones come back in step`), `SyncConvergence.test.ts`
    (`keep-server on a local delete brings the entity back, as the server still
    has it`). Area: server + pull.

32. **Rate limited or restarting server (429/502/503/504)** — reported as a
    failed cycle (backoff) with no user notification; the operations stay
    queued. Test: `SyncEngineHardening.test.ts` (`backs off quietly when the
    server answers %i, keeping the work queued`). Area: engine.

33. **Cross-story disclosure through a refusal** — a push naming an entity of
    another story is refused `unauthorized` with no `serverEntity`, and an
    idempotent resend reads the live version of the entity its recorded row
    names, never the one in the incoming envelope. Only the story owner restores
    a deleted comment (an author cannot undo moderation). Tests:
    `sync.integration.test.ts` (`never returns another story's row in the
    conflict of a refused cross-story operation`, `allows the owner to moderate a
    reader comment but never lets the owner edit its text`). Area: server.

34. **Entity written, operation lost (or the reverse)** — every local write and
    its operation record commit as one unit: `runLocalWrite` opens a SAVEPOINT
    under the story's op-log lock, the unit must be synchronous (a promise is
    refused), and change events fire only after the commit. A failure rolls both
    back. Test: `syncUtils.test.ts` (`runLocalWrite`). Area: local writes.

35. **Remote create without its story** — pulled create payloads leave out
    `storyId`; the pull stamps it on every table that has the column (twelve
    handlers failed every remote create before). Test: `SyncPull.test.ts`
    (`echo and create handling`). Area: pull.

36. **Writes reaching outside their story or plan** — attribute values, effects,
    comments and chapters (arc) must reference rows of the same story
    (`assertEntityInStory`), their identity fields are fixed after creation,
    favorites have a per-user ceiling, restores and uploads are charged to the
    story owner's plan, the gallery quota counts the true blob size (409 for a
    blob nothing declares), and operations on a deleted story are refused.
    Tests: `schemaAndSeeAlsoSyncHandlers.integration.test.ts`,
    `sync.integration.test.ts`, `tierEnforcementService.integration.test.ts`,
    `media.integration.test.ts`. Area: server.

37. **Compaction trusting client clocks** — the age gate reads the time in the
    operation's ULID (server-assigned), not the client-sent `createdAt`. Tests:
    `syncHistoryCompaction.test.ts`, `syncHistoryCompaction.integration.test.ts`.
    Area: server.

38. **Positions with two authorities** — an arranged row (scene, chapter, stat,
    schema field) carries its own fractional `rank` (`packages/shared/rules/rank.ts`);
    its number (`index`, `order`) is derived from the ranks of its live container
    mates - by SQLite triggers on the client, by `renumberArranged` on the server -
    and never sent, stored from a payload or contested. A tombstone holds no place.
    A move is a plain update of the one row that moved (rank and, across
    containers, the container), under the row's own OCC; `planRankChanges` keeps
    the longest run already in order and re-ranks only the rest. Tests:
    `packages/shared/test/rules/rank.test.ts`, `apps/client/test/db/rankTriggers.test.ts`,
    `arrangedRanks.integration.test.ts`, `SceneIndexing.test.ts`. Area: local
    writes + server.

39. **Two devices moving the same row** — rank is never contested: the last push
    wins and every device derives the same numbers from the same ranks (a local
    pending rank stays over a remote one; the other fields merge as usual). A move
    against a deletion never asks: the deletion wins either way, and the remote
    placement is still written to the local tombstone so it matches the server's.
    Tests: `SyncPull.test.ts` (`keeps a pending local rank over a remote one`,
    `keeps deleting a row the server only moved`, `lets the deletion of a row land
    over a pending move of it`), `SyncConvergenceFuzz.test.ts`. Area: pull + push.

40. **Positions stated instead of ranks** — a create may state a position and
    no rank (a story package, a test fixture): it is ranked from that position
    (`rankAtPosition`), the key every device and the server derive alike. An
    update's position is dropped - it is derived - so a number never moves a row.
    Tests: `arrangedRanks.integration.test.ts`, `eventReorder.integration.test.ts`
    (`ignores the number an update carries`), `rank.test.ts`. Area: server.

41. **Stale base with nothing left to pull** — a `version_conflict` on an update
    or delete reports the last server operation on the entity
    (`entityOperationVersion`). A device already holding it has seen every
    change, so the refusal is version bookkeeping only: fields merge and rebase
    with nothing contested - instead of a spurious conflict. A remote deletion is
    never skipped as "history already held". Tests: `SyncConvergenceFuzz.test.ts`,
    `SyncPull.test.ts`. Area: push + server.

42. **Push answer lost after the server applied it** — the pull hands each
    operation back with its pusher's `clientOperationId`. A device finding one of
    its own still queued settles it as its ack would have (synced, the server's
    version, the entity's pending conflicts told the version) and skips it as an
    echo - taking it out of a conflict that held it meanwhile. Tests:
    `sync.integration.test.ts` (`hands a pulled operation back with its pusher's
    own id`), `SyncConvergenceFuzz.test.ts` (lost push answers). Area: server +
    pull.

43. **Refusal that judges nothing** — an operation skipped behind an earlier
    refusal on the same entity in the batch comes back with no snapshot and no
    server version. It stays queued and goes again; recorded as a conflict, the
    missing snapshot read as "the server does not have it" and keep-server
    deleted the entity locally. Test: `SyncPush.test.ts` (`keeps an operation
    skipped behind another refusal queued`). Area: push + conflicts.

44. **What the server stored differs from what was sent** — the server logs the
    values it wrote (`writtenPayload`: a sorted character pair, a normalized
    field, a clamped date), not the request. The pushing device aligns its row to
    its own echoed create, update or delete, writing only the fields that differ
    and without touching a later local edit. Tests: `syncDuplicates.integration.test.ts`
    (`records what it stored`), `SyncPull.test.ts`, `SyncConvergenceFuzz.test.ts`
    (character relations). Area: server + pull.

45. **The same thing made twice offline** — tags of one name, the same tag on the
    same entity, one entity's value for a field, one pair of related characters,
    one favorite, one schema field key, one step of a route's path: each handler
    names its natural key and the
    server refuses a create, restore or key-changing update that would duplicate
    a live row as `duplicate`, naming the twin (`serverEntity`). Tombstones never
    block, so a deletion no longer rewrites a schema field's key to free it (each
    side wrote a different random suffix, and a restore brought it back mangled). Server uniques on these tables hold for live rows only; positional ones
    (anchor order, route step position) are gone from the database, and the client
    keeps plain indexes (a twin may exist locally until folded). The device folds
    its row into the twin (`duplicateFold.ts`): references repointed (queued
    payloads too), its operations abandoned, and the row dropped (never on the
    server), deleted (live there) or returned to the server's tombstone (a
    restore made it a twin: the refusal carries the row as the server holds it,
    `ownEntity`) - with a conflict on the twin only where content differs. A row
    renamed into a taken key and then deleted before either was sent is still
    deleted on the server (both operations fold, the deletion goes again).
    References already deleted are history and keep pointing where they did. Pushes of one story serialize on the story row, so two concurrent
    batches cannot both pass the check. Tests: `syncDuplicates.integration.test.ts`,
    `syncHandlerDuplicateCreates.integration.test.ts`, `SyncConvergence.test.ts`
    (`the same thing made twice offline`), `SyncConvergenceFuzz.test.ts`. Area:
    server + push.

46. **Operations writing rows they do not name** — the server touches only the
    row an operation names, so every device learns each change from the log.
    Taking a linear story's start or finish records the loss on the scene that
    held it (`takeStartFinishSync`); deleting an arc records each chapter's
    `arcId` edit. A local operation for a story missing locally throws instead of
    logging an orphan. Tests: `SceneIndexing.test.ts` (`start and finish
    handoff`), `collaborationSyncHandlers.integration.test.ts`,
    `SyncConvergenceFuzz.test.ts`, `syncUtils.test.ts` (`refuses to log an operation for
    a story that is not here`). Area: local writes + server.

47. **Compaction and moves** — a move is an update of the row that moved, logged
    on that row, so an arranged row's history squashes like any other: runs stop
    only at a create, a delete or (for favourites) another author. Test:
    `syncHistoryCompaction.test.ts`. Area: server.

48. **A protocol field the route dropped** — the route's response schema strips
    any field it does not list, so `entityOperationVersion` never left the server
    until listed there. Covered now at the wire, not just the service: `sync.integration.test.ts`
    (`names the last operation on the entity in a stale-base refusal, over the
    wire`) and the fuzz against the real API. Area: server.

49. **Scenes of a deleted chapter** — deleting a chapter (here, or on another
    device while this one placed a scene in it) leaves its scenes pointing at a
    tombstone. They read as unchaptered (`SceneService` derives the chapter a scene
    shows under from the chapter's liveness) instead of vanishing from every list,
    identically on every device and with nothing written; restoring the chapter
    brings them back under it. Test: `SceneIndexing.test.ts` (`scenes of a deleted
    chapter`). Area: local reads.

50. **A reference on its way taken for a reference gone** — a chapter and its
    scene in one push: the chapter does not land (folded, rewritten, skipped) and
    the scene is refused for pointing at a chapter the server lacks. Such a
    refusal stays queued while a create of the same push that is not itself
    waiting on a reference is still on its way; a reference truly gone is
    refused again with nothing left on its way, and asks then. A missing arc is
    a missing reference (`referenced_entity_deleted`), not an invalid payload.
    Tests: `SyncPush.test.ts` (`keeps a refusal for a missing reference queued`,
    `never lets two refusals for missing references wait on each other`).
    Area: push + server.

51. **A create that never landed, let go** — a create the server refused as
    invalid (a plot in a story made branching meanwhile) or that could not be
    sent is removed locally whichever way its conflict is resolved: kept, it
    would live on that device alone, never to sync. Test:
    `SyncConflictService.test.ts` (`removes a create the server refused as
    invalid`). Area: conflicts.

52. **Pull handlers judging what the server holds** — the character and location
    relation handlers used to settle a pulled row that duplicated a local one by
    recency: dropping the server's row or deleting the local one with nothing
    recorded, and devices drifted apart. The server refuses duplicates and the
    maker folds its own row; a pull only mirrors. Tests:
    `clientSyncHandlerSpecialties.test.ts`, `clientSyncHandlerRelations.test.ts`
    (`mirroring`). Area: pull.

53. **Two default arcs** — the story's first arc is its default; two devices
    making the first arc offline made two, neither deletable. The default arc is
    a conditional natural key: the second is refused as a `duplicate` and folds
    into the first, its chapters (`arcId`) following. Test:
    `SyncConvergenceFuzz.test.ts`. Area: server + push.

54. **Two devices replacing one route's path** — a path is one thing. When a
    step of this device's new path is refused as a `duplicate`, its whole path
    goes (steps never landed are dropped, landed ones deleted) and one decision is
    recorded on the route: keep mine replaces the path with this device's again,
    keep the server's closes it. Never two paths mixed, never a step-by-step
    question (`sync/routePaths.ts`). Test: `SyncConvergence.test.ts` (`one route,
    two new paths`). Area: push + conflicts.

55. **Offering a choice that cannot land** — keeping this device's version is not
    offered when what the change points at was deleted on the server, nor for an
    operation that could never be sent: resending would only reopen the conflict.
    Only discarding is offered (`ConflictSummary.canKeepMine`). Tests:
    `ConflictSummaryService.test.ts`, `SyncConflictPrimitives.test.tsx`. Area: UI.

## Convergence checks

`apps/client/test/services/SyncConvergence.test.ts` runs real
`SyncEngineService` instances - each over its own SQLite database, editing
through the real entity services - against `test/helpers/referenceSyncServer.ts`,
an in-memory model of the API protocol (OCC per entity version, one log per
story, `changedFields`, idempotent resends, per-operation validation, whole-row
deletions and restores). Every scenario ends with each device holding exactly
the server's rows, fields and versions.

`SyncConvergenceFuzz.test.ts` does the same over random histories: devices
editing, deleting and creating characters; creating, renaming, deleting,
reordering and moving scenes across two chapters; reordering and renaming the
chapters; creating, renaming, deleting and reordering stats; handing a linear
story's start scene around; and making what two devices easily make twice
offline - tags of a few shared names, tag relations, attribute values of one
field, character relations; favourites, comments and chapter anchors; in a
branching story (every other seed), routes whose path is replaced whole, choices,
their check groups, checks and effects; and every other kind of row a story
syncs - locations and their links, items and their journeys, notes and their
links, world rules, maps, boards, plots and plot scenes, arcs, calendars, gallery
media and its owners, see-also links, suggestions, modes, stat values and
strength ladders, who appears in each scene, the story's own title
(`syncFuzzWorld.ts`, `syncFuzzNarrative.ts`, `syncFuzzCollaboration.ts`) - syncing with failing pulls, push answers lost after
the server applied them, typing during pushes, dropping offline, the server
compacting its history, and conflicts resolved at random; then everything
settles and must converge with no conflict or queued operation left. Every
modelled row is compared field by field and version by version, arranged rows
included (their positions are derived, so there is no bookkeeping to heal), and
no device may hold a live row the server does not have.
Seeds are fixed and reported on failure;
`SYNC_FUZZ_TRACE=1` appends every op log and the server's; `SYNC_FUZZ_SHOW=1`
prints every seed's history, passing or not, to see what a run exercised. The default run is
24 seeds × 40 steps with three devices; a deeper run:
`SYNC_FUZZ_SEEDS=400 SYNC_FUZZ_STEPS=60 SYNC_FUZZ_DEVICES=5 npx jest test/services/SyncConvergenceFuzz`
(`SYNC_FUZZ_FIRST_SEED` shifts the window).

The same fuzz runs against the real API (Postgres, the real routes) with
`bun run test:sync-fuzz-api` (the test containers up): `scripts/sync-fuzz-api.ts`
starts `apps/api/test/syncFuzz/server.ts` - the application plus test-only
controls (reset, rows, compaction) - and points the harness at it over HTTP. It
is what caught the dropped protocol field (item 48) and the bare refusals
(item 43), which the reference model had answered more generously than the API.
Only one run at a time: every seed resets the shared test database. Scope: the
entity types the fuzz models (above); not the others.
