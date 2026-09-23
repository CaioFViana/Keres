import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { CANVAS_ACTION_ROW_HEIGHT } from '../../src/components/features/graphs/CanvasActionBar/CanvasActionBar';
import OverlayDrawBar from '../../src/components/features/graphs/CanvasOverlay/OverlayDrawBar';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
      border: '#444',
      primary: '#9b5cff',
    },
  }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: jest.fn(() => ({
    width: 390,
    height: 844,
    breakpoint: 'compact',
    isCompact: true,
    isMedium: false,
    isWide: false,
  })),
}));

import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';

const mockLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;
const compactLayout = {
  width: 390,
  height: 844,
  breakpoint: 'compact' as const,
  isCompact: true,
  isMedium: false,
  isWide: false,
};
const wideLayout = {
  width: 1200,
  height: 800,
  breakpoint: 'wide' as const,
  isCompact: false,
  isMedium: false,
  isWide: true,
};

describe('OverlayDrawBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLayout.mockReturnValue(compactLayout);
  });

  it('shows finish only for the multi-tap tools', async () => {
    const props = { canFinish: true, onFinish: jest.fn(), onCancel: jest.fn() };
    const line = await render(<OverlayDrawBar tool="line" {...props} />);
    expect(line.getByText('overlay_draw_line_hint')).toBeTruthy();
    expect(line.getByLabelText('overlay_draw_finish')).toBeTruthy();

    const rect = await render(<OverlayDrawBar tool="rect" {...props} />);
    expect(rect.getByText('overlay_draw_rect_hint')).toBeTruthy();
    expect(rect.queryByLabelText('overlay_draw_finish')).toBeNull();

    const stamp = await render(<OverlayDrawBar tool="stamp" {...props} />);
    expect(stamp.getByText('overlay_draw_stamp_hint')).toBeTruthy();
    expect(stamp.queryByLabelText('overlay_draw_finish')).toBeNull();

    const preset = await render(<OverlayDrawBar tool="preset:star" {...props} />);
    expect(preset.getByText('overlay_draw_rect_hint')).toBeTruthy();
    expect(preset.queryByLabelText('overlay_draw_finish')).toBeNull();
  });

  it('finishes and cancels through the icon buttons', async () => {
    const onFinish = jest.fn();
    const onCancel = jest.fn();
    const view = await render(
      <OverlayDrawBar tool="polygon" canFinish onFinish={onFinish} onCancel={onCancel} />,
    );
    expect(view.getByText('overlay_draw_polygon_hint')).toBeTruthy();
    await fireEvent.press(view.getByTestId('overlay-draw-finish'));
    expect(onFinish).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('overlay-draw-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps finish disabled until the draft can commit', async () => {
    const onFinish = jest.fn();
    const view = await render(
      <OverlayDrawBar tool="line" canFinish={false} onFinish={onFinish} onCancel={jest.fn()} />,
    );
    await fireEvent.press(view.getByTestId('overlay-draw-finish'));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('puts the hint on its own second line on compact screens', async () => {
    mockLayout.mockReturnValue(compactLayout);
    const view = await render(
      <OverlayDrawBar tool="polygon" canFinish onFinish={jest.fn()} onCancel={jest.fn()} />,
    );

    const hint = view.getByText('overlay_draw_polygon_hint');
    const cancel = view.getByTestId('overlay-draw-cancel');
    expect(hint.parent).not.toBe(cancel.parent);
    expect(cancel.parent?.children).toHaveLength(2);
    // The hint line matches one action row, so swapping tools never pops the canvas.
    expect(StyleSheet.flatten(hint.parent?.props.style).minHeight).toBe(CANVAS_ACTION_ROW_HEIGHT);
  });

  it('keeps a single row on medium and wide screens', async () => {
    mockLayout.mockReturnValue(wideLayout);
    const view = await render(
      <OverlayDrawBar tool="polygon" canFinish onFinish={jest.fn()} onCancel={jest.fn()} />,
    );

    const hint = view.getByText('overlay_draw_polygon_hint');
    const cancel = view.getByTestId('overlay-draw-cancel');
    expect(hint.parent).toBe(cancel.parent);
  });
});
