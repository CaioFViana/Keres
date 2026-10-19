# Official server deployment

Production Docker Compose for the official Keres server (Postgres + API), including
the nightly backup sidecar. All commands below run from `apps/api/`:

```bash
docker compose -f docker-compose.deploy.yml up -d
```

## Backups

The `backup` service dumps Postgres nightly into the `db_backups` volume and
deletes daily dumps older than `BACKUP_RETENTION_DAYS` (default **30 days**).
The first successful dump of each calendar month (UTC) is also kept as
`keres-monthly-YYYYMM.dump`; the newest `BACKUP_MONTHLY_KEEP` of those are kept
(default **3**, allowed 0 to 3; 0 keeps none). So the copies are **30 daily and 3
monthly, and no copy is kept more than 93 days**. A monthly copy is also removed
once it is older than 93 days, whatever the dumps since did, so an outage cannot keep one longer. The daily and the monthly
rotations never remove each other's files, and a failed dump creates or removes no
monthly copy.
That rotation is the control the
[privacy policy](../src/legal/privacyPolicy.ts) promises: dumps may hold
point-in-time copies of already-erased personal data until they rotate out.
Ninety days is the ceiling for the daily retention, not a target - shorter is always compliant.

- Take a manual backup now:
  `docker compose -f docker-compose.deploy.yml exec backup sh /deploy/backup.sh once`
- List dumps:
  `docker compose -f docker-compose.deploy.yml exec backup ls -la /backups`
- Keep dumps shorter: set `BACKUP_RETENTION_DAYS` in the deploy `.env`.
  Longer than 90 days needs a written justification and re-opens F27.
  `BACKUP_MONTHLY_KEEP` (0 to 3) sets how many monthly copies are kept.
- **Copy the `db_backups` volume off the machine, onto encrypted storage with
  access limited to operators.** A dump that only exists on the database's own
  disk is not a backup, and a dump holding personal data is itself personal
  data: the `db_backups` volume is mounted only into the `backup` service,
  never into the API.

## Restore

```bash
# Stop the API so nothing writes mid-restore, then restore over the database.
docker compose -f docker-compose.deploy.yml stop api
docker compose -f docker-compose.deploy.yml exec backup \
  pg_restore -h db -U keres -d keres -c /backups/keres-<stamp>.dump
docker compose -f docker-compose.deploy.yml start api
```

Replace `keres`/`keres` with `POSTGRES_USER`/`POSTGRES_DB` when they differ.
`pg_restore -c` drops objects before recreating them; the dump is custom format
(`pg_dump -F c`), so a single table can be pulled out with
`pg_restore -t <table>` instead when that is all that broke.

## After a restore: re-apply erasures

A dump is the past: accounts deleted after the dump date come back with it.

**Account deletions are re-applied for you.** The server writes every deletion, restoration and final erasure of
an account (id, kind and date, nothing else) to the *erasure ledger*, a file on its own volume
(`erasure_ledger`) that the backup service never mounts. At every start the server reads the ledger and, on a
restored database, deletes again the accounts the dump brought back (the grace period keeps counting from the day
the person asked) and erases again the ones already past it. The log says how many (`Erasure ledger applied`).
The ledger keeps 100 days (`ERASURE_LEDGER_RETENTION_DAYS`, more than the oldest backup). It is tiny: copy it off
the machine now and then, apart from the dumps, or a restore onto a new machine starts without it. Without a
ledger configured the server warns at start and you do the steps below by hand.

What the ledger does **not** cover is the rest of the list below. After every restore, before reopening the server:

1. Note the dump date (it is in the dump's filename). Restoring any copy, daily or
   monthly, brings back the accounts erased since it was taken. For a monthly copy
   that gap is up to about three months, not the 30 days of a daily dump.
2. Re-process every deletion received since: accounts deleted after that date
   must be deleted again, and their prune grace restarts from the re-deletion.
3. Re-run the time-based erasures the schedulers own (contact messages,
   payment records, audit lines, age-verification records of refused, expired
   and abandoned accounts) so anything that aged out while the dump sat on disk
   is erased, not resurrected indefinitely.

## Age verification service

The verification service described in [`docs/age_verification.md`](../../../docs/age_verification.md)
(`apps/verification`) runs from its **own** compose file, image and port, behind its own reverse proxy. This compose
carries only the Keres server's side: the `AGE_VERIFICATION_*` values below. `required` cannot boot without a service
to point at. The official server runs `manual` (the default): no service, accounts start unverified, and an
administrator marks verified accounts by hand in the admin panel (Users).

Its backups are written by the service itself, not by the `backup` service above (which dumps only Postgres): a nightly
copy of its data store, kept as 30 daily and 3 monthly copies (none older than 93 days), into its own
`verification-backups` volume. Copy that volume off
the machine to encrypted storage with access limited to operators. See
[`apps/verification/README.md`](../../verification/README.md), "Backups", for the manual backup and the restore steps.

- **Two volumes, two rules.** The service keeps:
  - the **data volume**: the encrypted images and metadata of open sendings, the
    reviewer accounts, the reviewer access log and the outbox of events not yet
    confirmed by Keres;
  - the **key volume**: the per-sending data keys (nothing else).
- **Backup rule: data yes, keys never.** The service's backups hold its data
  store (a consistent snapshot of the metadata, and the encrypted image files it
  names) and no key: the key store is never opened or copied, and no secret of
  the service is written. The backups carry the same retention as the dumps
  (30 daily and 3 monthly, none older than 93 days). **Never** back up the key volume: not in any rotation, not in any copy
  off the machine. Once a sending is decided, expired or cancelled its key is
  gone, so every backup copy of its images is unreadable from then on, including
  the copies taken before that.
- **Restore consequence.** After restoring the data volume, the open sendings
  whose keys were not restored are unreadable. The service cannot decide them,
  so they expire and the people send again. The Keres side keeps those accounts
  pending until they expire or `AGE_VERIFICATION_PENDING_DAYS` runs out, and the
  retry path takes them from there.
- **The commitment key is not in either volume.** `COMMITMENT_KEY` is a secret in
  the service's environment, kept in the operator's secret store with its own
  protected copy, apart from every data backup (together they would let a leak
  be brute-forced). Losing it breaks the duplicate check against past approvals.
- **Losing the key volume is not recoverable from backup**, by design: the open
  sendings become unreadable and expire.
- **Keres server keys** (names only; values live in the deploy `.env`, never in
  the repository):
  - `AGE_VERIFICATION_MODE` - `manual` (default) or `required` (`disabled` is still read as `manual`);
  - `AGE_VERIFICATION_URL` - the service's address; `https`, unless loopback with
    `AGE_VERIFICATION_ALLOW_INSECURE`;
  - `AGE_VERIFICATION_SECRET` (and `_PREVIOUS` while rotating) - Keres to service;
  - `AGE_VERIFICATION_EVENTS_SECRET` (and `_PREVIOUS`) - service to Keres; must
    differ from `AGE_VERIFICATION_SECRET`;
  - `AGE_VERIFICATION_TIMEOUT_MS`;
  - `AGE_VERIFICATION_ALLOW_INSECURE`;
  - `AGE_VERIFICATION_PENDING_DAYS` (default 30);
  - `AGE_VERIFICATION_MAX_ATTEMPTS` (default 3).

  In `required` mode the URL and both secrets are mandatory, and the API refuses
  to boot without them. Secrets are at least 32 characters.
- **Mode.** `AGE_VERIFICATION_MODE=manual` is the default, in Docker and outside it. Set `required`
  only together with a running verification service. Turn on the adults-only area in the admin
  settings (`allowNsfw`) and mark verified accounts in the admin Users page; a verified account then
  chooses, in its profile, whether it sees adults-only stories in the public showcase.
