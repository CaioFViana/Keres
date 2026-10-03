import { render } from '@testing-library/react-native';
import PlanStatusCard from '../../src/components/features/servers/PlanStatusCard';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      card: '#fff',
      text: '#111',
      textSecondary: '#555',
      error: '#f00',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const subscription = (over: Record<string, unknown> = {}) =>
  ({
    tierId: 't1',
    tierName: 'Pro',
    interval: 'monthly',
    status: 'active',
    paidUntil: '2026-04-03T12:00:00.000Z',
    lastPaymentAt: '2026-03-03T12:00:00.000Z',
    amountCents: 1990,
    currency: 'BRL',
    cancelAtPeriodEnd: false,
    canCancelHere: true,
    autoRenews: true,
    complimentary: false,
    ...over,
  }) as never;

describe('PlanStatusCard', () => {
  it('shows the plan, how often it is paid, that it is paid up, and until when', async () => {
    const view = await render(<PlanStatusCard subscription={subscription()} />);

    expect(view.getByText('Pro · payment_interval_monthly')).toBeTruthy();
    expect(view.getByText('payment_status_active')).toBeTruthy();
    expect(view.getByText('payment_paid_until')).toBeTruthy();
    expect(
      view.getByText(new Date('2026-04-03T12:00:00.000Z').toLocaleDateString('en')),
    ).toBeTruthy();
    // The server's own screen keeps to the dates.
    expect(view.queryByText('payment_last_amount')).toBeNull();
  });

  it('adds the amount on the plan screen', async () => {
    const view = await render(<PlanStatusCard subscription={subscription()} showAmount />);

    expect(view.getByText('payment_last_amount')).toBeTruthy();
    expect(view.getByText('R$19.90')).toBeTruthy();
  });

  it('calls a plan the administrators gave a gift, with no interval and no amount', async () => {
    const gift = subscription({
      complimentary: true,
      cancelAtPeriodEnd: true,
      amountCents: 0,
      autoRenews: false,
      canCancelHere: false,
    });
    const view = await render(<PlanStatusCard subscription={gift} showAmount />);

    expect(view.getByText('Pro')).toBeTruthy();
    expect(view.queryByText('Pro · payment_interval_monthly')).toBeNull();
    expect(view.getByText('payment_status_gift')).toBeTruthy();
    expect(view.queryByText('payment_status_ending')).toBeNull();
    expect(view.queryByText('payment_last_amount')).toBeNull();
    expect(view.getByText('payment_paid_until')).toBeTruthy();
  });

  it('says it ends at the end of the period when it will not renew', async () => {
    const view = await render(
      <PlanStatusCard subscription={subscription({ cancelAtPeriodEnd: true })} />,
    );

    expect(view.getByText('payment_status_ending')).toBeTruthy();
    expect(view.queryByText('payment_status_active')).toBeNull();
  });

  it('says the payment is due, and that the date was the one it was paid until', async () => {
    const view = await render(<PlanStatusCard subscription={subscription({ status: 'due' })} />);

    expect(view.getByText('payment_status_due')).toBeTruthy();
    expect(view.getByText('payment_paid_until_was')).toBeTruthy();
    expect(view.queryByText('payment_paid_until')).toBeNull();
  });
});
