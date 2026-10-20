# Age verification

An account on a Keres server is **18+ and verified**. This is a deliberate decision: with no account of a minor there is no parental link or supervision (Lei 15.211/2025,
Art. 24) and the data model does not change. Declaring "I am 18" does not produce that effect - the barrier has to be real.

Offline use of the app is free: no gate, no document, nothing leaves the device. The gate is the **account on a server**.

The verification is **not done by the Keres server**. It is a separate service, run by the operator of that server (the
official one by the Keres team; a third-party server by whoever hosts it). The person sends an identity document and a
live photo **to that service**; a human reviewer there decides; the service tells the server only a signed result. The
server never sees a document, a photo, a date of birth or a document number.

The contract is `packages/shared/age-verification/AgeVerificationConnector.ts` (types) plus the wire schemas in
`packages/shared/schemas/accounts/AgeVerificationSchemas.ts`. A service imports nothing of Keres. It has the same shape as the
payment connector (`docs/compliance/payment_connectors.md`) - and the same care, with one deliberate difference, below.

## Modes (`AGE_VERIFICATION_MODE`)

| | `required` | `manual` (default when unset) |
|---|---|---|
| Who | the official server's external service, Docker deployments that run one | home / LAN / friends servers, development, tests, and any server with no verification service |
| Registration | an account is created **pending** and activates only on the service's `approved` event | the account is **active at once** and **not verified** |
| Who verifies | the service's `approved` event sets the flag; an administrator can only **revoke** it | an administrator **marks and revokes** the flag by hand (`isAdultVerified` on `PUT /admin/api/users/:id`), each one audited |
| Service down / not configured | **new registrations answer "unavailable on this server"** (503, code `verification_unavailable`); existing accounts are untouched | n/a: no service is called |
| Adults-only (+18) area | exists; `allowNsfw` can be turned on; verified accounts only | exists; `allowNsfw` can be turned on; verified accounts only |

`disabled`, the legacy value, is still accepted and read as `manual`, so an existing `.env` keeps booting.

Unlike payments - where "no connector" is a safe default (nothing is sold) - here "no service" must never mean "register
without checking". So `required` is fail-closed for **new registrations only**. `manual` is safe because the code
imposes, with no exception:

1. **Nothing is verified automatically in `manual`.** A new account is never marked verified. The flag changes only by an
   administrator's hand (grant or revoke), and each change is written to the audit record (`account.verification_granted`,
   `account.verification_revoked`).
2. An administrator can grant verification **only in `manual`**. In `required` a grant is refused (400); only the service
   approves there. Revoking goes through `AgeVerificationService.revoke` in both modes, so there is one revocation path.
3. `allowNsfw` can be turned on in both modes. A story is still flagged adults-only only by its owner, only where the server
   allows it, and only while the owner is verified (`StoryNsfwService.nsfwFlagRefusal`).
4. Anything that gates on "adult verified" reads the stored flag (`effectiveAdultVerified`). The mode does not hide it and
   does not invent it.
5. **Seeing adults-only stories in the public showcase is the verified account's own choice** (`users.show_nsfw`, default
   off, `GET/PUT /api/user/preferences`, the switch in the profile screen of the app). The showcase shows a +18 story to
   a viewer who is verified **and** turned it on; revoking the verification resets the choice. Collaboration on +18
   stories (invitations, sync, flagging) depends on verification only and never reads the choice. Marking a story +18 on
   the device is never blocked: the server refuses only to receive, publish or import it where it does not allow it.
5. The boot logs the mode at every start. In `manual` it says that no service checks anyone, that accounts start not
   verified, and that administrators mark them by hand.

A `manual` server is 18+ only as far as its operator marks its adults by hand and checks them. The product supplies the
marking, the adults-only area and the record, not the check. Opening a `manual` server to the public presenting it as 18+
without that check is a violation by its operator (Arts. 9, 14 and 15: the chain answers jointly, and Keres' part is
delivering these defaults and locks).

## Keys on the Keres server

`AGE_VERIFICATION_MODE`, `AGE_VERIFICATION_URL` (https unless loopback or `AGE_VERIFICATION_ALLOW_INSECURE=true`),
`AGE_VERIFICATION_SECRET` (+ `_PREVIOUS`; Keres → service), `AGE_VERIFICATION_EVENTS_SECRET` (+ `_PREVIOUS`; service →
Keres; must differ from the first), `AGE_VERIFICATION_TIMEOUT_MS`, `AGE_VERIFICATION_ALLOW_INSECURE`,
`AGE_VERIFICATION_PENDING_DAYS` (default 30), `AGE_VERIFICATION_MAX_ATTEMPTS` (default 3). In `required` mode the URL and both
secrets are mandatory: boot refuses to start without them. Secrets are at least 32 characters.

