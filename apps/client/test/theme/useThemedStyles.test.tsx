import { renderHook } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockUseTheme = jest.fn();
jest.mock('../../src/theme', () => ({ useTheme: () => mockUseTheme() }));

import { useThemedStyles } from '../../src/theme/useThemedStyles';

const light = { text: '#111111' };
const dark = { text: '#eeeeee' };

const createStyles = jest.fn((colors: { text: string }) =>
  StyleSheet.create({ label: { color: colors.text } }),
);
const createSized = (colors: { text: string }, [compact]: [boolean]) =>
  StyleSheet.create({ label: { color: colors.text, fontSize: compact ? 12 : 16 } });

describe('useThemedStyles', () => {
  beforeEach(() => {
    createStyles.mockClear();
    mockUseTheme.mockReturnValue({ colors: light });
  });

  it('builds the styles from the palette, once, and keeps them while the palette stays', async () => {
    const { result, rerender } = await renderHook(() => useThemedStyles(createStyles as never));

    const first = result.current;
    await rerender({});
    await rerender({});

    expect((first as { label: { color: string } }).label.color).toBe('#111111');
    expect(result.current).toBe(first);
    expect(createStyles).toHaveBeenCalledTimes(1);
  });

  it('builds them again when the palette changes', async () => {
    const { result, rerender } = await renderHook(() => useThemedStyles(createStyles as never));
    mockUseTheme.mockReturnValue({ colors: dark });
    await rerender({});

    expect((result.current as { label: { color: string } }).label.color).toBe('#eeeeee');
    expect(createStyles).toHaveBeenCalledTimes(2);
  });

  it('builds them again when one of the extra values changes, passing them to the factory', async () => {
    let compact = true;
    const { result, rerender } = await renderHook(() =>
      useThemedStyles(createSized as never, [compact]),
    );
    expect((result.current as { label: { fontSize: number } }).label.fontSize).toBe(12);

    compact = false;
    await rerender({});
    expect((result.current as { label: { fontSize: number } }).label.fontSize).toBe(16);
  });

  it('keeps object values by identity and refuses more than five extra values', async () => {
    const metrics = { size: 4 };
    const factory = jest.fn((colors: { text: string }, [m]: [{ size: number }]) =>
      StyleSheet.create({ box: { color: colors.text, width: m.size } }),
    );
    const { rerender } = await renderHook(() => useThemedStyles(factory as never, [metrics]));
    await rerender({});
    expect(factory).toHaveBeenCalledTimes(1);

    const tooMany = () => useThemedStyles(createStyles as never, [1, 2, 3, 4, 5, 6] as never);
    await expect(renderHook(tooMany)).rejects.toThrow('at most 5');
  });
});
