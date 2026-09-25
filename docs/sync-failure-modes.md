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
   consecutive failures retires it like an empty reorder (recorded, cursor
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
   (`groups only pushable operations by entity in operation-version order`),
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

15. **Empty reorder in history** — carries no information, so it is skipped past
    (recorded, cursor advanced) instead of stalling the story's pull forever. Test:
    `SyncEngineService.test.ts`
    (`skips past a reorder without items instead of stalling the pull`). Area: engine.

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
    a half-applied op the next launch would apply twice (a reorder bumps every
    touched version on each apply). The record's own insert and counter bump are
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
