import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import ResponsiveModal from '../../../src/components/layout/ResponsiveModal/ResponsiveModal';

const mockKeyboard = { overlap: 0, calls: [] as boolean[] };
jest.mock('../../../src/hooks/useKeyboardOverlap', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  return {
    __esModule: true,
    KeyboardHandledContext: React.createContext(false),
    useKeyboardOverlap: (active: boolean) => {
      mockKeyboard.calls.push(active);
      return { ref: { current: null }, overlap: mockKeyboard.overlap, onLayout: jest.fn() };
    },
  };
});
jest.mock('../../../src/theme', () => ({
  useTheme: () => ({ colors: { background: '#fff' } }),
}));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: true, isWide: false }),
}));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

const overlayPadding = (screen: Awaited<ReturnType<typeof render>>) =>
  StyleSheet.flatten(screen.getByText('composer').parent!.parent!.props.style).paddingBottom;

describe('ResponsiveModal keyboard avoidance', () => {
  beforeEach(() => {
    mockKeyboard.overlap = 0;
    mockKeyboard.calls = [];
  });

  it('keeps clear of the system bar alone while the keyboard is down', async () => {
    const screen = await render(
      <ResponsiveModal visible onClose={() => {}} placement="bottom">
        <Text>composer</Text>
      </ResponsiveModal>,
    );

    expect(overlayPadding(screen)).toBe(20);
  });

  it('lifts the surface by what the keyboard covers, instead of adding to the system bar', async () => {
    mockKeyboard.overlap = 300;
    const screen = await render(
      <ResponsiveModal visible onClose={() => {}} placement="bottom">
        <Text>composer</Text>
      </ResponsiveModal>,
    );

    expect(overlayPadding(screen)).toBe(300);
  });

  it('only watches the keyboard while open, and not at all when switched off', async () => {
    await render(
      <ResponsiveModal visible onClose={() => {}}>
        <Text>composer</Text>
      </ResponsiveModal>,
    );
    expect(mockKeyboard.calls.at(-1)).toBe(true);

    await render(
      <ResponsiveModal visible onClose={() => {}} keyboardAvoiding={false}>
        <Text>composer</Text>
      </ResponsiveModal>,
    );
    expect(mockKeyboard.calls.at(-1)).toBe(false);

    await render(
      <ResponsiveModal visible={false} onClose={() => {}}>
        <Text>composer</Text>
      </ResponsiveModal>,
    );
    expect(mockKeyboard.calls.at(-1)).toBe(false);
  });
});
