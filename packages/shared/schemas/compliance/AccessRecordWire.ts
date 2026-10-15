import type { AccessRecordEvent } from '../../metadata/AccessRecords';

/** One access record as the admin panel sees it. Dates are ISO strings: this is the wire shape. */
export interface AccessRecord {
  id: string;
  occurredAt: string;
  event: AccessRecordEvent;
  /** The account, when one matched; `null` for a name that matched nobody. */
  userId: string | null;
  /** The account's name now (`null` when no account matched). */
  username: string | null;
  /** The name that was typed when no account matched - kept as it was, clipped. */
  usernameTried: string | null;
  ip: string;
}

export interface AccessRecordPage {
  items: AccessRecord[];
  /** Pass it back as `cursor` for the next page; `null` when this is the last one. */
  nextCursor: string | null;
  /** How many months (days) the records are kept, so the panel can say so. */
  retentionDays: number;
}
