import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PaymentsPage } from '../../src/pages/payments/PaymentsPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  subscriptions: vi.fn(),
  events: vi.fn(),
}));

vi.mock('../../src/api/PaymentsApiService', () => ({
  PaymentsApiService: {
    summary: mocks.summary,
    subscriptions: mocks.subscriptions,
    events: mocks.events,
  },
}));

const ana = { id: 'user-1', username: 'ana', tag: 'ana_s', isDeleted: false };
const bia = { id: 'user-2', username: 'bia', tag: 'bia', isDeleted: true };

const subscription = (over: Record<string, unknown> = {}) => ({
  user: ana,
  tierId: 'tier-1',
  tierName: 'Pro',
  interval: 'monthly',
  status: 'active',
  paidUntil: '2026-04-03T10:00:00.000Z',
  lastPaymentAt: '2026-03-03T10:00:00.000Z',
  amountCents: 1990,
  currency: 'BRL',
  cancelAtPeriodEnd: false,
  providerId: 'fakepay',
  providerReference: 'sub_ana',
  createdAt: '2026-03-03T10:00:00.000Z',
  ...over,
});

const ledger = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  kind: 'payment_succeeded',
  user: ana,
  tierName: 'Pro',
  amountCents: 1990,
  currency: 'BRL',
  providerId: 'fakepay',
  providerReference: 'sub_ana',
  detail: null,
  createdAt: '2026-03-03T10:00:00.000Z',
  ...over,
});

const page = (items: unknown[], total = items.length) => ({ items, total, page: 1, pageSize: 25 });

const summary = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  provider: { id: 'fakepay', displayName: 'Fake Pay' },
  currency: 'BRL',
  subscriptions: { active: 4, due: 2, canceled: 1 },
  endingSoon: 1,
  last30Days: { payments: 6, failures: 2, amountCents: 11940 },
  monthlyRecurringCents: 7960,
  noDefaultTier: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.summary.mockResolvedValue(summary());
  mocks.subscriptions.mockResolvedValue(page([subscription()]));
  mocks.events.mockResolvedValue(page([ledger()]));
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <PaymentsPage />
      </ThemeProvider>
    </MemoryRouter>,
  );

const cards = (view: Awaited<ReturnType<typeof renderPage>>) =>
  Array.from(view.container.querySelectorAll('.stat-card')).map((card) => card.textContent);

describe('payments page: the summary', () => {
  it('shows who is paid up, late or leaving and what came in, with warnings where it needs a look', async () => {
    const view = await renderPage();
    await flush();

    const text = cards(view);
    expect(text).toContain('4Paid up');
    expect(text).toContain('2Due');
    expect(text).toContain('1Ended');
    expect(text).toContain('1Ending in 5 days');
    expect(text.some((entry) => entry?.includes('119.40') && entry.includes('Received'))).toBe(
      true,
    );
    expect(text).toContain('6Payments, 30 days');
    expect(text).toContain('2Failures, 30 days');
    expect(view.container.querySelectorAll('.stat-card.is-warn')).toHaveLength(2);
    expect(view.container.querySelector('.stat-card.is-bad')?.textContent).toContain('2');
    expect(view.container.textContent).toContain('Payments are taken by Fake Pay.');
  });

  it('has no warning marks when nothing needs attention', async () => {
    mocks.summary.mockResolvedValue(
      summary({
        subscriptions: { active: 4, due: 0, canceled: 0 },
        endingSoon: 0,
        last30Days: { payments: 6, failures: 0, amountCents: 100 },
      }),
    );
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.stat-card.is-warn')).toBeNull();
    expect(view.container.querySelector('.stat-card.is-bad')).toBeNull();
  });

  it('says there is no payment connector, and that plans are then handed out by hand', async () => {
    mocks.summary.mockResolvedValue(summary({ enabled: false, provider: null }));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      'no payment connector',
    );
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      'PAYMENT_CONNECTOR_URL',
    );
    expect(view.container.textContent).not.toContain('Payments are taken by');
  });

  it('warns that the server has no default plan, and says what that costs', async () => {
    mocks.summary.mockResolvedValue(summary({ noDefaultTier: true }));
    const view = await renderPage();
    await flush();

    const warning = view.container.querySelector('[data-testid="no-default-tier"]');
    expect(warning?.getAttribute('role')).toBe('alert');
    expect(warning?.textContent).toContain('no default plan');
    expect(warning?.textContent).toContain('no limits');
  });

  it('says nothing of a default plan when there is one', async () => {
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('[data-testid="no-default-tier"]')).toBeNull();
  });

  it('shows the error when the summary cannot be read, and carries on with the list', async () => {
    mocks.summary.mockRejectedValue(new Error('summary down'));
    const view = await renderPage();
    await flush();

    expect(view.container.textContent).toContain('summary down');
    expect(view.container.querySelector('table')).not.toBeNull();
  });
});

