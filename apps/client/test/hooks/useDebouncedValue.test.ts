import { act, renderHook } from '@testing-library/react-native';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDebouncedValue', () => {
  it('starts with the value and follows it only after it has stopped changing', async () => {
    const { result, rerender } = await renderHook(
      (value: string) => useDebouncedValue(value, 300),
      {
        initialProps: 'a',
      },
    );
    expect(result.current).toBe('a');

    await rerender('ab');
    await rerender('abc');
    await act(async () => jest.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    await act(async () => jest.advanceTimersByTime(2));
    expect(result.current).toBe('abc');
  });

  it('does not set a state when the value comes back to what was settled', async () => {
    const { result, rerender } = await renderHook(
      (value: string) => useDebouncedValue(value, 100),
      {
        initialProps: 'a',
      },
    );

    await rerender('b');
    await rerender('a');
    await act(async () => jest.advanceTimersByTime(500));

    expect(result.current).toBe('a');
  });
});
