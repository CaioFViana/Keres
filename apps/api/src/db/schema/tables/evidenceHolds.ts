import { EVIDENCE_HOLD_TARGETS } from '@keres/shared/metadata/EvidenceHolds';
import { index, json, table, text, timestamp, timestampNow } from '../columns';

/**
 * Evidence holds (Lei 15.211/2025 art. 27, par. 2): a copy of a reported item, and of the data of the person
 * responsible for it, made when the report arrives and kept until `expires_at` (six months by default, longer
 * only when an authority asks). It exists because the owner can delete the item - or the account - the moment
 * after the report, and the law asks the provider to still have it.
 *
 * Deliberately outside the erasure rules: an account's erasure does not touch it. It is dropped when it expires
 * (`EvidenceHoldService.pruneExpired`), and it is only read by the administrators, with every read on the activity
 * record. No foreign keys: it must outlive what it copies.
 *
 * `snapshot` is the item as it was, the subject's account data and the subject's access records at that moment;
 * media files are not copied, only the references.
 */
export const evidenceHolds = table(
  'evidence_holds',
  {
    id: text('id').primaryKey(),
    createdAt: timestampNow('created_at'),
    expiresAt: timestamp('expires_at').notNull(),
    targetKind: text('target_kind', { enum: EVIDENCE_HOLD_TARGETS }).notNull(),
    targetId: text('target_id').notNull(),
    /** The account responsible for the item (its owner, its sender, or the reported account itself). */
    subjectUserId: text('subject_user_id'),
    /** The reports that led to the hold: ids of the admin-channel messages. */
    reportMessageIds: json('report_message_ids').notNull(),
    /** The administrator who made it; empty when the server did, on a report of the type `illegal`. */
    createdBy: text('created_by'),
    note: text('note'),
    snapshot: json('snapshot').notNull(),
  },
  (table) => [
    index('evidence_holds_target_idx').on(table.targetKind, table.targetId),
    index('evidence_holds_expires_idx').on(table.expiresAt),
  ],
);
