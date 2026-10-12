# Official server deployment

Production Docker Compose for the official Keres server (Postgres + API), including
the nightly backup sidecar. All commands below run from `apps/api/`:

```bash
docker compose -f docker-compose.deploy.yml up -d
```

## Backups

The `backup` service dumps Postgres nightly into the `db_backups` volume and
deletes dumps older than `BACKUP_RETENTION_DAYS` (default **90 days**).
That rotation is the control the
[privacy policy](../src/legal/privacyPolicy.ts) promises: dumps may hold
point-in-time copies of already-erased personal data until they rotate out.
Ninety days is the ceiling, not a target - shorter is always compliant.

- Take a manual backup now:
  `docker compose -f docker-compose.deploy.yml exec backup sh /deploy/backup.sh once`
- List dumps:
  `docker compose -f docker-compose.deploy.yml exec backup ls -la /backups`
- Keep dumps shorter: set `BACKUP_RETENTION_DAYS` in the deploy `.env`.
  Longer than 90 days needs a written justification and re-opens F27.
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
After every restore, before reopening the server:

1. Note the dump date (it is in the dump's filename).
2. Re-process every deletion received since: accounts deleted after that date
   must be deleted again, and their prune grace restarts from the re-deletion.
3. Re-run the time-based erasures the schedulers own (contact messages,
   payment records, audit lines, age-verification records of refused, expired
   and abandoned accounts) so anything that aged out while the dump sat on disk
   is erased, not resurrected indefinitely.

## Age verification service (planned)

The verification service described in [`docs/age_verification.md`](../../../docs/age_verification.md)
is **not in this compose yet**. The maintainer adds it later as its own service,
with its own image and port. Until it lands, this compose sets no
`AGE_VERIFICATION_*` values: an unset mode boots `disabled`, and `required`
cannot boot without a service to point at. The official server must not open
registrations in that state.

- **Two volumes, two rules.** The service keeps:
  - the **data volume**: the encrypted images and metadata of open sendings, the
    reviewer accounts, the reviewer access log and the outbox of events not yet
    confirmed by Keres;
  - the **key volume**: the per-sending data keys (nothing else).
- **Backup rule: data yes, keys never.** Back up the data volume like the
  database (encrypted, operators only, same 90-day ceiling). **Never** back up
  the key volume: not in any rotation, not in any copy off the machine. The
  `backup` service above dumps only Postgres and mounts only `db_backups`; a
  backup routine for the verification data volume is planned, not written yet.
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
  - `AGE_VERIFICATION_MODE` - `required` or `disabled`;
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
- **Mode.** `AGE_VERIFICATION_MODE=required` is the Docker default: the compose
  sets it once the service lands. Outside Docker an unset mode means `disabled`,
  so check the line in the `.env` when you deploy by hand. `disabled` on the
  official server is not an option.