describe('payments page: subscriptions', () => {
  it('lists the situation and the key values, nearest end of period as the server sorts them', async () => {
    mocks.subscriptions.mockResolvedValue(
      page([
        subscription(),
        subscription({
          user: bia,
          status: 'due',
          interval: 'yearly',
          amountCents: 19900,
          cancelAtPeriodEnd: true,
          lastPaymentAt: null,
          providerReference: null,
        }),
        subscription({ user: null, cancelAtPeriodEnd: true, providerReference: 'sub_x' }),
      ]),
    );
    const view = await renderPage();
    await flush();

    const rows = Array.from(view.container.querySelectorAll('tbody tr')).map(
      (row) => row.textContent,
    );
    expect(rows[0]).toContain('@ana_s');
    expect(rows[0]).toContain('Pro');
    expect(rows[0]).toContain('monthly');
    expect(rows[0]).toContain('Paid up');
    expect(rows[0]).toContain('19.90');
    expect(rows[0]).toContain('fakepay');
    expect(rows[0]).toContain('sub_ana');
    expect(rows[1]).toContain('Due');
    expect(rows[1]).toContain('yearly');
    expect(rows[1]).toContain('(account closed)');
    // A closed account is not a link; a live one is.
    expect(view.container.querySelector('a[href="/users/user-1"]')).not.toBeNull();
    expect(view.container.querySelector('a[href="/users/user-2"]')).toBeNull();
    // "Will not renew" only means something while it is still paid up.
    expect(rows[0]).not.toContain('will not renew');
    expect(rows[1]).not.toContain('will not renew');
    expect(rows[2]).toContain('will not renew');
    expect(rows[2]).toContain('-');
    expect(view.container.querySelector('.subscription-due')).not.toBeNull();
  });

  it('says so when there is nothing for the filters', async () => {
    mocks.subscriptions.mockResolvedValue(page([]));
    const view = await renderPage();
    await flush();

    expect(view.container.textContent).toContain('No subscriptions for these filters.');
  });

  it('searches and filters by status, from the first page', async () => {
    const view = await renderPage();
    await flush();
    const form = view.container.querySelector('form.toolbar') as HTMLFormElement;
    const [input] = Array.from(form.querySelectorAll('input'));
    const select = form.querySelector('select') as HTMLSelectElement;

    await changeInput(input, '  sub_ana ');
    await submit(form);
    await flush();
    expect(mocks.subscriptions.mock.calls.at(-1)![0]).toMatchObject({
      search: 'sub_ana',
      page: 1,
      status: 'all',
    });

    await changeInput(select, 'due');
    await flush();
    expect(mocks.subscriptions.mock.calls.at(-1)![0]).toMatchObject({ status: 'due', page: 1 });
  });

  it('pages through the list', async () => {
    mocks.subscriptions.mockResolvedValue(page([subscription()], 60));
    const view = await renderPage();
    await flush();
    const buttons = Array.from(view.container.querySelectorAll('.pagination button'));

    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    await click(buttons[1]);
    await flush();

    expect(mocks.subscriptions.mock.calls.at(-1)![0]).toMatchObject({ page: 2 });
    expect(view.container.querySelector('.pagination')!.textContent).toContain('2');
  });

  it('goes back a page', async () => {
    mocks.subscriptions.mockResolvedValue(page([subscription()], 60));
    const view = await renderPage();
    await flush();
    const buttons = () => Array.from(view.container.querySelectorAll('.pagination button'));

    await click(buttons()[1]);
    await flush();
    await click(buttons()[0]);
    await flush();

    expect(mocks.subscriptions.mock.calls.at(-1)![0]).toMatchObject({ page: 1 });
  });

  it('does not touch the page after it was left, whatever the server answers late', async () => {
    let releaseSummary!: (value: unknown) => void;
    let releaseList!: (value: unknown) => void;
    mocks.summary.mockImplementation(() => new Promise((resolve) => (releaseSummary = resolve)));
    mocks.subscriptions.mockImplementation(() => new Promise((resolve) => (releaseList = resolve)));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = await renderPage();
    await view.unmount();

    releaseSummary(summary());
    releaseList(page([subscription()]));
    await flush();

    // Nothing tried to update a page that is gone.
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('does not show the error of a request that was left behind either', async () => {
    let failSummary!: (reason: unknown) => void;
    let failList!: (reason: unknown) => void;
    mocks.summary.mockImplementation(() => new Promise((_, reject) => (failSummary = reject)));
    mocks.subscriptions.mockImplementation(() => new Promise((_, reject) => (failList = reject)));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = await renderPage();
    await view.unmount();

    failSummary(new Error('late summary'));
    failList(new Error('late list'));
    await flush();

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('says a plan given by an administrator is a gift, and not the id it is stored under', async () => {
    mocks.subscriptions.mockResolvedValue(
      page([subscription({ providerId: 'admin', providerReference: null, amountCents: 0 })]),
    );
    const view = await renderPage();
    await flush();

    const row = view.container.querySelector('tbody tr')?.textContent ?? '';
    expect(row).toContain('Gift (administrator)');
    expect(row).not.toContain('admin ');
  });

  it('shows the error when the list cannot be read', async () => {
    mocks.subscriptions.mockRejectedValue(new Error('list down'));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toContain('list down');
  });
});

describe('payments page: the ledger', () => {
  const openLedger = async () => {
    const view = await renderPage();
    await flush();
    const tab = Array.from(view.container.querySelectorAll('[role="tab"]')).find((entry) =>
      entry.textContent?.includes('Ledger'),
    ) as HTMLButtonElement;
    await click(tab);
    await flush();
    return view;
  };

  it('shows what the provider reported, with its references', async () => {
    mocks.events.mockResolvedValue(
      page([
        ledger(),
        ledger({
          id: 'ev-2',
          kind: 'payment_failed',
          user: bia,
          amountCents: null,
          currency: null,
          detail: 'Card declined',
          providerReference: null,
        }),
        ledger({ id: 'ev-3', kind: 'subscription_due', user: null, tierName: null }),
      ]),
    );
    const view = await openLedger();

    const rows = Array.from(view.container.querySelectorAll('tbody tr')).map(
      (row) => row.textContent,
    );
    expect(rows[0]).toContain('Payment received');
    expect(rows[0]).toContain('19.90');
    expect(rows[0]).toContain('sub_ana');
    expect(rows[1]).toContain('Payment failed');
    expect(rows[1]).toContain('Card declined');
    expect(rows[2]).toContain('Period ran out unpaid');
    expect(view.container.querySelector('.ledger-payment_failed')).not.toBeNull();
    // No search form here: the ledger is a plain, newest-first list.
    expect(view.container.querySelector('form.toolbar')).toBeNull();
    expect(mocks.events).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
  });

  it('says so when the provider has reported nothing, and goes back to the subscriptions', async () => {
    mocks.events.mockResolvedValue(page([]));
    const view = await openLedger();

    expect(view.container.textContent).toContain('Nothing reported by the provider yet.');
    const tab = Array.from(view.container.querySelectorAll('[role="tab"]')).find((entry) =>
      entry.textContent?.includes('Subscriptions'),
    ) as HTMLButtonElement;
    await click(tab);
    await flush();
    expect(view.container.querySelector('form.toolbar')).not.toBeNull();
  });

  it('shows the error when the ledger cannot be read', async () => {
    mocks.events.mockRejectedValue(new Error('ledger down'));
    const view = await openLedger();

    expect(view.container.querySelector('.error-text')?.textContent).toContain('ledger down');
  });
});

describe('payments page: money', () => {
  it('falls back to a plain amount for a currency the browser does not know', async () => {
    mocks.subscriptions.mockResolvedValue(page([subscription({ currency: 'ZZZZZ' })]));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('tbody')!.textContent).toContain('19.90 ZZZZZ');
  });
});
