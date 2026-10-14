# Data governance (official server)

How the official Keres server handles personal data under Brazil's LGPD, Marco
Civil and Lei Felca 15.211/2025. Third-party servers are their own controllers
with their own policies; this document answers for the official one, and gives
the rules every server that runs age verification must follow (see the
verification sections and the self-hoster checklist). The user-facing promises
live in the
[privacy policy](../apps/api/src/legal/privacyPolicy.ts) - this is the
operational companion behind them.

## Controller and contact

- Controller: the Keres team (keres.me).
- Data protection contact (encarregado): the contact form on keres.me. Name a person here
  before the Play release (D23).

## Roles in age verification

The verification service is run by the operator of each server, never by
Keres as a product (`docs/age_verification.md`).

| Party | Role | What it receives |
|---|---|---|
| Operator of a server | Controller of the verification data of its own server's accounts. Runs the verification service of that server (on the official server, the Keres team runs it) | Everything its service collects, for its own server only |
| Keres as a product (app, server software, reference service code) | None for other people's servers: it writes the code and does not hold the data | Nothing from other people's servers |
| The app on the person's device | Sends the document and the live photo straight to the verification service of the server the person is joining | Nothing is kept on the device or on Keres servers |

The verification service imports nothing of Keres and holds no story data. The
Keres server never sees a document, a photo, a date of birth or a document
number: it receives a signed result only.

## Processing register (LGPD Art. 37)

| Activity | Data | Legal basis | Where it lives |
|---|---|---|---|
| Account | username, tag, hashed password/recovery codes | contract (Art. 7, V) | Postgres, until deletion + 30 days |
| Accepted terms/privacy proof | user id, version, text hash, timestamp | legal obligation / rights protection (Art. 7, II/VI; Art. 16, I) | `terms_acceptances`, kept |
| Stories, messages, publications, reports | content the user sends | contract | Postgres, until deletion + 30 days |
| Payments | order ids, purchase-token hashes (never card data) | legal obligation (fiscal) | Postgres + providers (Stripe, PayPal, Google Play) |
| Security audit (admin and abuse-relevant activity) | who did what, outcome, app version. **No IP and no user agent** | legitimate interest / fraud prevention (Art. 7, IX/X) | scrubbed audit, up to 1 year |
| Access records (Marco Civil Art. 15) | table `access_records`: login, failed login, sign-up, password recovery, session renewal. IP, account (when there is one), the name tried, time. No user agent | legal obligation, when the operator is a company that runs the application with an economic purpose; otherwise legitimate interest / fraud prevention | 6 months (`ACCESS_RECORD_RETENTION_DAYS`, 183 days), kept after the account is deleted until the term ends |
| Site contact messages | visitor address + text | consent / legitimate interest | 90 days (`CONTACT_MESSAGE_RETENTION_DAYS`) |
| Erasure ledger | id of an account that was deleted, restored or erased, and the date. No name, no content | legitimate interest / protection of rights (Art. 7, IX; Art. 16): honouring an erasure after a backup restore | its own volume, outside every backup; 100 days (`ERASURE_LEDGER_RETENTION_DAYS`) |
| Evidence holds (reported item kept as it was) | the item reported as illegal, the account responsible (data and sign-in records with IP). Media files are not copied | legal obligation (Lei 15.211/2025 art. 27, par. 2) | Postgres table `evidence_holds`, not touched by account erasure; 183 days (`EVIDENCE_HOLD_DAYS`), longer on an authority's request |
| Backups | point-in-time copies of the above | same bases | 30 daily + 3 monthly, rotated out; nothing older than 93 days |
| Age verification: document image (front, optional back) and live photo | the document and a photo of the person, taken in the upload page | legal obligation (Art. 7, II), Lei 15.211/2025 | verification service only, until the decision |
| Age verification: name, kind and number of the document, date of birth | typed by the reviewer | same as above | nowhere: used for the commitment and the age check, discarded at submit, never stored |
| Age verification: record | result, method, dates, opaque reference of the service | same as above | Postgres, with the account (see retention) |
| Age verification: identity commitment | HMAC-SHA256 over the normalised name, kind and number, computed by the service (approved only) | same as above | Postgres; the HMAC key lives outside every database and backup |
| Reviewer accounts and access log (verification service) | reviewer login, password hash, which item each reviewer opened and when (no content) | legitimate interest / fraud prevention (Art. 7, IX/X), as the security audit | verification service data volume |

