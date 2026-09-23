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
    }) => <Text testID="sheet-color" onPress={() => onSelectColor('#f00')}>{currentColor}</Text>,
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

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
    await fireEvent.changeText(view.getByPlaceholderText('overlay_sheet_label_placeholder'), 'Mordor');
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
});
