const mockT = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;
const mockGoBack = jest.fn();
const mockNavigation = { goBack: (...args: unknown[]) => mockGoBack(...args) };
const mockRoute = { params: { serverId: 'srv-1' } };
const mockStatuses = jest.fn();
const mockOverview = jest.fn();
const mockCheckout = jest.fn();
const mockCancelRenewal = jest.fn();
const mockReload = jest.fn();
const mockStart = jest.fn();
const mockStartNative = jest.fn();
const mockReset = jest.fn();
const mockOpenProviderPage = jest.fn();
const mockAskCancel = jest.fn();
const mockSwitchQuote = jest.fn();
const mockColors = {
  primary: '#0000ff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  card: '#fafafa',
  border: '#cccccc',
  error: '#ff0000',
  surface: '#f5f5f5',
  onPrimary: '#ffffff',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
}));
jest.mock('expo-clipboard', () => ({ __esModule: true, setStringAsync: jest.fn() }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useIsFocused: () => true,
}));
jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return { ...actual, useTheme: () => ({ isDarkMode: false, colors: mockColors }) };
});
jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));
jest.mock('../../../src/hooks/useServerStatuses', () => ({
  useServerStatuses: (...args: unknown[]) => mockStatuses(...args),
}));
jest.mock('../../../src/hooks/usePaymentOverview', () => ({
  usePaymentOverview: (...args: unknown[]) => mockOverview(...args),
}));
jest.mock('../../../src/hooks/usePlanCheckout', () => ({
  usePlanCheckout: (...args: unknown[]) => mockCheckout(...args),
}));
jest.mock('../../../src/hooks/useSwitchQuote', () => ({
  useSwitchQuote: (...args: unknown[]) => mockSwitchQuote(...args),
}));
jest.mock('../../../src/hooks/usePlanCancellation', () => ({
  usePlanCancellation: (...args: unknown[]) => mockCancelRenewal(...args),
}));
jest.mock('../../../src/services/PaymentService', () => ({
  __esModule: true,
  verifyPlayPurchase: jest.fn().mockResolvedValue({ active: false, subscription: null }),
}));
// The device filter defaults to the web build here, so the redirect methods show;
// one test below switches it to a phone without a purchase runtime.
jest.mock('../../../src/utils/paymentMethodVisibility', () => {
  const actual = jest.requireActual('../../../src/utils/paymentMethodVisibility');
  return { ...actual, devicePaymentCapabilities: jest.fn() };
});

import { fireEvent, render } from '@testing-library/react-native';
import ServerPlanScreen from '../../../src/screens/enterstack/ServerPlanScreen';
import { devicePaymentCapabilities } from '../../../src/utils/paymentMethodVisibility';

const mockDeviceCaps = devicePaymentCapabilities as jest.Mock;

const server = { id: 'srv-1', name: 'Main', url: 'https://a.example', pingStatus: 'online' };
const tier = (over: Record<string, unknown>) => ({
  id: 'tier-pro',
  name: 'Pro',
  isDefault: false,
  priceMonthlyCents: 1990,
  priceYearlyCents: 19900,
  maxStories: 50,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: 5000,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: null,
  ...over,
});
const subscription = (over: Record<string, unknown> = {}) => ({
  tierId: 'tier-pro',
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
});
const overview = (
  over: Record<string, unknown> = {},
  subscriptionValue: unknown = null,
  plansOver: Record<string, unknown> | null = null,
) => ({
  info: {
    enabled: true,
    provider: { id: 'fakepay', displayName: 'Fake Pay' },
    currency: 'BRL',
    methods: [
      { id: 'card', label: 'Card' },
      { id: 'pix', label: 'PIX' },
    ],
    subscription: subscriptionValue,
    ...over,
  },
  plans: {
    currency: 'BRL',
    tiers: [
      tier({}),
      tier({ id: 'tier-free', name: 'Free', priceMonthlyCents: 0, priceYearlyCents: null }),
      tier({
        id: 'tier-plus',
        name: 'Plus',
        priceMonthlyCents: 990,
        priceYearlyCents: null,
        maxStories: null,
      }),
    ],
    ...plansOver,
  },
});

