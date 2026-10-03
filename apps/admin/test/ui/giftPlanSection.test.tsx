import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GiftPlanSection } from '../../src/pages/users/GiftPlanSection';
import { changeInput, click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({ userSubscription: vi.fn(), giveGift: vi.fn() }));

vi.mock('../../src/api/PaymentsApiService', () => ({
  PaymentsApiService: { userSubscription: mocks.userSubscription, giveGift: mocks.giveGift },
}));

const tiers = [
  { id: 'tier-plus', name: 'Plus' },
  { id: 'tier-max', name: 'Max' },
] as never;

const subscription = (over: Record<string, unknown> = {}) => ({
  user: null,
  tierId: 'tier-plus',
  tierName: 'Plus',
  interval: 'monthly',
  status: 'active',
  paidUntil: '2026-04-03T10:00:00.000Z',
  lastPaymentAt: null,
  amountCents: 2500,
  currency: 'BRL',
  cancelAtPeriodEnd: false,
  providerId: 'fakepay',
  providerReference: 'sub_1',
  createdAt: '2026-03-03T10:00:00.000Z',
  ...over,
});

const answer = (sub: unknown, canCancelAtProvider = true) => ({
  subscription: sub,
  canCancelAtProvider,
});

async function renderSection() {
  const view = await render(<GiftPlanSection userId="user-1" username="ana" tiers={tiers} />);
  await flush();
  return view;
}

const select = (view: { container: HTMLDivElement }) =>
  view.container.querySelector('select') as HTMLSelectElement;
const months = (view: { container: HTMLDivElement }) =>
  view.container.querySelector('input[type="number"]') as HTMLInputElement;
const button = (view: { container: HTMLDivElement }) =>
  view.container.querySelector('button') as HTMLButtonElement;
const current = (view: { container: HTMLDivElement }) =>
  view.container.querySelector('[data-testid="gift-current"]')?.textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userSubscription.mockResolvedValue(answer(null, false));
  mocks.giveGift.mockResolvedValue(
    answer(subscription({ tierId: 'tier-max', providerId: 'admin' })),
  );
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('what it says of the person’s subscription', () => {
  it('says there is none', async () => {
    const view = await renderSection();

    expect(current(view)).toContain('no subscription');
    await view.unmount();
  });

  it.each([
    ['one that renews', {}, 'It renews'],
    ['one that does not', { cancelAtPeriodEnd: true }, 'does not renew'],
    ['a gift', { providerId: 'admin', providerReference: null, cancelAtPeriodEnd: true }, 'a gift'],
  ])('describes %s', async (_label, over, words) => {
    mocks.userSubscription.mockResolvedValue(answer(subscription(over)));
    const view = await renderSection();

    expect(current(view)).toContain('Plus');
    expect(current(view)).toContain('Paid up');
    expect(current(view)).toContain(words);
    await view.unmount();
  });

  it('reports a subscription that could not be read', async () => {
    mocks.userSubscription.mockRejectedValue(new Error('server down'));
    const view = await renderSection();

    expect(view.container.textContent).toContain('server down');
    await view.unmount();
  });
});

describe('giving a plan', () => {
  it('waits for a plan, and for months within what can be given', async () => {
    const view = await renderSection();
    expect(button(view).disabled).toBe(true);

    await changeInput(select(view), 'tier-max');
    expect(button(view).disabled).toBe(false);

    await changeInput(months(view), '0');
    expect(button(view).disabled).toBe(true);
    await changeInput(months(view), '25');
    expect(button(view).disabled).toBe(true);
    await changeInput(months(view), '3');
    expect(button(view).disabled).toBe(false);
    await view.unmount();
  });

  it('asks first, gives the plan, and says until when', async () => {
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');
    await changeInput(months(view), '2');

    await click(button(view));
    await flush();

    expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('2 month(s) of Max to ana');
    expect(mocks.giveGift).toHaveBeenCalledWith('user-1', { tierId: 'tier-max', months: 2 });
    expect(view.container.querySelector('[data-testid="gift-done"]')?.textContent).toContain(
      'Gave 2 month(s) of Max to ana',
    );
    // What it shows now is what the server answered.
    expect(current(view)).toContain('a gift');
    await view.unmount();
  });

  it('gives nothing when the administrator backs out', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');

    await click(button(view));

    expect(mocks.giveGift).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('shows what the server refused with', async () => {
    mocks.giveGift.mockRejectedValue(new Error('Plan not found.'));
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');

    await click(button(view));
    await flush();

    expect(view.container.textContent).toContain('Plan not found.');
    expect(view.container.querySelector('[data-testid="gift-done"]')).toBeNull();
    await view.unmount();
  });

  it('extends the plan the person has without cancelling anything', async () => {
    mocks.userSubscription.mockResolvedValue(answer(subscription()));
    const view = await renderSection();
    await changeInput(select(view), 'tier-plus');

    expect(view.container.querySelector('[data-testid="gift-needs-cancel"]')).toBeNull();
    expect(button(view).textContent).toBe('Give');
    await click(button(view));
    await flush();

    expect(mocks.giveGift).toHaveBeenCalledWith('user-1', { tierId: 'tier-plus', months: 1 });
    await view.unmount();
  });
});

describe('another plan for somebody a provider is still charging', () => {
  beforeEach(() => {
    mocks.userSubscription.mockResolvedValue(answer(subscription()));
  });

  it('says the renewal has to be cancelled first, and the button says so', async () => {
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');

    const warning = view.container.querySelector('[data-testid="gift-needs-cancel"]');
    expect(warning?.getAttribute('role')).toBe('alert');
    expect(warning?.textContent).toContain('still being charged');
    expect(warning?.textContent).not.toContain('cannot cancel at the provider');
    expect(button(view).textContent).toBe('Cancel their renewal and give');
    await view.unmount();
  });

  it('wants the administrator’s confirmation that the person agreed, in so many words, before cancelling', async () => {
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');
    await changeInput(months(view), '1');

    await click(button(view));
    await flush();

    const question = vi.mocked(window.confirm).mock.calls[0][0];
    expect(question).toContain('ana agreed to cancel the renewal of their Plus subscription');
    expect(question).toContain('1 month(s) of Max as a gift');
    expect(question).not.toContain('provider has stopped');
    expect(mocks.giveGift).toHaveBeenCalledWith('user-1', {
      tierId: 'tier-max',
      months: 1,
      cancelRenewal: true,
      consent: true,
    });
  });

  it('cancels nothing when the confirmation is refused', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');

    await click(button(view));

    expect(mocks.giveGift).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('also asks for the word that the provider stopped charging when the plugin cannot do it', async () => {
    mocks.userSubscription.mockResolvedValue(answer(subscription(), false));
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');

    expect(
      view.container.querySelector('[data-testid="gift-needs-cancel"]')?.textContent,
    ).toContain('cannot cancel at the provider');
    await click(button(view));
    await flush();

    expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('provider has stopped charging');
    await view.unmount();
  });

  it.each([
    ['one already not renewing', { cancelAtPeriodEnd: true }],
    ['a gift', { providerId: 'admin', providerReference: null }],
    ['one that ended', { status: 'canceled' }],
  ])('needs no cancelling for %s', async (_label, over) => {
    mocks.userSubscription.mockResolvedValue(answer(subscription(over)));
    const view = await renderSection();
    await changeInput(select(view), 'tier-max');

    expect(view.container.querySelector('[data-testid="gift-needs-cancel"]')).toBeNull();
    expect(button(view).textContent).toBe('Give');
    await view.unmount();
  });
});