## The protocol (`KERES-AGE-V1`)

Exactly the signing scheme of `KERES-CONNECT-V1` (HMAC-SHA256 over direction, method, logical path with query, timestamp,
nonce, body hash; answers bind the request nonce; nonces accepted once in a 300 s window), with the **scheme tag
`KERES-AGE-V1`** (so a payments signature is never valid here) and the directions `keres-to-verifier` /
`verifier-to-keres`. Same headers (`x-keres-timestamp`, `x-keres-nonce`, `x-keres-signature`).

Keres calls, all JSON:

- `GET /v1/info` - `{ apiVersion: 1, id, displayName, capabilities }`; optional parts: `status`, `cancel`.
- `POST /v1/verifications` - starts one (`verificationId` is the idempotency key); answers the service's reference plus
  what the person does next (`redirect` to an `https` page of the service, or `instructions`).
- `GET /v1/verifications/:id?providerReference=...` (`status`) - how it ended, `{ event: null }` while open.
- `POST /v1/verifications/:providerReference/cancel` (`cancel`) - destroy a submission nobody will decide.

The service reports to `POST /api/age-verification/events`, signed with the events key, up to 100 events per push; Keres
applies each `eventId` once. Events: `verification.approved` (with `method` and `identityCommitment`),
`verification.rejected` (with one of `VERIFICATION_REJECTION_REASONS`), `verification.expired`; each says `discardedAt`.

## What the server keeps (and never keeps)

Table `age_verifications` (one row per sending): the account, the service's id and reference, `status`
(`pending | approved | rejected | expired | canceled`), `method`, `identity_commitment` (approved only), the dates
(created, decided, verified, discarded) and the refusal reason. On the user: `is_adult_verified`, `verified_at`,
`verification_method`, and `verification_status` (`active | pending | rejected`) for the account itself.

**Never** on the Keres server: a copy or number of the document, a date of birth, a photo, the name on the document.

`identity_commitment` is an **HMAC-SHA256 computed by the service** with a key (`COMMITMENT_KEY`) that is outside every
database and every backup, over the normalised name + document kind + document number the reviewer read. It is not a
salted hash: a CPF has a space too small, and a salt stored beside it is reversible by brute force. The commitment proves
afterwards that *that* document was the one checked, and a **unique index on approved commitments** stops the same
document from verifying a second account on the same server (the event is then treated as a refusal with reason
`document_reused`). It exists only for **approved**: a refused or expired sending has none, and the service destroys its
document at the decision regardless.

Retention: the approved row lives with the account; after the account is deleted it is kept pseudonymised as proof for
the prescription period set in D23. Rejected / expired rows are deleted after a 30-day window (the window to try again);
a pending account that nobody completed within `AGE_VERIFICATION_PENDING_DAYS` is **deleted completely** (the service is
told to destroy the submission). Data collected for the verification is used for nothing else (Art. 13) and is never used
to profile (Art. 26).

## Registration in `required` mode

1. `POST /api/auth/register` as today, plus: if the service is not connected → 503 `verification_unavailable`, no account.
   Otherwise the server asks the service to create a verification **before** committing the account (the id is generated
   first); if the service fails → 503, no account. The account is created `verification_status = pending`,
   `is_adult_verified = false`. The response is the usual one **plus** `verification: AccountVerificationStatus` (with the
   `action`).
2. A pending account is **useless**: every authenticated route answers 403 `{ code: 'verification_pending' }` except
   `GET /api/auth/verification`, `POST /api/auth/verification/retry`, `POST /api/auth/logout` (and the refresh of the
   session), the terms routes, and the public routes. No sync, no profile, no invitations, no friends. A pending
   account is not findable by other users. Mechanically: a session issued to a pending account (at register, login or
   refresh) carries a `pending: true` claim, and the request pipeline (where the session is resolved - no database hit per
   request) refuses it with the 403 everywhere outside that allow-list. Login and refresh read the database to decide the
   claim. When the verification turns `approved`, the next `GET /api/auth/verification` answer carries a fresh full
   `session` (`AccountVerificationResponse`) which the app stores.
3. The app shows its one generic screen for the `action` (open the `https` page / show the instructions) and polls
   `GET /api/auth/verification` until `approved` (the account becomes `active`, `is_adult_verified = true`, nothing else
   changes) or `rejected` / `expired`.
