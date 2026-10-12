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
are equal, when `KEY_DIR` is `DATA_DIR` or inside it, or when a public address is plain http outside loopback.

## Reviewer accounts

```
bun run --cwd apps/verification reviewer:add <name>
```

Run it with the same environment as the service (its `DATA_DIR` is the one the service reads). The password is
`REVIEWER_PASSWORD` when that variable is set and at least 12 characters; otherwise a random one is printed **once**
and is not kept anywhere in plain text. Passwords are scrypt-hashed with a per-password salt.

## Backups

- **Back up `verification-data`** (the `DATA_DIR`): the encrypted images, the metadata, the audit log, the reviewers.
- **NEVER back up `verification-keys`** (the `KEY_DIR`). Its rows are the data keys. A backup with the keys would make
  every encrypted image in it readable, and the whole point of the design is that a destroyed key makes every copy
  unreadable. Losing `verification-keys` loses the pending submissions (their images cannot be read again, so people
  send again); decided results are on the Keres server and are not affected.
- Never put `KEY_DIR` inside `DATA_DIR`: the service refuses to start in that layout, because a backup of the data
  would carry the keys.

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

## Tests

```
bun run --cwd apps/verification typecheck
bun run --cwd apps/verification lint
bun run --cwd apps/verification test
```

The tests run under Node (vitest). The store uses `bun:sqlite`, which Node does not have, so `vitest.config.ts` maps it to
Node's built-in `node:sqlite` in the tests only (`test/shims/bunSqlite.ts`). The SQL is the same; the driver differs.