const setup = (
  options: {
    statuses?: unknown;
    overviewValue?: unknown;
    overviewLoading?: boolean;
    checkout?: Record<string, unknown>;
  } = {},
) => {
  mockStatuses.mockReturnValue(
    options.statuses ?? { servers: [server], loading: false, error: null, updateTag: jest.fn() },
  );
  mockOverview.mockReturnValue({
    overview: options.overviewValue === undefined ? overview() : options.overviewValue,
    loading: options.overviewLoading ?? false,
    reload: mockReload,
  });
  mockCheckout.mockReturnValue({
    checkout: null,
    phase: 'idle',
    error: null,
    start: mockStart,
    startNative: mockStartNative,
    paidPlanName: null,
    openProviderPage: mockOpenProviderPage,
    reset: mockReset,
    ...options.checkout,
  });
  mockCancelRenewal.mockReturnValue(mockAskCancel);
  mockSwitchQuote.mockReturnValue(null);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDeviceCaps.mockReturnValue({ flavor: 'web', platform: 'web', nativePay: false });
  setup();
});

describe('ServerPlanScreen: when there is nothing to show', () => {
  it('shows the servers loading, and the error when the server cannot be found', async () => {
    setup({ statuses: { servers: [], loading: true, error: null } });
    const loading = await render(<ServerPlanScreen />);
    expect(loading.getByText('loading_servers')).toBeTruthy();

    setup({ statuses: { servers: [], loading: false, error: 'servers broke' } });
    const failed = await render(<ServerPlanScreen />);
    expect(failed.getByText('servers broke')).toBeTruthy();
  });

  it('asks for the server to be reachable, and asks the payment hook for nothing then', async () => {
    setup({
      statuses: { servers: [{ ...server, pingStatus: 'offline' }], loading: false, error: null },
    });

    const view = await render(<ServerPlanScreen />);

    expect(view.getByTestId('plan-offline')).toBeTruthy();
    expect(mockOverview.mock.calls[0][1]).toBe(false);
  });

  it('says a server that sells no plans does not, and shows loading while it finds out', async () => {
    setup({ overviewValue: null });
    const view = await render(<ServerPlanScreen />);
    expect(view.getByTestId('plan-not-sold')).toBeTruthy();

    setup({ overviewValue: null, overviewLoading: true });
    const loading = await render(<ServerPlanScreen />);
    expect(loading.getByText('payment_loading')).toBeTruthy();
  });
});

