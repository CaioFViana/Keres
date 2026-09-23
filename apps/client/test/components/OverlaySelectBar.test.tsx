import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import OverlaySelectBar from '../../src/components/features/graphs/CanvasOverlay/OverlaySelectBar';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { surface: '#111', textSecondary: '#aaa', border: '#444' },
  }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../src/components/common/controls/Button/Button', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  };
});

describe('OverlaySelectBar', () => {
  it('shows the hint and exits through Done', async () => {
    const onDone = jest.fn();
    const view = await render(<OverlaySelectBar onDone={onDone} />);

    expect(view.getByText('overlay_select_hint')).toBeTruthy();
    await fireEvent.press(view.getByText('overlay_select_done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
