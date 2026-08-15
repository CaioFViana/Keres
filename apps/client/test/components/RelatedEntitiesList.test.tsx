import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import RelatedEntitiesList from '../../src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      primary: '#00f',
      shadow: '#000',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGetParent = jest.fn();
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ getParent: mockGetParent }),
}));

const mockNavigateToEntityDetail = jest.fn();
jest.mock('../../src/utils/entityNavigation', () => ({
  __esModule: true,
  ...jest.requireActual('../../src/utils/entityNavigation'),
  navigateToEntityDetail: (...args: unknown[]) => mockNavigateToEntityDetail(...args),
}));

const drawerNavigation = { navigate: jest.fn() };

beforeEach(() => {
  mockNavigateToEntityDetail.mockClear();
  mockGetParent.mockReturnValue(drawerNavigation);
});

describe('RelatedEntitiesList', () => {
  it('navigates to the entity behind a tagged row', async () => {
    const screen = await render(
      <RelatedEntitiesList
        title="Tagged"
        noItemsMessage="none"
        groupedEntities={{ character: [{ id: 'char-1', name: 'Atena' }] }}
      />,
    );

    await fireEvent.press(screen.getByText('Tagged'));
    await fireEvent.press(screen.getByTestId('related-entity-char-1'));

    expect(mockNavigateToEntityDetail).toHaveBeenCalledWith(drawerNavigation, 'Character', 'char-1');
  });

  it('maps every lowercase relation key back to its navigable type', async () => {
    const screen = await render(
      <RelatedEntitiesList
        title="Tagged"
        noItemsMessage="none"
        groupedEntities={{
          worldrule: [{ id: 'rule-1', name: 'Gravity' }],
          itemjourney: [{ id: 'journey-1', name: 'The sword moves' }],
        }}
      />,
    );

    await fireEvent.press(screen.getByText('Tagged'));

    await fireEvent.press(screen.getByTestId('related-entity-rule-1'));
    expect(mockNavigateToEntityDetail).toHaveBeenCalledWith(drawerNavigation, 'WorldRule', 'rule-1');

    await fireEvent.press(screen.getByTestId('related-entity-journey-1'));
    expect(mockNavigateToEntityDetail).toHaveBeenCalledWith(
      drawerNavigation,
      'ItemJourney',
      'journey-1',
    );
  });

  it('leaves rows without a detail screen as plain text', async () => {
    const screen = await render(
      <RelatedEntitiesList
        title="Tagged"
        noItemsMessage="none"
        groupedEntities={{
          // Junction rows and `user` have no Detail screen to open.
          characterscene: [{ id: 'cs-1', name: 'Atena in scene 3' }],
          user: [{ id: 'user-1', name: 'Caio' }],
        }}
      />,
    );

    await fireEvent.press(screen.getByText('Tagged'));

    expect(screen.getByText('Atena in scene 3')).toBeTruthy();
    expect(screen.queryByTestId('related-entity-cs-1')).toBeNull();
    expect(screen.queryByTestId('related-entity-user-1')).toBeNull();
  });

  it('shows the empty message when nothing references it', async () => {
    const screen = await render(
      <RelatedEntitiesList
        title="Tagged"
        noItemsMessage="no_entities_tagged"
        groupedEntities={{ character: [], scene: [] }}
      />,
    );

    await fireEvent.press(screen.getByText('Tagged'));
    expect(screen.getByText('no_entities_tagged')).toBeTruthy();
  });
});
