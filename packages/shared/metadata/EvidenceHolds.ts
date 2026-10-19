/**
 * Evidence holds: what the server keeps of a reported item when the report may be about child sexual abuse.
 * Plain constants and types, so the admin panel can import them by subpath (see `AuditEvents.ts`).
 *
 * Lei 15.211/2025 (art. 27, par. 2) makes the provider keep, for the period of Marco Civil da Internet art. 15 (six
 * months), the content reported and the data of the user responsible for it, with their metadata. Par. 3 lets an
 * authority ask for longer. The hold copies the item as it was when it was reported, because the person can delete
 * it, or the account, right after.
 */

/** What a hold can point at: the same things a report can. */
export const EVIDENCE_HOLD_TARGETS = ['story', 'user', 'message', 'publication'] as const;
export type EvidenceHoldTarget = (typeof EVIDENCE_HOLD_TARGETS)[number];

/** Six months, the Marco Civil art. 15 period. */
export const EVIDENCE_HOLD_DEFAULT_DAYS = 183;

/** The longest a hold may be asked to last in one request (an authority's request may repeat). */
export const EVIDENCE_HOLD_MAX_DAYS = 3650;

export const EVIDENCE_HOLD_MAX_NOTE = 500;

/** One hold as the administrators list it. The snapshot itself is read one hold at a time. */
export interface EvidenceHoldSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  targetKind: EvidenceHoldTarget;
  targetId: string;
  subjectUserId: string | null;
  /** The reports (admin-channel message ids) that led to it. */
  reportMessageIds: string[];
  /** `null`: made by the server itself on a report of the type `illegal`; otherwise the administrator's id. */
  createdBy: string | null;
  note: string | null;
}
