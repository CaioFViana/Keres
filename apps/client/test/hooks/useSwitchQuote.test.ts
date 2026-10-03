const mockQuote = jest.fn();

jest.mock('../../src/services/PaymentService', () => ({
  __esModule: true,
  getSwitchQuote: (...args: unknown[]) => mockQuote(...args),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useSwitchQuote } from '../../src/hooks/useSwitchQuote';

const server = { id: 'server-1' } as never;
const quote = { fromTierName: 'Plus', toTierName: 'Max', remainingDays: 20, convertedDays: 7 };

beforeEach(() => {
  jest.clearAllMocks();
  mockQuote.mockResolvedValue(quote);
});

describe('useSwitchQuote', () => {
  it('asks only when there is a running plan to change and a choice to ask about', async () => {
    await renderHook(() => useSwitchQuote(server, 'tier-2', 'monthly', false));
    await renderHook(() => useSwitchQuote(server, null, 'monthly', true));
    await renderHook(() => useSwitchQuote(server, 'tier-2', null, true));
    await renderHook(() => useSwitchQuote(undefined, 'tier-2', 'monthly', true));

    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('says what the server answered for the choice that was made', async () => {
    const { result } = await renderHook(() => useSwitchQuote(server, 'tier-2', 'monthly', true));

    await act(async () => {});

    expect(mockQuote).toHaveBeenCalledWith(server, 'tier-2', 'monthly');
    expect(result.current).toEqual(quote);
  });

  it('shows nothing for a choice it has not heard about yet, and asks again when the choice changes', async () => {
    const { result, rerender } = await renderHook(
      (props: { tier: string }) => useSwitchQuote(server, props.tier, 'monthly', true),
      { initialProps: { tier: 'tier-2' } },
    );
    await act(async () => {});
    expect(result.current).toEqual(quote);

    mockQuote.mockImplementationOnce(() => new Promise(() => {}));
    await rerender({ tier: 'tier-3' });

    expect(result.current).toBeNull();
    expect(mockQuote).toHaveBeenLastCalledWith(server, 'tier-3', 'monthly');
  });

  it('does not show an answer that arrives after the choice moved on', async () => {
    let release: (value: unknown) => void = () => {};
    mockQuote.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { result, rerender } = await renderHook(
      (props: { tier: string }) => useSwitchQuote(server, props.tier, 'monthly', true),
      { initialProps: { tier: 'tier-2' } },
    );

    mockQuote.mockResolvedValueOnce(null);
    await rerender({ tier: 'tier-3' });
    await act(async () => {
      release(quote);
    });

    expect(result.current).toBeNull();
  });

  it('shows nothing, and does not fail the screen, when the server cannot be asked', async () => {
    mockQuote.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useSwitchQuote(server, 'tier-2', 'monthly', true));

    await act(async () => {});

    expect(result.current).toBeNull();
  });

  it('stops showing it once the plan being changed is gone', async () => {
    const { result, rerender } = await renderHook(
      (props: { on: boolean }) => useSwitchQuote(server, 'tier-2', 'monthly', props.on),
      { initialProps: { on: true } },
    );
    await act(async () => {});
    expect(result.current).toEqual(quote);

    await rerender({ on: false });

    expect(result.current).toBeNull();
  });
});
