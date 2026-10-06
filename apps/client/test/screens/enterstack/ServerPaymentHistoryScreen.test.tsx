const mockT = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;
const mockGoBack = jest.fn();
const mockNavigation = { goBack: (...args: unknown[]) => mockGoBack(...args) };
const mockRoute = { params: { serverId: 'srv-1' } };
const mockStatuses = jest.fn();
const mockHistory = jest.fn();
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
jest.mock('../../../src/hooks/usePaymentHistory', () => ({
  usePaymentHistory: (...args: unknown[]) => mockHistory(...args),
}));

import { render } from '@testing-library/react-native';
import ServerPaymentHistoryScreen from '../../../src/screens/enterstack/ServerPaymentHistoryScreen';

const has = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const server = { id: 'srv-1', name: 'Main', url: 'https://a.example', pingStatus: 'online' };
const row = (over: Record<string, unknown> = {}) => ({
  id: '01HPAYMENT0000000000000001',
  serverId: 'srv-1',
  kind: 'payment_succeeded',
  tierName: 'Pro',
  amountCents: 2500,
  currency: 'BRL',
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  ...over,
});
const history = (over: Record<string, unknown> = {}) => ({
  items: [row()],
  loaded: true,
  refreshing: false,
  failed: false,
  stale: false,
  refresh: jest.fn(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStatuses.mockReturnValue({ servers: [server], loading: false, error: null });
  mockHistory.mockReturnValue(history());
});

describe('ServerPaymentHistoryScreen', () => {
  it("shows each payment: the plan, what it was, when, how much, and the server's own id", async () => {
    mockHistory.mockReturnValue(
      history({
        items: [
          row(),
          row({
            id: '01HPAYMENT0000000000000002',
            kind: 'gift_granted',
            amountCents: 0,
            createdAt: new Date('2026-09-01T12:00:00.000Z'),
          }),
          row({
            id: '01HPAYMENT0000000000000003',
            kind: 'payment_failed',
            amountCents: null,
            currency: null,
          }),
        ],
      }),
    );
    const view = await render(<ServerPaymentHistoryScreen />);

    const paid = view.getByTestId('payment-history-01HPAYMENT0000000000000001');
    expect(paid).toHaveTextContent(has('Pro'));
    expect(paid).toHaveTextContent(has('payment_history_kind_payment_succeeded'));
    expect(paid).toHaveTextContent(has('25.00'));
    expect(paid).toHaveTextContent(has('payment_history_id:{"id":"01HPAYMENT0000000000000001"}'));
    // A plan given shows no amount (it was free); a failure shows none either.
    const gift = view.getByTestId('payment-history-01HPAYMENT0000000000000002');
    expect(gift).toHaveTextContent(has('payment_history_kind_gift_granted'));
    expect(gift).not.toHaveTextContent(has('0.00'));
    expect(view.getByTestId('payment-history-01HPAYMENT0000000000000003')).toHaveTextContent(
      has('payment_history_kind_payment_failed'),
    );
    expect(view.queryByTestId('payment-history-empty')).toBeNull();
  });

  it('shows a refund as money that went back: the amount with a minus, named as a refund', async () => {
    mockHistory.mockReturnValue(
      history({
        items: [
          row({ id: '01HPAYMENT0000000000000009', kind: 'payment_refunded', amountCents: 2500 }),
        ],
      }),
    );
    const view = await render(<ServerPaymentHistoryScreen />);

    const refunded = view.getByTestId('payment-history-01HPAYMENT0000000000000009');
    expect(refunded).toHaveTextContent(has('payment_history_kind_payment_refunded'));
    expect(refunded).toHaveTextContent(has('-R$'));
    expect(refunded).toHaveTextContent(has('25.00'));
  });

  it('says there is nothing yet', async () => {
    mockHistory.mockReturnValue(history({ items: [] }));
    const view = await render(<ServerPaymentHistoryScreen />);

    expect(view.getByTestId('payment-history-empty')).toBeTruthy();
  });

  it('says what is on screen is the saved copy while the server cannot be asked', async () => {
    mockStatuses.mockReturnValue({
      servers: [{ ...server, pingStatus: 'offline' }],
      loading: false,
      error: null,
    });
    mockHistory.mockReturnValue(history({ stale: true }));
    const view = await render(<ServerPaymentHistoryScreen />);

    expect(view.getByTestId('payment-history-saved-copy')).toBeTruthy();
    // Still readable: the copy on the device is shown, not an error.
    expect(view.getByTestId('payment-history-01HPAYMENT0000000000000001')).toBeTruthy();
    expect(mockHistory).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-1' }), false);
  });

  it('does not show the saved-copy note while it is up to date', async () => {
    const view = await render(<ServerPaymentHistoryScreen />);

    expect(view.queryByTestId('payment-history-saved-copy')).toBeNull();
  });

  it('waits for the saved copy before saying anything, and reports a server that is not there', async () => {
    mockHistory.mockReturnValue(history({ loaded: false }));
    const loading = await render(<ServerPaymentHistoryScreen />);
    expect(loading.queryByTestId('payment-history-empty')).toBeNull();

    mockStatuses.mockReturnValue({ servers: [], loading: false, error: null });
    const missing = await render(<ServerPaymentHistoryScreen />);
    expect(missing.getByText('server_not_found')).toBeTruthy();
  });
});