describe('ServerPlanScreen: the plans', () => {
  it('names who takes the payments, and lists the plans on sale with their prices and limits', async () => {
    const view = await render(<ServerPlanScreen />);

    expect(view.getByText('payment_provider_intro:{"name":"Fake Pay"}')).toBeTruthy();
    expect(view.getByTestId('plan-offer-tier-pro')).toBeTruthy();
    expect(view.getByTestId('plan-offer-tier-plus')).toBeTruthy();
    // The free plan is not for sale.
    expect(view.queryByTestId('plan-offer-tier-free')).toBeNull();
    expect(view.getByText(/R\$19\.90 \/ payment_per_monthly/)).toBeTruthy();
    expect(view.getByText(/R\$199\.00 \/ payment_per_yearly/)).toBeTruthy();
    expect(view.getByText('plan_limit_stories_other:{"count":50}')).toBeTruthy();
    expect(view.getByText('plan_limit_stories_unlimited')).toBeTruthy();
    expect(view.getAllByText('plan_limit_entities_other:{"count":5000}')).toHaveLength(2);
  });

  it('says so when no plan is on sale', async () => {
    setup({ overviewValue: { ...overview(), plans: { currency: 'BRL', tiers: [] } } });

    const view = await render(<ServerPlanScreen />);

    expect(view.getByTestId('plan-no-offers')).toBeTruthy();
  });

  it('shows the interval and method only once a plan is chosen, and says no card is typed here', async () => {
    const view = await render(<ServerPlanScreen />);
    expect(view.queryByTestId('plan-pay')).toBeNull();

    await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));

    expect(view.getByTestId('plan-interval-monthly')).toBeTruthy();
    expect(view.getByTestId('plan-interval-yearly')).toBeTruthy();
    expect(view.getByTestId('plan-method-card')).toBeTruthy();
    expect(view.getByTestId('plan-method-pix')).toBeTruthy();
    expect(view.getByText('payment_privacy_note')).toBeTruthy();
  });

  it('offers only the intervals a plan is sold in, and keeps the interval when the next plan has it', async () => {
    const view = await render(<ServerPlanScreen />);

    await fireEvent.press(view.getByTestId('plan-offer-tier-plus'));
    expect(view.getByTestId('plan-interval-monthly')).toBeTruthy();
    expect(view.queryByTestId('plan-interval-yearly')).toBeNull();

    await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));
    await fireEvent.press(view.getByTestId('plan-interval-yearly'));
    await fireEvent.press(view.getByTestId('plan-offer-tier-plus'));
    // Plus has no yearly price: it falls back to the interval it has.
    expect(view.getByText(/payment_pay_amount.*R\$9\.90/)).toBeTruthy();
  });

  it('pays only once a method is chosen, for the plan, interval and method picked', async () => {
    const view = await render(<ServerPlanScreen />);
    await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));
    await fireEvent.press(view.getByTestId('plan-interval-yearly'));

    await fireEvent.press(view.getByTestId('plan-pay'));
    expect(mockStart).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('plan-method-pix'));
    expect(view.getByText(/payment_pay_amount.*R\$199\.00/)).toBeTruthy();
    await fireEvent.press(view.getByTestId('plan-pay'));

    expect(mockStart).toHaveBeenCalledWith({
      tierId: 'tier-pro',
      interval: 'yearly',
      methodId: 'pix',
    });
  });

  it('says the methods are unavailable on a device that cannot run any of them', async () => {
    mockDeviceCaps.mockReturnValue({ flavor: 'native', platform: 'android', nativePay: false });
    const view = await render(<ServerPlanScreen />);
    await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));

    expect(view.getByText('payment_no_methods_device')).toBeTruthy();
    expect(view.queryByTestId('plan-method-card')).toBeNull();
    expect(view.queryByTestId('plan-method-pix')).toBeNull();
  });

  it('buys through the store on Android, with the product selling the plan', async () => {
    mockDeviceCaps.mockReturnValue({ flavor: 'native', platform: 'android', nativePay: true });
    setup({
      overviewValue: overview(
        {
          methods: [{ id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' }],
        },
        null,
        {
          tiers: [
            tier({ playMonthlyProductId: 'plus_monthly', playYearlyProductId: 'plus_yearly' }),
          ],
        },
      ),
    });
    const view = await render(<ServerPlanScreen />);
    await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));
    await fireEvent.press(view.getByTestId('plan-method-playbilling'));
    await fireEvent.press(view.getByTestId('plan-pay'));

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockStartNative).toHaveBeenCalledWith({
      tierId: 'tier-pro',
      interval: 'monthly',
      methodId: 'playbilling',
      productId: 'plus_monthly',
      packageName: '',
      planName: 'Pro',
      tiers: [tier({ playMonthlyProductId: 'plus_monthly', playYearlyProductId: 'plus_yearly' })],
    });
  });

  it('says no method sells the plan when the plan is not sold on the web', async () => {
    setup({
      overviewValue: overview({}, null, {
        tiers: [tier({ webMonthlyEnabled: false, webYearlyEnabled: true })],
      }),
    });
    const view = await render(<ServerPlanScreen />);
    await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));

    expect(view.getByText('payment_no_methods_plan')).toBeTruthy();
    expect(view.queryByTestId('plan-method-card')).toBeNull();
    expect(view.queryByTestId('plan-method-pix')).toBeNull();
  });

  it('says so when the server has no payment method, and shows why a payment could not start', async () => {
    setup({
      overviewValue: overview({ methods: [] }),
      checkout: { error: 'payment_error_start_failed' },
    });
    const view = await render(<ServerPlanScreen />);
    await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));

    expect(view.getByText('payment_no_methods')).toBeTruthy();
    expect(view.getByText('payment_error_start_failed')).toBeTruthy();
  });
});

