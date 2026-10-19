import { VERIFICATION_REJECTION_REASONS } from '@keres/shared/age-verification/AgeVerificationConnector';
import {
  index,
  integer,
  json,
  primaryKey,
  table,
  text,
  timestamp,
  timestampNow,
  uniqueIndex,
} from '@/db/schema/columns';
import { users } from './users';

/**
 * One sending of an identity document to an age-verification service (see `docs/age_verification.md`): the account it
 * is for, the service's own reference, and how it ended. Nothing about the document or the person is in here - the
 * service keeps those, and the only thing that outlives the decision is `identityCommitment`.
 *
 * `id` is Keres' verification id, the one the service is given and names in its events. A retry is a new row whose
 * `retryOf` is the previous sending's provider reference, so another reviewer looks at it.
 */

/** Where a sending stands. `canceled` is what a sending nobody will decide gets when its account is closed. */
export const AGE_VERIFICATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'canceled',
] as const;
export type AgeVerificationStatus = (typeof AGE_VERIFICATION_STATUSES)[number];

/**
 * What became of an event the service sent, as the ledger keeps it. A duplicate is not written here: it is the second
 * arrival of a line that is already in the ledger.
 */
export const AGE_VERIFICATION_EVENT_OUTCOMES = ['applied', 'unknown', 'ignored'] as const;
export type StoredAgeVerificationEventOutcome = (typeof AGE_VERIFICATION_EVENT_OUTCOMES)[number];

export const ageVerifications = table(
  'age_verifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** The service that holds the sending (`AgeVerifier.id`). */
    verifierId: text('verifier_id').notNull(),
    /** The service's own reference for the sending. Kept, shown to administrators, never interpreted. */
    providerReference: text('provider_reference').notNull(),
    status: text('status', { enum: AGE_VERIFICATION_STATUSES }).notNull(),
    /** 1 for the first sending of the account; one more for each retry. */
    attempt: integer('attempt').notNull(),
    /** The service's reference of the sending this one retries, when it is a retry. */
    retryOf: text('retry_of'),
    /** How it was checked, as the service names it. Approved rows only. */
    method: text('method'),
    /**
     * HMAC-SHA256 the service computed over the document it read (see the contract). Approved rows only. Unique, so the
     * same document cannot verify a second account on this server: a null (every other row) never collides.
     */
    identityCommitment: text('identity_commitment'),
    rejectionReason: text('rejection_reason', { enum: VERIFICATION_REJECTION_REASONS }),
    /** What the person was asked to do while pending (an address to open, a text to follow), so it can be shown again. */
    actionJson: json('action_json'),
    createdAt: timestampNow('created_at'),
    expiresAt: timestamp('expires_at'),
    decidedAt: timestamp('decided_at'),
    /** When the service destroyed the document and the photo for this sending. */
    discardedAt: timestamp('discarded_at'),
  },
  (table) => [
    index('age_verifications_user_idx').on(table.userId, table.createdAt),
    uniqueIndex('age_verifications_commitment_unique').on(table.identityCommitment),
  ],
);

/**
 * The ledger of what the services reported to this server: `(verifier_id, event_id)` is the service's id for a fact,
 * so the same fact arriving twice (a retry of the service's outbox) is applied once.
 */
export const ageVerificationEvents = table(
  'age_verification_events',
  {
    verifierId: text('verifier_id').notNull(),
    eventId: text('event_id').notNull(),
    receivedAt: timestampNow('received_at'),
    outcome: text('outcome', { enum: AGE_VERIFICATION_EVENT_OUTCOMES }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.verifierId, table.eventId] })],
);