4. `rejected` or `expired`: the person may send again with `POST /api/auth/verification/retry` (a new verification with
   `retryOf` = the previous reference, so another reviewer looks at it), at most `AGE_VERIFICATION_MAX_ATTEMPTS` sendings.
   Past the limit the account is closed (as a pending account abandoned). Refusal reason `underage` has no retry: the
   account is closed at once ("an underage account that is discovered is ended").
5. Approving also checks the commitment (unique among approved). The `approved` event is idempotent by `eventId`.
6. Revocation (an administrator revokes the verification, or the account is found to be a minor's): `is_adult_verified`
   goes false, `AgeVerificationService.revoke` runs the existing "kick from +18 stories" flow (`StoryNsfwService`) and the
   +18 access is gone at the next request, because every gate reads the database per request.

Registration is limited to 10 attempts an hour per client address, in both modes (429 past that), so a script cannot flood the review queue.

An administrator **marks an account verified only in `manual` mode**; in `required` only the service grants, and an administrator can only revoke.

## The reference service (`apps/verification`)

Standalone (own `Dockerfile`, port, compose), imports nothing of the Keres server, holds no story data, speaks only the
protocol above. Operated by the operator of the server it serves.

- **Upload page** (`/v/<token>`, one-time 256-bit token, hashed at rest): the person sends the document (front, optional
  back) and a **live photo taken right there** (camera capture in the page; the file-input `capture` fallback on phones).
  Images only (JPEG/PNG/WebP, magic-byte checked, size-limited). Nothing about the person is asked except the file.
- **Encryption per sending**: every submission gets its own random AES-256-GCM data key. Blobs and metadata live in the
  data store; **the data keys live in a separate key store that is not in the backups**. Deciding destroys the key row
  (**crypto-shredding**: any backup copy of the blob is unreadable from then on) and deletes the blobs.
- **Reviewers** have their own accounts (scrypt-hashed passwords, rate-limited login, session cookie). The queue is oldest
  first. A reviewer claims an item; viewing each image is **recorded in the audit log** (who, what, when - no content);
  a retry is never assigned to the reviewer who refused the previous sending.
- **Reviewer's script** (shown beside the item): the document is whole and legible; it is an original capture, not a
  screenshot or a photo of a screen; the face in the live photo matches the document; the holder is of age. The reviewer
  then **types** the name, kind and number of the document and the date of birth: the service refuses to approve when the
  date of birth makes the holder younger than 18, computes the commitment from name + kind + number, **discards what was
  typed** and stores none of it. Refuse with a reason code.
- **Decision**: destroys images and key, writes the audit line, queues the signed event for Keres (an outbox, retried with
  back-off until Keres answers 2xx; events carry no personal data).
- **Expiry**: an undecided sending older than the configured days is destroyed and reported `verification.expired`; a
  `cancel` from Keres destroys it at once.
- **Residual risk, assumed in writing** (`docs/compliance/data-governance.md`): a manual look at an image does not inspect a hologram
  or a chip; it is a proportionate measure, not equivalent to presential verification.

## Trying it locally

`bun run verification:local` raises the real Keres API and the reference service on one machine, with throwaway
secrets, a temporary SQLite database and temporary data and key folders (the service on 3102, the API on 3301, or the
next free ports; never 3000, 3101 or 3300). It creates one reviewer with a random password and prints the addresses
and the reviewer login. Ctrl+C stops only the two processes it started and deletes the temporary folders.

`bun run verification:local --drive` drives the whole flow over HTTP and exits non-zero at the first failed step:
the server reports `required` and available; a registration waits pending with an upload link; the pending session
is refused everywhere but the verification; the person uploads a document and a live photo; the reviewer claims,
sees both images and approves an adult; the approval reaches the server and the account gets a fresh session; the
old token stays refused; a second account with the same document is refused as `document_reused` and not verified;
a third is refused as `underage`, gets no retry and cannot sign in.

`bun scripts/age-verification-local.ts --mode=manual` starts only the API in `manual` mode (no service, no reviewer), and with `--drive` checks that it answers as a `manual` server does: accounts work at once and start not verified, an administrator can mark and revoke an account, and the adults-only switch can be turned on. (`--mode=disabled` is accepted as an alias.)

It does not test the camera in the upload page or a real browser: the page's script is checked only by its
fallback (a plain multipart post). Open the link the register answer gives, in a browser, to try the camera.
