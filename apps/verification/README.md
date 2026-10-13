# Keres age-verification service (reference)

The reference service behind an account's "18+ and verified" check on a Keres server (`docs/age_verification.md`,
"The reference service"). It receives an identity document and a live photo from a person, a human reviewer decides,
and the service tells the Keres server only a signed result. The server never sees the document.

It ships **alone**: its own image, port and compose file. It imports nothing of the Keres server or of the payments
service, and speaks only the `KERES-AGE-V1` protocol.

This package is the core (configuration, the protocol, the encrypted stores, the decisions, the outbox) and the two sets of
pages in `src/pages/`: the person's upload page and the reviewers' pages. Both are server-rendered HTML with no framework,
no build step and no external script, style or font.

## The pages

- **Upload** (`GET /v/<token>`, `POST /v/<token>/upload`). The link is valid only while its sending is pending and not
  expired. Unknown, used and expired links get the same answer, so they cannot be told apart. The page is in the
  language the sending was made in (English or Portuguese), else the browser's, else English. It takes a front of the
  document (required), a back (optional) and one live photo: the camera in the page, or a file input with `capture` when
  the camera is not there or is refused. Images must be JPEG, PNG or WebP by their bytes; each is at most
  `MAX_UPLOAD_BYTES`, and the three together at most three times that. A successful upload burns the link.
- **Reviewers** (`/review/...`). Sign-in at `/review/login`: scrypt passwords, the same answer for an unknown name and a
  wrong password, and five failures in 15 minutes lock that name and address pair for 15 minutes. The session cookie is
  `HttpOnly; SameSite=Strict; Path=/review`, `Secure` unless the public address is plain http, 8 hours. Every state-changing
  post carries the session's CSRF token. The queue shows the age, the attempt and the username, oldest first. A reviewer
  claims a sending, then sees its images (each view is one audit line) and the checklist, and approves or refuses it.
  A retry is never taken by the reviewer who refused the sending before it.
- **Limits.** Rate limits and login lockouts are in memory, per process, and count by address. The address is the last
  entry of `X-Forwarded-For`, which the reverse proxy appends; without a proxy the header is the client's, so the limits
  are only as strong as the deployment. Restarting the service clears them.

## Running it

```
cp apps/verification/.env.example apps/verification/.env
# fill in the secrets and the public address, then:
docker compose -f apps/verification/docker-compose.yml up -d --build
```

Local development without Docker:

```
bun install
bun run --cwd apps/verification dev
```

The service refuses to start, and lists every problem, when a required variable is missing or short, when two keys
are equal, when `KEY_DIR` is `DATA_DIR` or inside it, when `BACKUP_DIR` is, contains or is inside either of them, when the backup
retention is past 90 days without `BACKUP_ALLOW_LONGER_RETENTION=true`, or when a public address is plain http outside
loopback.

## Reviewer accounts

```
bun run --cwd apps/verification reviewer:add <name>
```

Run it with the same environment as the service (its `DATA_DIR` is the one the service reads). The password is
`REVIEWER_PASSWORD` when that variable is set and at least 12 characters; otherwise a random one is printed **once**
and is not kept anywhere in plain text. Passwords are scrypt-hashed with a per-password salt.

## Backups

The service copies its data store into `BACKUP_DIR` every `BACKUP_INTERVAL_HOURS` (default 24). When `BACKUP_DIR` is
unset, backups are off and the boot log says so. The first round runs a minute after boot. The compose file mounts the
`verification-backups` volume at `BACKUP_DIR` and nowhere else.

- **What a backup holds.** `verification-<UTC stamp>/` with `data.sqlite.gz` (a consistent copy of the data store, taken
  with `VACUUM INTO` while the service keeps writing: submissions, audit log, reviewers, sessions, outbox) and `blobs/`,
  a byte-for-byte copy of the encrypted image files that snapshot names. Nothing is decrypted.
- **What it never holds.** The key store (`keys.sqlite`) is never opened, read or copied. `COMMITMENT_KEY` and the
  secrets are environment only and are never written. Once a sending is decided, expired or cancelled its key is gone,
  and every copy of its images is unreadable from then on, including copies taken before that.
- **Written whole or not at all.** The folder is written under a temporary name and renamed when complete. A run that
  stops halfway leaves no `verification-*` folder; a temporary folder is removed by a rotation once it is a day old.
