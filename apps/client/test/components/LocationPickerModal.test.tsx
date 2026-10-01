import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import LocationPickerModal from '../../src/components/features/relations/LocationRelationManager/LocationPickerModal';
import type { LocationSelect } from '../../src/db/schema';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactActual.createElement(View, null, children) : null,
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) =>
      ReactActual.createElement(Text, { testID: `button-${String(children)}`, onPress }, children),
  };
});

const location = (overrides: Partial<LocationSelect> = {}): LocationSelect =>
  ({
    id: 'loc-1',
    storyId: 'story-1',
    name: 'Harbor',
    ...overrides,
  }) as LocationSelect;

describe('LocationPickerModal', () => {
  it('renders nothing while hidden', async () => {
    const screen = await render(
      <LocationPickerModal
        isVisible={false}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        title="Pick one"
        candidates={[]}
      />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it('lists the candidates alphabetically under the given title', async () => {
    const screen = await render(
      <LocationPickerModal
        isVisible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        title="Pick one"
        candidates={[location({ id: 'b', name: 'Zeta' }), location({ id: 'a', name: 'Alpha' })]}
      />,
    );

    expect(screen.getByText('Pick one')).toBeTruthy();
    const names = screen.container
      .queryAll((node) => node.type === 'Text' || node.type === 'RCTText')
      .map((node) => node.props.children)
      .filter((child: unknown) => child === 'Alpha' || child === 'Zeta');
    expect(names).toEqual(['Alpha', 'Zeta']);
  });

  it('hands the tapped location back', async () => {
    const onSelect = jest.fn();
    const screen = await render(
      <LocationPickerModal
        isVisible
        onClose={jest.fn()}
        onSelect={onSelect}
        title="Pick one"
        candidates={[location({ id: 'a', name: 'Alpha' })]}
      />,
    );

    await fireEvent.press(screen.getByText('Alpha').parent!);

    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('says so when there is nobody to pick', async () => {
    const screen = await render(
      <LocationPickerModal
        isVisible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        title="Pick one"
        candidates={[]}
      />,
    );

    expect(screen.getByText('no_locations_available')).toBeTruthy();
  });

  it('closes without choosing', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <LocationPickerModal
        isVisible
        onClose={onClose}
        onSelect={jest.fn()}
        title="Pick one"
        candidates={[]}
      />,
    );

    await fireEvent.press(screen.getByTestId('button-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
