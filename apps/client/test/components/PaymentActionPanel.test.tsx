const mockSetString = jest.fn();

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: (...args: unknown[]) => mockSetString(...args),
}));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      card: '#fff',
      text: '#111',
      textSecondary: '#555',
      error: '#f00',
      primary: '#00f',
      background: '#fff',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { fireEvent, render } from '@testing-library/react-native';
import PaymentActionPanel from '../../src/components/features/servers/PaymentActionPanel';

const checkout = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    status: 'pending',
    tierName: 'Pro',
    action: { kind: 'redirect', url: 'https://pay.example.test/c1' },
    failureReason: null,
    ...over,
  }) as never;

const panel = (props: Record<string, unknown>) => (
  <PaymentActionPanel
    phase="pending"
    checkout={checkout()}
    onOpenProviderPage={jest.fn()}
    onDone={jest.fn()}
    {...(props as object)}
  />
);

beforeEach(() => jest.clearAllMocks());

describe('PaymentActionPanel', () => {
  it('shows that the payment is starting', async () => {
    const view = await render(panel({ phase: 'starting', checkout: null }));

    expect(view.getByTestId('payment-panel-starting')).toBeTruthy();
    expect(view.getByText('payment_starting')).toBeTruthy();
  });

  it('sends the person to the provider’s page, and says the payment is confirmed by itself', async () => {
    const onOpen = jest.fn();
    const view = await render(panel({ onOpenProviderPage: onOpen }));

    await fireEvent.press(view.getByTestId('payment-open-provider'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(view.getByText('payment_redirect_message')).toBeTruthy();
    expect(view.getByText('payment_waiting_confirmation')).toBeTruthy();
  });

  it('shows instructions, with what to copy, and copies it', async () => {
    const view = await render(
      panel({
        checkout: checkout({
          action: {
            kind: 'instructions',
            title: 'Pay with PIX',
            text: 'Open your bank app.',
            copyText: '0002012658',
          },
        }),
      }),
    );

    expect(view.getByText('Pay with PIX')).toBeTruthy();
    expect(view.getByText('Open your bank app.')).toBeTruthy();
    expect(view.getByTestId('payment-copy-text').props.children).toBe('0002012658');
    expect(view.queryByTestId('payment-open-provider')).toBeNull();

    await fireEvent.press(view.getByTestId('payment-copy'));

    expect(mockSetString).toHaveBeenCalledWith('0002012658');
    expect(view.getByText('payment_copied')).toBeTruthy();
  });

  it('shows instructions that have nothing to copy', async () => {
    const view = await render(
      panel({
        checkout: checkout({ action: { kind: 'instructions', title: 'Boleto', text: 'Wait.' } }),
      }),
    );

    expect(view.getByText('Boleto')).toBeTruthy();
    expect(view.queryByTestId('payment-copy')).toBeNull();
  });

  it('says the provider will charge, for a payment that needs nothing from the person', async () => {
    const view = await render(panel({ checkout: checkout({ action: { kind: 'none' } }) }));

    expect(view.getByText('payment_automatic_message')).toBeTruthy();
  });

  it('lets the person leave a pending payment to choose another', async () => {
    const onDone = jest.fn();
    const view = await render(panel({ onDone }));

    await fireEvent.press(view.getByTestId('payment-cancel-attempt'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('says the plan is active once it is paid, and finishes', async () => {
    const onDone = jest.fn();
    const view = await render(panel({ phase: 'paid', onDone }));

    expect(view.getByText('payment_paid_title')).toBeTruthy();
    await fireEvent.press(view.getByTestId('payment-done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['failed', 'payment_failed_title', 'payment_failed_message'],
    ['expired', 'payment_expired_title', 'payment_expired_message'],
  ])(
    'says when it %s, with the provider’s reason, and offers to try again',
    async (phase, title, message) => {
      const onDone = jest.fn();
      const view = await render(
        panel({
          phase,
          onDone,
          checkout: checkout({ status: phase, failureReason: 'Card declined' }),
        }),
      );

      expect(view.getByText(title)).toBeTruthy();
      expect(view.getByText(message)).toBeTruthy();
      expect(view.getByText('Card declined')).toBeTruthy();
      await fireEvent.press(view.getByTestId('payment-try-again'));
      expect(onDone).toHaveBeenCalledTimes(1);
    },
  );
});