The age verification rows follow the framing of the existing ones: the legal
basis is the duty to verify age under Lei 15.211/2025. The live photo is
biometric data when it is compared with the face on the document (LGPD Art. 5,
II). The Art. 11 basis for that comparison is not fixed here: it goes to the
legal review (D23).

Children: accounts on a Keres server are 18+ and verified
(`docs/age_verification.md`). On the official server an account is created
pending and becomes active only when the verification service approves the
holder. No account of a minor exists, so no parental link or supervision is
needed (Lei 15.211/2025, Art. 24). The official server serves no adults-only
(+18) content at all - pushes and publications carrying the +18 flag are
refused while `AllowNSFW` stays off - so the verification data is collected
for the account check only, never for content.

## Retention table (what deletes what, when)

| Data | Erased | Control |
|---|---|---|
| Stories (all their entities, history, comments, permissions, publications) | a story deleted by its owner, or whose owner's account was erased: erased for good `STORY_DELETION_GRACE_DAYS` (30) after the deletion, row included. Media files follow the media sweep | `StoryRetentionService.purgeExpired`, daily right after the account prune |
| Sync history of a live story | updates older than 7 days collapse into one, except the newest 20 per entity; the heavy types (scene, sketch, board, location map, song) after 48 hours, except the newest 3 (`SYNC_SQUASH_*`). Creates and deletes are never squashed | `SyncHistoryCompaction`, after pushes (at most hourly per story) |
| Account + content on self-deletion | personal data within 30 days (`ACCOUNT_DELETION_GRACE_DAYS`) | prune job, keeps contributions to others' stories anonymized |
| Contact `site` messages | 90 days | `startContactMessagePruneScheduler` (daily) |
| Security audit entries | scrubbed of user link after 1 year | `AuditService.scrubUser` |
| Access records (IP + account) | 6 months (`ACCESS_RECORD_RETENTION_DAYS`, default 183); they stay after the account is deleted until the term ends. Viewing or exporting them in the admin is itself written to the audit | `AccessRecordService` prune |
| Payment records of closed accounts | `PAYMENT_RETENTION_DAYS` after closure (default 1825 days) | payments retention job |
| Erasure ledger | 100 days from each line (`ERASURE_LEDGER_RETENTION_DAYS`, never under 94: it must outlive the oldest backup) | `ErasureLedger.trim`, daily with the account prune |
| Evidence holds | 183 days from the report (`EVIDENCE_HOLD_DAYS`); an administrator extends one when an authority asks (par. 3), or lets it go when the report was unfounded. Account erasure does not shorten it | `EvidenceHoldService.pruneExpired`, daily with the account prune |
| Postgres dumps | the newest 30 daily dumps (`BACKUP_RETENTION_DAYS`, default 30) plus the first dump of each month, newest 3 kept (`BACKUP_MONTHLY_KEEP`, default 3, 0 to 3). Hard cap of 93 days | `apps/api/deploy/backup.sh` rotation |
| Age verification: document images and live photo | at the decision (approved, refused or expired), or at cancel; the per-sending key is destroyed with them (crypto-shredding). An undecided sending expires after `AGE_VERIFICATION_PENDING_DAYS` (default 30 days) | verification service decision and expiry jobs |
| Age verification: typed fields (name, kind, number, date of birth) | at submit: never stored | verification service |
| Age verification: backups of the data store (`verification-backups`: snapshot of the metadata and the encrypted images) | same rule as the dumps: 30 daily + the first successful backup of each UTC month (newest 3 kept), hard cap of 93 days; each backup is removed by rotation. The monthly one is a real byte copy, never a link to the live files. Ciphertext and metadata only, never the keys | verification service backup rotation (`apps/verification/src/backup`) |
| Age verification: per-sending encryption keys | with each sending; never backed up | key volume, outside every backup |
| Age verification: commitment key (`COMMITMENT_KEY`) | while the service runs; a secret in the operator's secret store, never in a database or a data backup; its own protected copy, kept apart from the data | operator |
| Age verification: approved record (result, method, dates, reference, commitment) | with the account; after account deletion kept pseudonymised as proof for the prescription period (to validate in D23) | account deletion, prune job |
| Age verification: refused or expired record | 30 days (the window to send again) | prune job |
| Age verification: pending account nobody completed | after `AGE_VERIFICATION_PENDING_DAYS` (default 30): the account is deleted completely and the service is told to destroy the submission | pending-account prune job, `cancel` |
| Age verification: reviewer access log | same period as the security audit: up to 1 year | verification service audit |

