/**
 * The server writes the detail of a payment event in English, in the one language every administrator can
 * read the database in. The panel shows it in the administrator's own: the lines the server is known to
 * write are recognised and said again from the panel's texts, and a line it does not know is shown as it was
 * written.
 */
interface DetailForm {
  pattern: RegExp;
  key: string;
  /** The values of the line, taken from what the pattern captured. */
  params?: (match: RegExpExecArray) => Record<string, string>;
}

const FORMS: DetailForm[] = [
  {
    pattern: /^(\d+) month\(s\) by (.+?); (\d+) day\(s\) of (.+) became (\d+)$/,
    key: 'giftConverted',
    params: ([, months, by, left, from, became]) => ({ months, by, left, from, became }),
  },
  {
    pattern: /^(\d+) month\(s\) by (.+)$/,
    key: 'gift',
    params: ([, months, by]) => ({ months, by }),
  },
  { pattern: /^Asked by the user; it ends when the paid period does\.$/, key: 'canceledByUser' },
  { pattern: /^Canceled at the provider\.$/, key: 'canceledAtProvider' },
  { pattern: /^The paid period ended\.$/, key: 'periodEnded' },
  {
    pattern: /^Paid until (.+)\.$/,
    key: 'paidUntil',
    params: ([, until]) => ({ until }),
  },
  {
    pattern: /^Unpaid for (\d+) days\.$/,
    key: 'unpaidFor',
    params: ([, days]) => ({ days }),
  },
  { pattern: /^Unmatched (.+)$/, key: 'unmatched', params: ([, type]) => ({ type }) },
  {
    pattern: /^Refused: the purchase token belongs to another account\.$/,
    key: 'refusedOtherAccount',
  },
  {
    pattern: /^Refused: the same charge was already applied under another id\.$/,
    key: 'refusedDuplicate',
  },
  {
    pattern: /^Changed from (.+): (\d+) day\(s\) left became (\d+)\.$/,
    key: 'changedFrom',
    params: ([, from, left, became]) => ({ from, left, became }),
  },
  { pattern: /^Refunded in full: the period it paid for ends now\.$/, key: 'refundedFull' },
  {
    pattern: /^An earlier payment was refunded: the current period stands\.$/,
    key: 'refundedEarlier',
  },
  { pattern: /^Partly refunded: the period stands\.$/, key: 'refundedPartly' },
  {
    pattern: /^The account was closed; the renewal had already been stopped\.$/,
    key: 'closedStopped',
  },
  {
    pattern:
      /^The account was closed; the connector cannot stop renewals, so stop it at the provider\.$/,
    key: 'closedConnector',
  },
  { pattern: /^The account was closed\.$/, key: 'closed' },
];

/** What to show for a payment event's detail: the line in the panel's language when it is a known one. */
export function paymentDetailText(
  detail: string | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!detail) return '-';
  for (const form of FORMS) {
    const match = form.pattern.exec(detail);
    if (match) return t(`payments.details.${form.key}`, form.params?.(match) ?? {});
  }
  return detail;
}