- **Retention.** `BACKUP_RETENTION_DAYS`, default **90**, is a ceiling, as for the Postgres dumps and the privacy policy.
  A longer value is refused at boot unless `BACKUP_ALLOW_LONGER_RETENTION=true` with a written justification. Rotation runs
  after every round, even when that round's backup failed, and deletes only folders named like ours that are older than
  the retention. It never touches anything else in `BACKUP_DIR`.
- **Where.** `BACKUP_DIR` must not be, contain or be inside `DATA_DIR` or `KEY_DIR`: the service refuses to start otherwise.
- **Copy it off the machine.** Copy the `verification-backups` volume to encrypted storage with access limited to
  operators. A backup is personal data too. **Never** copy or back up `verification-keys`, and never mount the keys
  anywhere near a backup.
- **Manual backup.** One backup and one rotation, with the service's own configuration, while the service keeps running:

  ```
  docker compose -f apps/verification/docker-compose.yml exec verification bun run backup:now
  bun run --cwd apps/verification backup:now        # outside Docker
  ```

- **Restore.** Restoring brings back the data store, not the keys.
  1. Stop the service: `docker compose -f apps/verification/docker-compose.yml stop verification`.
  2. Pick a `verification-<stamp>` folder from the backups volume (`ls` inside the container, under `BACKUP_DIR`).
  3. In `DATA_DIR`, remove `data.sqlite`, `data.sqlite-wal` and `data.sqlite-shm` (the old copy's side files would be
     applied to the restored one), then gunzip the folder's snapshot into `data.sqlite`:
     `gunzip -c <folder>/data.sqlite.gz > <DATA_DIR>/data.sqlite`.
  4. Empty `DATA_DIR/blobs/` and copy the folder's `blobs/*` into it.
  5. Leave `KEY_DIR` exactly as it is. Do not restore keys from anywhere.
  6. Start the service again.

  The consequence: an open sending whose key is not in `KEY_DIR` is unreadable. The service cannot decide it, so it expires
  and the person sends again. Events that were already delivered to Keres may be pushed again; Keres applies each event
  once. Losing `verification-keys` loses the pending submissions the same way; decided results are on the Keres server
  and are not affected.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `AGE_VERIFICATION_SECRET` | required | What the Keres server signs its calls with (at least 32 characters). |
| `AGE_VERIFICATION_SECRET_PREVIOUS` | - | The previous key, only while rotating. |
| `AGE_VERIFICATION_EVENTS_SECRET` | required | What our event pushes are signed with. Differs from the above. |
| `COMMITMENT_KEY` | required | HMAC key of the identity commitment. Differs from all three. |
| `KERES_EVENTS_URL` | required | Where the events are POSTed (https unless loopback). |
| `PUBLIC_URL` | required | Our public address; the upload link is `${PUBLIC_URL}/v/<token>` (https unless loopback). |
| `SERVICE_ID` | `keres-manual` | The id the service answers with; kept with every verification. |
| `DISPLAY_NAME` | `Keres manual verification` | What the person sees as the verifier's name. |
| `DATA_DIR` | `./data` | Encrypted images and metadata (`data.sqlite`, `blobs/`). |
| `KEY_DIR` | `./keys` | Data keys only (`keys.sqlite`). Never backed up. |
| `SUBMISSION_TTL_DAYS` | `30` | An undecided sending expires after this many days. |
| `MAX_UPLOAD_BYTES` | `8388608` | The largest accepted image. |
| `ALLOW_INSECURE` | `false` | Allows plain http for non-loopback addresses. Private test networks only. |
| `HOST` / `PORT` | `127.0.0.1` / `3102` | Listen address; the container image sets `HOST=0.0.0.0`. |
| `BACKUP_DIR` | unset (backups off) | Where the backups go. Never inside or around `DATA_DIR` or `KEY_DIR`. |
| `BACKUP_RETENTION_DAYS` | `90` | How long a backup is kept. 90 is the ceiling. |
| `BACKUP_ALLOW_LONGER_RETENTION` | `false` | `true` allows a retention past 90 days, with a written justification. |
| `BACKUP_INTERVAL_HOURS` | `24` | Hours between two backups (1 to 480). |

## Tests

```
bun run --cwd apps/verification typecheck
bun run --cwd apps/verification lint
bun run --cwd apps/verification test
```

The tests run under Node (vitest). The store uses `bun:sqlite`, which Node does not have, so `vitest.config.ts` maps it to
Node's built-in `node:sqlite` in the tests only (`test/shims/bunSqlite.ts`). The SQL is the same; the driver differs.
