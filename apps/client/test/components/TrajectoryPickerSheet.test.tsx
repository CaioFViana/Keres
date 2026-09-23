import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import TrajectoryPickerSheet from '../../src/components/features/location-maps/TrajectoryPickerSheet';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
      border: '#444',
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
jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: ({ value, onValueChange }: any) => (
      <Text testID="route-pill" onPress={() => onValueChange('route-2')}>
        {value}
      </Text>
    ),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('TrajectoryPickerSheet', () => {
  it('toggles entities, picks routes on branching stories, and clears', async () => {
    const callbacks = {
      onToggleCharacter: jest.fn(),
      onToggleItem: jest.fn(),
      onSelectRoute: jest.fn(),
      onClear: jest.fn(),
      onClose: jest.fn(),
    };
    const view = await render(
      <TrajectoryPickerSheet
        characters={[{ id: 'char-1', name: 'Aragorn' }]}
        items={[{ id: 'item-1', name: 'Sword' }]}
        routes={[{ id: 'route-1', name: 'Main' }]}
        storyType="branching"
        selectedCharacterIds={['char-1']}
        selectedItemIds={[]}
        routeId="route-1"
        {...callbacks}
      />,
    );

    await fireEvent.press(view.getByTestId('trajectory-character-char-1'));
    expect(callbacks.onToggleCharacter).toHaveBeenCalledWith('char-1');
    await fireEvent.press(view.getByTestId('trajectory-item-item-1'));
    expect(callbacks.onToggleItem).toHaveBeenCalledWith('item-1');
    await fireEvent.press(view.getByTestId('route-pill'));
    expect(callbacks.onSelectRoute).toHaveBeenCalledWith('route-2');
    await fireEvent.press(view.getByText('trajectory_clear'));
    expect(callbacks.onClear).toHaveBeenCalledTimes(1);
  });

  it('hides the route picker on linear stories and explains empty catalogs', async () => {
    const view = await render(
      <TrajectoryPickerSheet
        characters={[]}
        items={[]}
        routes={[]}
        storyType="linear"
        selectedCharacterIds={[]}
        selectedItemIds={[]}
        routeId={null}
        onToggleCharacter={jest.fn()}
        onToggleItem={jest.fn()}
        onSelectRoute={jest.fn()}
        onClear={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(view.queryByTestId('route-pill')).toBeNull();
    expect(view.getByText('trajectory_no_characters')).toBeTruthy();
    expect(view.getByText('trajectory_no_items')).toBeTruthy();
  });
});