Kept by law: terms-acceptance proof, fiscal records, the scrubbed audit above, and the
evidence holds below.

**Evidence holds.** Lei 15.211/2025 (art. 27, par. 2) makes a provider keep, for the Marco
Civil art. 15 period (six months), the content named in a report of child sexual abuse
material and the data of the user responsible for it, with their metadata; par. 3 lets an
authority ask for longer. The server makes the hold itself when a report of the type
`illegal` is filed (`MessageService.fileReport`), because the owner can delete the item or the
account right after; an administrator can make one for any other report, extend one on an
authority's request, or let one go when the report was unfounded. The hold copies the item
(a story with its entities, but not its media files), the account data of the person
responsible and their access records. Account erasure does not reach it; it is dropped at its
end. Only administrators read it, and each read is on the activity record. It is **not** part
of the user's own data export (`/user/data`): handing the copy to the person under
investigation would defeat its purpose; whether that holds against the LGPD right of access is
a question for D23. Reports are filed by the reporter's choice of type, so some holds will be
of items that turn out to be fine: that is why an administrator can release one, and why the
hold lasts no longer than the law asks.
The acceptance proof and fiscal records carry a prescription-bound end (five
years, CDC Art. 27, by default for payments) that the legal review validates
before release (D23) - no carve-out is indefinite. The approved age verification
record and its identity commitment join that list, with the same open point: their
end is validated in D23. A commitment exists only for approved records. Backups
may hold already-erased data until they rotate out - the policy says so plainly,
and the rotation is the control. Dumps carry the verification records too, so
the rotation (30 days, and at most 93 for the monthly copies) covers them. No
law read for this review (LGPD, Marco Civil, Lei 15.211) sets a backup period or
a number of copies: the figures are our choice, as short as the operation allows. After any restore, re-apply erasures received
since the dump date (see `apps/api/deploy/README.md`).

## Age verification: impact assessment (RIPD)

This assessment covers the verification service as every server runs it. The
official server's figures are the Keres team's; any other server's operator
must make the same assessment for its own service. Update it with every change
to the flow in `docs/age_verification.md`.

**Purpose.** Confirm that the holder of an account is 18 or over (Lei
15.211/2025), and stop the same document from verifying two accounts on the same
server. The data is used for nothing else (LGPD Art. 13) and never to profile
anyone (Art. 26).

**Flow.** The person sends the document (front, optional back) and a live photo
taken in the upload page of the service of that server. A reviewer checks them
and decides. The service sends the server a signed result: approved or refused
(with a reason code), the method, the dates and the commitment. Nothing else
crosses to the server.

**Risks and measures.**

| Risk | Measure | Residual |
|---|---|---|
| The server collects a document or a photo | The protocol has no field for them. The server keeps only the result, method, dates, opaque reference and commitment | Low, by design |
| Images leak from the verification service | A random key per sending (AES-256-GCM); images deleted at the decision with their key (crypto-shredding), so later backup copies are unreadable | Low; the exposure lasts until the decision |
| A reviewer views or copies images without need | Each reviewer has an own account. Each image opened is logged (who, what, when, no content). The reviewer handbook forbids copies | Medium: the log shows who opened what, it does not stop a photo of the screen |
| The same document verifies several accounts | Keyed HMAC commitment; a unique index on approved commitments on the server | Low |
| The commitment and its key leak together | The key lives outside the database and every backup. Without the key the commitment is a keyed hash. Were both to leak, low-entropy numbers would be guessable, which is why the key is kept apart | Low, while the key stays apart |
| A minor gets an account | Refusal with `underage`: no retry, the account is closed at once. Revocation removes +18 access at the next request | Low to medium: it depends on the reviewer's check |
| Someone else's document or face | The face in the live photo must match the document; a retry goes to a different reviewer | See residual risk below |
| Images kept longer than needed | The deadlines in the retention table; abandoned sendings expire | Low |
| Service down | New registrations fail closed (503 `verification_unavailable`). Existing accounts are untouched | Availability, not privacy |
| Restore brings back stale state | Keys are not in backups, so pending sendings expire after a restore; account erasures are re-applied from the erasure ledger at every start (`apps/api/deploy/README.md`) | Low, for account deletions. The other time-based erasures re-run by themselves; anything else is on the restore checklist |
| Key volume lost | Pending sendings are lost and expire. Commitments cannot be recomputed without the key, so the duplicate check against past approvals stops working. It is not recoverable from backup, by design | Medium: the key volume is the most critical volume and must be kept |

