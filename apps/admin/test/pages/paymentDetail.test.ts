import { describe, expect, it } from 'vitest';
import { paymentDetailText } from '../../src/pages/payments/paymentDetail';

const t = (key: string, options?: Record<string, unknown>) =>
  options && Object.keys(options).length > 0 ? `${key} ${JSON.stringify(options)}` : key;

describe('paymentDetailText', () => {
  it('shows a dash when the event has no detail', () => {
    expect(paymentDetailText(null, t)).toBe('-');
    expect(paymentDetailText('', t)).toBe('-');
  });

  it('says the lines the server writes in the language of the panel, with their values', () => {
    expect(paymentDetailText('1 month(s) by root', t)).toBe(
      'payments.details.gift {"months":"1","by":"root"}',
    );
    expect(paymentDetailText('2 month(s) by root; 12 day(s) of Pro became 5', t)).toBe(
      'payments.details.giftConverted {"months":"2","by":"root","left":"12","from":"Pro","became":"5"}',
    );
    expect(paymentDetailText('Asked by the user; it ends when the paid period does.', t)).toBe(
      'payments.details.canceledByUser',
    );
    expect(paymentDetailText('Unpaid for 7 days.', t)).toBe(
      'payments.details.unpaidFor {"days":"7"}',
    );
    expect(paymentDetailText('Unmatched payment.succeeded', t)).toBe(
      'payments.details.unmatched {"type":"payment.succeeded"}',
    );
    expect(paymentDetailText('Changed from Basic: 10 day(s) left became 3.', t)).toBe(
      'payments.details.changedFrom {"from":"Basic","left":"10","became":"3"}',
    );
  });

  it('recognises the refund and account-closure lines', () => {
    for (const [line, key] of [
      ['Refunded in full: the period it paid for ends now.', 'refundedFull'],
      ['An earlier payment was refunded: the current period stands.', 'refundedEarlier'],
      ['Partly refunded: the period stands.', 'refundedPartly'],
      ['The account was closed.', 'closed'],
      ['The account was closed; the renewal had already been stopped.', 'closedStopped'],
      ['Refused: the purchase token belongs to another account.', 'refusedOtherAccount'],
    ] as const) {
      expect(paymentDetailText(line, t)).toBe(`payments.details.${key}`);
    }
  });

  it('shows a line it does not know as it was written', () => {
    expect(paymentDetailText('Something the provider said', t)).toBe('Something the provider said');
  });
});
