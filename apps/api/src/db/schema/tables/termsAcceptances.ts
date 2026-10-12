import { index, integer, table, text, timestampNow } from '../columns';
import { users } from './users';

/** Legal documents an account can accept: the terms (`keres-tos`) and the privacy policy (`keres-privacy`). */
export const LEGAL_DOCUMENT_KINDS = ['tos', 'privacy'] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

/**
 * Proof that an account accepted a legal document: who, which document and version, a hash of
 * the exact text shown, how, and when. One row per acceptance - a re-acceptance after a version
 * bump adds a row, it never rewrites history.
 *
 * Kept after account deletion (see `pruneDeletedAccounts`): this is the minimal evidence the
 * law requires the server to demonstrate. Pseudonymous: the row keeps pointing at the stable
 * account id, which no longer resolves to a person once the account row itself is scrubbed.
 */
export const termsAcceptances = table(
  'terms_acceptances',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind', { enum: LEGAL_DOCUMENT_KINDS }).notNull(),
    version: integer('version').notNull(),
    /** SHA-256 of the canonical text shown, so the proof names the exact wording, not just a number. */
    textHash: text('text_hash').notNull(),
    /** `registration` (accepted while creating the account) or `reaccept` (after a change). */
    method: text('method').notNull(),
    acceptedAt: timestampNow('accepted_at'),
  },
  (table) => [index('terms_acceptances_user_idx').on(table.userId, table.kind)],
);