**Residual risk, assumed in writing.** A manual look at an image does not
inspect holograms, chips or other security features, and cannot tell a
well-made forgery from an original. The check is a proportionate measure for an
age gate on an online service. It is not equivalent to in-person verification,
and it is not presented as such. The controller of each server accepts this
residual risk for its own server by running the service; the Keres team accepts
it for the official server by this document.

**Incident response.** The plan below applies. A leak of document images, of the
key volume or of reviewer credentials is an incident. The 3-business-day notice
falls on the operator of the server concerned.

**Open for the legal review (D23).** The prescription period of the approved
record and the commitment; the Art. 11 basis of the live photo comparison; the
named encarregado.

## Incident response (LGPD Art. 48)

1. **Contain**: revoke the exposed secret/session, close the vector, snapshot logs.
2. **Assess**: what data, whose, how many, risk of damage.
3. **Notify ANPD and the affected titulares within 3 business days** when there
   is relevant risk (Res. CD/ANPD 15/2024), with: what happened, what data,
   what was done, how to protect themselves, contact.
4. **Record**: keep the incident file (dates, decisions, notifications) for audit.
5. **Fix forward**: rotate credentials, patch, and re-check the register above.

## Report handling priority

Reports arrive typed (`intimate`, `copyright`, `spam_abuse`, `illegal`, `other`)
for every target (story, user, message, publication) and queue in the admin
inbox. Handle first what harms first: non-consensual intimate content and
clearly illegal content before spam, copyright and other - intimate
non-consensual imagery carries the diligent-removal duty (Marco Civil Art. 21).

## Self-hoster checklist

For servers run by someone other than the Keres team. Work through it before
the server opens. The reviewer handbook is `docs/age_verification_reviewer.md`.

1. **Choose the mode** (`AGE_VERIFICATION_MODE`):
   - `required`: new accounts are created pending and become active only when
     the verification service approves them. You need the service's URL and both
     secrets. While the service is down, new registrations stop; existing
     accounts keep working. Use it for any server open to people you do not know.
   - `disabled`: no verification at all. The server cannot allow adult content,
     no account is marked verified, the terms and the server screen say "no age
     verification on this server", and the boot log says so. Use it only for a
     server limited to people you know (home network, friends). Never present a
     `disabled` server to the public as 18+.
2. **Choose the content path**:
   - Path 1: no adults-only area. Works with either mode.
   - Path 2: an adults-only area that exists only for verified accounts. Only
     with `required`. With `disabled` the area does not exist.
3. **Run your own verification service before you turn the adults-only area on.**
   Do not point `AGE_VERIFICATION_URL` at a service someone else operates for
   you. The reference service (`apps/verification`) is planned; another service
   must follow `KERES-AGE-V1` and be run under your own responsibility. Test the
   whole path with reviewers you trust before opening registrations.
4. **Fill in your identity and contact** in the terms and the privacy policy you
   serve: who the controller is, and how people reach you about their data. The
   Keres team does not fill this in for you.
5. **Secrets and keys**: at least 32 characters each; the events secret must differ
   from the other. Rotate with the `_PREVIOUS` keys, never by editing in place.
6. **Backups**: copy the `verification-backups` volume of the verification
   service (its own nightly backups, `apps/verification/README.md`) and your
   Postgres dumps off the machine, encrypted, with access limited to operators.
   **Never back up the key volume.** After any restore, expect the pending sendings to expire,
   and re-apply your erasures.
7. **Retention**: keep the windows above, or shorter. The defaults are
   `AGE_VERIFICATION_PENDING_DAYS=30` and `AGE_VERIFICATION_MAX_ATTEMPTS=3`.
   Longer needs your own written justification.
8. **Reviewers**: give access only to people you trust, after they have read the
   reviewer handbook.

## External items (not code)

Play Console links, Data Safety, IARC, advocate review, provider DPAs and the
named encarregado stay in D21/D23 of
[LEGAL_IMPLEMENTATION_PLAN.md](../LEGAL_IMPLEMENTATION_PLAN.md).
