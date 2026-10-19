/**
 * What a report to the administrators is about. The type decides the handling promise (see the
 * server terms): `intimate` is removed diligently after the participant's notice (Marco Civil
 * Art. 21), `copyright` follows notice-and-takedown (Law 9.610/98), the rest are reviewed.
 */
export const REPORT_TYPES = ['intimate', 'copyright', 'spam_abuse', 'illegal', 'other'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** Anything a report can point at: a story, a user, a message, or a publication. */
export const REPORT_TARGETS = ['story', 'user', 'message', 'publication'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
