import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import OverlaySheet from '../../src/components/features/graphs/CanvasOverlay/OverlaySheet';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
      border: '#444',
      error: '#c33',
      primary: '#85f',
    },
  }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock(
  '../../src/components/layout/ResponsiveModal/ResponsiveModal',
  () =>
    function MockResponsiveModal({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    },
);
jest.mock('../../src/components/common/controls/Button/Button', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  };
});
jest.mock('../../src/components/common/inputs/ColorPickerInput/ColorPickerInput', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      currentColor,
      onSelectColor,
    }: {
      currentColor: string;
      onSelectColor: (color: string) => void;
    }) => (
      <Text testID="sheet-color" onPress={() => onSelectColor('#f00')}>
        {currentColor}
      </Text>
    ),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../src/components/common/forms/FormSwitchField/FormSwitchField', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onValueChange,
    }: {
      label: string;
      value: boolean;
      onValueChange: (value: boolean) => void;
    }) => (
      <Text testID={`sheet-switch-${label}`} onPress={() => onValueChange(!value)}>
        {String(value)}
      </Text>
    ),
  };
});
jest.mock('../../src/components/common/inputs/IconPickerInput/IconPickerInput', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      currentIcon,
      onSelectIcon,
    }: {
      currentIcon: string | null;
      onSelectIcon: (icon: string) => void;
    }) => (
      <Text testID="sheet-icon" onPress={() => onSelectIcon('castle')}>
        {currentIcon}
      </Text>
    ),
  };
});

describe('OverlaySheet', () => {
  it('edits label and color, and removes on request', async () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <OverlaySheet
        overlay={{ id: 'ov-1', kind: 'polygon', points: [] }}
        canEdit
        defaultColor="#85f"
        onChange={onChange}
        onRemove={onRemove}
        onClose={onClose}
      />,
    );

    expect(view.getByText('overlay_kind_polygon')).toBeTruthy();
    await fireEvent.changeText(
      view.getByPlaceholderText('overlay_sheet_label_placeholder'),
      'Mordor',
    );
    expect(onChange).toHaveBeenCalledWith({ label: 'Mordor' });
    // The picker previews the surface default while the overlay sets no color.
    expect(view.getByTestId('sheet-color').props.children).toBe('#85f');
    await fireEvent.press(view.getByTestId('sheet-color'));
    expect(onChange).toHaveBeenCalledWith({ color: '#f00' });
    await fireEvent.press(view.getByText('overlay_sheet_remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('hides editing controls from readers', async () => {
    const view = await render(
      <OverlaySheet
        overlay={{ id: 'ov-1', kind: 'line', points: [], label: 'Trail' }}
        canEdit={false}
        defaultColor="#85f"
        onChange={jest.fn()}
        onRemove={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(view.queryByTestId('sheet-color')).toBeNull();
    expect(view.queryByText('overlay_sheet_remove')).toBeNull();
  });

  it('shows the icon picker for stamps only', async () => {
    const onChange = jest.fn();
    const props = {
      canEdit: true,
      defaultColor: '#85f',
      onChange,
      onRemove: jest.fn(),
      onClose: jest.fn(),
    };
    const stamp = await render(
      <OverlaySheet overlay={{ id: 'ov-1', kind: 'stamp', x: 0, y: 0, icon: 'flag' }} {...props} />,
    );
    expect(stamp.getByTestId('sheet-icon').props.children).toBe('flag');
    await fireEvent.press(stamp.getByTestId('sheet-icon'));
    expect(onChange).toHaveBeenCalledWith({ icon: 'castle' });

    const line = await render(
      <OverlaySheet overlay={{ id: 'ov-2', kind: 'line', points: [] }} {...props} />,
    );
    expect(line.queryByTestId('sheet-icon')).toBeNull();
    expect(line.queryByText('overlay_sheet_icon')).toBeNull();
  });

  it('toggles fill and dash per kind, frames dashed by default', async () => {
    const onChange = jest.fn();
    const props = {
      canEdit: true,
      defaultColor: '#85f',
      onChange,
      onRemove: jest.fn(),
      onClose: jest.fn(),
    };
    const polygon = await render(
      <OverlaySheet overlay={{ id: 'ov-1', kind: 'polygon', points: [] }} {...props} />,
    );
    expect(polygon.getByTestId('sheet-switch-overlay_sheet_filled').props.children).toBe('false');
    await fireEvent.press(polygon.getByTestId('sheet-switch-overlay_sheet_filled'));
    expect(onChange).toHaveBeenCalledWith({ filled: true });
    await fireEvent.press(polygon.getByTestId('sheet-switch-overlay_sheet_dashed'));
    expect(onChange).toHaveBeenCalledWith({ dashed: true });

    const frame = await render(
      <OverlaySheet
        overlay={{ id: 'ov-2', kind: 'frame', x: 0, y: 0, width: 10, height: 10 }}
        {...props}
      />,
    );
    expect(frame.getByTestId('sheet-switch-overlay_sheet_dashed').props.children).toBe('true');
    expect(frame.getByTestId('sheet-switch-overlay_sheet_filled')).toBeTruthy();

    const line = await render(
      <OverlaySheet overlay={{ id: 'ov-3', kind: 'line', points: [] }} {...props} />,
    );
    expect(line.getByTestId('sheet-switch-overlay_sheet_dashed')).toBeTruthy();
    expect(line.queryByTestId('sheet-switch-overlay_sheet_filled')).toBeNull();

    const stamp = await render(
      <OverlaySheet overlay={{ id: 'ov-4', kind: 'stamp', x: 0, y: 0, icon: 'flag' }} {...props} />,
    );
    expect(stamp.queryByTestId('sheet-switch-overlay_sheet_dashed')).toBeNull();
    expect(stamp.queryByTestId('sheet-switch-overlay_sheet_filled')).toBeNull();
  });
});