describe('ServerPlanScreen: paying', () => {
  it('shows what to do next instead of the plans while a payment is open, and comes back when done', async () => {
    setup({
      checkout: {
        phase: 'pending',
        checkout: {
          id: 'c1',
          status: 'pending',
          tierName: 'Pro',
          action: { kind: 'redirect', url: 'https://pay.example.test/c1' },
        },
      },
    });
    const view = await render(<ServerPlanScreen />);

    expect(view.getByTestId('payment-panel-pending')).toBeTruthy();
    expect(view.queryByTestId('plan-offer-tier-pro')).toBeNull();

    await fireEvent.press(view.getByTestId('payment-open-provider'));
    expect(mockOpenProviderPage).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByTestId('payment-cancel-attempt'));
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});

describe('ServerPlanScreen: the current plan', () => {
  it('shows the plan and its dates, and offers to stop renewing', async () => {
    setup({ overviewValue: overview({}, subscription()) });

    const view = await render(<ServerPlanScreen />);

    expect(view.getByText('payment_current_plan')).toBeTruthy();
    expect(view.getByTestId('plan-status-card')).toBeTruthy();
    await fireEvent.press(view.getByTestId('plan-cancel-renewal'));
    expect(mockAskCancel).toHaveBeenCalledWith('2026-04-03T12:00:00.000Z', true);
    expect(view.queryByTestId('plan-not-renewing')).toBeNull();
  });

  it('says the date it ends, and offers nothing to stop, when it will not renew', async () => {
    setup({ overviewValue: overview({}, subscription({ cancelAtPeriodEnd: true })) });

    const view = await render(<ServerPlanScreen />);

    expect(view.getByTestId('plan-not-renewing')).toBeTruthy();
    expect(view.queryByTestId('plan-cancel-renewal')).toBeNull();
    expect(view.queryByTestId('plan-cancel-at-provider')).toBeNull();
  });

  it('says the renewal is stopped at the provider when the plugin cannot do it from here', async () => {
    setup({ overviewValue: overview({}, subscription({ canCancelHere: false })) });

    const view = await render(<ServerPlanScreen />);

    expect(view.getByTestId('plan-cancel-at-provider')).toBeTruthy();
    expect(view.queryByTestId('plan-cancel-renewal')).toBeNull();
  });

  describe('a method the person pays again each time (PIX, boleto)', () => {
    const manual = (over: Record<string, unknown> = {}) =>
      overview({}, subscription({ autoRenews: false, ...over }));

    it('says it does not renew by itself, with the date to pay before, instead of offering to stop a renewal', async () => {
      setup({ overviewValue: manual({ canCancelHere: false }) });

      const view = await render(<ServerPlanScreen />);

      expect(view.getByTestId('plan-manual-renewal')).toBeTruthy();
      expect(view.getByText('payment_cancel_no_renewal')).toBeTruthy();
      expect(view.queryByText('payment_cancel_renewal')).toBeNull();
      // There is nothing at the provider to stop: it is not sent there.
      expect(view.queryByTestId('plan-cancel-at-provider')).toBeNull();
    });

    it('lets the person say they will not renew, and the confirmation is told so', async () => {
      setup({ overviewValue: manual() });

      const view = await render(<ServerPlanScreen />);
      await fireEvent.press(view.getByTestId('plan-cancel-renewal'));

      expect(mockAskCancel).toHaveBeenCalledWith('2026-04-03T12:00:00.000Z', false);
    });

    it('has no reminder to pay again once the person said they will not', async () => {
      setup({ overviewValue: manual({ cancelAtPeriodEnd: true }) });

      const view = await render(<ServerPlanScreen />);

      expect(view.queryByTestId('plan-manual-renewal')).toBeNull();
      expect(view.queryByTestId('plan-cancel-renewal')).toBeNull();
      expect(view.getByTestId('plan-not-renewing')).toBeTruthy();
    });

    it('says nothing of paying again for a plan that is already late', async () => {
      setup({ overviewValue: manual({ status: 'due' }) });

      const view = await render(<ServerPlanScreen />);

      expect(view.queryByTestId('plan-manual-renewal')).toBeNull();
      expect(view.queryByTestId('plan-cancel-renewal')).toBeNull();
    });
  });

  describe('a plan the administrators gave', () => {
    const gift = (over: Record<string, unknown> = {}) =>
      subscription({
        complimentary: true,
        cancelAtPeriodEnd: true,
        autoRenews: false,
        canCancelHere: false,
        amountCents: 0,
        ...over,
      });

    it('says it is a gift until its date, with nothing to stop and no talk of renewing', async () => {
      setup({ overviewValue: overview({}, gift()) });

      const view = await render(<ServerPlanScreen />);

      expect(view.getByTestId('plan-gift')).toBeTruthy();
      expect(view.getByText('payment_status_gift')).toBeTruthy();
      expect(view.queryByTestId('plan-not-renewing')).toBeNull();
      expect(view.queryByTestId('plan-cancel-renewal')).toBeNull();
      expect(view.queryByTestId('plan-manual-renewal')).toBeNull();
      expect(view.queryByTestId('plan-cancel-at-provider')).toBeNull();
      // It can still be paid for, which is what keeps a plan after it.
      expect(view.getByTestId('plan-offer-tier-pro')).toBeTruthy();
    });

    it('says nothing of a gift for a plan that is paid for', async () => {
      setup({ overviewValue: overview({}, subscription()) });

      const view = await render(<ServerPlanScreen />);

      expect(view.queryByTestId('plan-gift')).toBeNull();
    });
  });

  describe('changing plan while time is left', () => {
    const quote = { fromTierName: 'Pro', toTierName: 'Plus', remainingDays: 20, convertedDays: 7 };

    it('says what the days left would become, before paying, once another plan is chosen', async () => {
      setup({
        overviewValue: overview({}, subscription({ tierId: 'tier-pro' })),
      });
      mockSwitchQuote.mockReturnValue(quote);

      const view = await render(<ServerPlanScreen />);
      await fireEvent.press(view.getByTestId('plan-offer-tier-plus'));

      const note = view.getByTestId('plan-switch-quote').props.children as string;
      expect(note).toContain('payment_switch_quote');
      expect(note).toContain('"current":"Pro"');
      expect(note).toContain('"plan":"Plus"');
    });

    it('asks about the plan that was chosen, only while the subscription is running and the plan is another one', async () => {
      setup({ overviewValue: overview({}, subscription({ tierId: 'tier-pro' })) });
      const view = await render(<ServerPlanScreen />);

      // Nothing chosen yet: nothing to ask about.
      expect(mockSwitchQuote).toHaveBeenLastCalledWith(expect.anything(), null, null, false);

      await fireEvent.press(view.getByTestId('plan-offer-tier-plus'));
      expect(mockSwitchQuote).toHaveBeenLastCalledWith(
        expect.anything(),
        'tier-plus',
        'monthly',
        true,
      );

      // The plan already on: nothing converts.
      await fireEvent.press(view.getByTestId('plan-offer-tier-pro'));
      expect(mockSwitchQuote).toHaveBeenLastCalledWith(
        expect.anything(),
        'tier-pro',
        'monthly',
        false,
      );
    });

    it('does not ask, and says nothing, for a subscription that is not running', async () => {
      setup({
        overviewValue: overview({}, subscription({ tierId: 'tier-pro', status: 'due' })),
      });
      const view = await render(<ServerPlanScreen />);
      await fireEvent.press(view.getByTestId('plan-offer-tier-plus'));

      expect(mockSwitchQuote).toHaveBeenLastCalledWith(
        expect.anything(),
        'tier-plus',
        'monthly',
        false,
      );
      expect(view.queryByTestId('plan-switch-quote')).toBeNull();
    });
  });

  it('reads a server that does not say whether it renews as one that does', async () => {
    const { autoRenews: _omitted, ...legacy } = subscription();
    setup({ overviewValue: overview({}, legacy) });

    const view = await render(<ServerPlanScreen />);

    expect(view.queryByTestId('plan-manual-renewal')).toBeNull();
    await fireEvent.press(view.getByTestId('plan-cancel-renewal'));
    expect(mockAskCancel).toHaveBeenCalledWith('2026-04-03T12:00:00.000Z', true);
  });

  it('shows a due plan with its dates and nothing to cancel, and still offers to pay', async () => {
    setup({ overviewValue: overview({}, subscription({ status: 'due' })) });

    const view = await render(<ServerPlanScreen />);

    expect(view.getByText('payment_status_due')).toBeTruthy();
    // It says the user is on the default plan meanwhile, so a late payment does not read as a loss.
    expect(view.getByTestId('plan-due-fallback')).toBeTruthy();
    expect(view.queryByTestId('plan-cancel-renewal')).toBeNull();
    expect(view.getByTestId('plan-offer-tier-pro')).toBeTruthy();
  });

  it('shows no current plan for a user who has none', async () => {
    const view = await render(<ServerPlanScreen />);

    expect(view.queryByTestId('plan-due-fallback')).toBeNull();
    expect(view.queryByText('payment_current_plan')).toBeNull();
    expect(view.queryByTestId('plan-status-card')).toBeNull();
  });
});
