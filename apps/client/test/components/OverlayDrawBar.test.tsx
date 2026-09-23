import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import OverlayDrawBar from '../../src/components/features/graphs/CanvasOverlay/OverlayDrawBar';

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
    default: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Text onPress={disabled ? undefined : onPress}>{children}</Text>
    ),
  };
});

describe('OverlayDrawBar', () => {
  it('shows finish only for the multi-tap tools', async () => {
    const props = { canFinish: true, onFinish: jest.fn(), onCancel: jest.fn() };
    const line = await render(<OverlayDrawBar tool="line" {...props} />);
    expect(line.getByText('overlay_draw_line_hint')).toBeTruthy();
    expect(line.getByText('overlay_draw_finish')).toBeTruthy();

    const rect = await render(<OverlayDrawBar tool="rect" {...props} />);
    expect(rect.getByText('overlay_draw_rect_hint')).toBeTruthy();
    expect(rect.queryByText('overlay_draw_finish')).toBeNull();

    const stamp = await render(<OverlayDrawBar tool="stamp" {...props} />);
    expect(stamp.getByText('overlay_draw_stamp_hint')).toBeTruthy();
    expect(stamp.queryByText('overlay_draw_finish')).toBeNull();
  });

  it('finishes and cancels through the buttons', async () => {
    const onFinish = jest.fn();
    const onCancel = jest.fn();
    const view = await render(
      <OverlayDrawBar tool="polygon" canFinish onFinish={onFinish} onCancel={onCancel} />,
    );
    expect(view.getByText('overlay_draw_polygon_hint')).toBeTruthy();
    await fireEvent.press(view.getByText('overlay_draw_finish'));
    expect(onFinish).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByText('overlay_draw_cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
