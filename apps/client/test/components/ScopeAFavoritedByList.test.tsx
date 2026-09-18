import { render } from '@testing-library/react-native';
import React from 'react';
import FavoritedByList from '../../src/components/features/favorites/FavoritedByList/FavoritedByList';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { primary: '#00f', surface: '#fff', text: '#111', textSecondary: '#555' },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/components/common/display/CollapsibleCard/CollapsibleCard', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <RN.View testID="collapsible-card" title={title}>
        {children}
      </RN.View>
    ),
  };
});

const mockRelationList = jest.fn();
jest.mock('../../src/components/common/display/EntityRelationList/EntityRelationList', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: { items: { id: string; title: string }[]; emptyText: string }) => {
      mockRelationList(props);
      return (
        <RN.View testID="relation-list">
          {props.items.length === 0 ? (
            <RN.Text>{props.emptyText}</RN.Text>
          ) : (
            props.items.map((item) => <RN.Text key={item.id}>{item.title}</RN.Text>)
          )}
        </RN.View>
      );
    },
  };
});

jest.mock('../../src/components/common/display/Avatar/Avatar', () => () => null);

const mockUseFavoriters = jest.fn();
jest.mock('../../src/hooks/useFavoriters', () => ({
  useFavoriters: (...args: unknown[]) => mockUseFavoriters(...args),
}));

beforeEach(() => jest.clearAllMocks());

describe('FavoritedByList', () => {
  it('renders nothing when the roster is private', async () => {
    mockUseFavoriters.mockReturnValue({ isPublic: false, profiles: [], loading: false });
    const view = await render(
      <FavoritedByList storyId="story-1" entityId="scene-1" entityType="Scene" />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('renders nothing while a private roster loads', async () => {
    mockUseFavoriters.mockReturnValue({ isPublic: false, profiles: [], loading: true });
    const view = await render(
      <FavoritedByList storyId="story-1" entityId="scene-1" entityType="Scene" />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('shows a spinner while a public roster loads', async () => {
    mockUseFavoriters.mockReturnValue({ isPublic: true, profiles: [], loading: true });
    const view = await render(
      <FavoritedByList storyId="story-1" entityId="scene-1" entityType="Scene" />,
    );

    expect(view.getByTestId('collapsible-card').props.title).toBe('favorited_by (0)');
    expect(view.container.queryAll((node: any) => node.type === 'ActivityIndicator')).toHaveLength(
      1,
    );
  });

  it('lists who starred the entity, marking the reader', async () => {
    mockUseFavoriters.mockReturnValue({
      isPublic: true,
      profiles: [
        { id: 'user-1', name: 'Ari', avatarColor: '#f00', avatarIcon: null, isCurrentUser: true },
        { id: 'user-2', name: 'Bex', avatarColor: null, avatarIcon: null, isCurrentUser: false },
      ],
      loading: false,
    });
    const view = await render(
      <FavoritedByList storyId="story-1" entityId="scene-1" entityType="Scene" />,
    );

    expect(mockUseFavoriters).toHaveBeenCalledWith('story-1', 'scene-1', 'Scene');
    expect(view.getByTestId('collapsible-card').props.title).toBe('favorited_by (2)');
    expect(view.getByText('Ari you_suffix')).toBeTruthy();
    expect(view.getByText('Bex')).toBeTruthy();

    const props = mockRelationList.mock.calls[0][0] as {
      items: { id: string; icon: string; color: string; leading: React.ReactNode }[];
      emptyText: string;
    };
    expect(props.emptyText).toBe('favorited_by_empty');
    expect(props.items.map((item) => item.icon)).toEqual(['person', 'person']);
    expect(props.items[0].color).toBe('#f00');
    expect(props.items[1].color).toBe('#00f');
    expect(props.items[0].leading).toBeTruthy();
  });

  it('shows the empty roster copy', async () => {
    mockUseFavoriters.mockReturnValue({ isPublic: true, profiles: [], loading: false });
    const view = await render(
      <FavoritedByList storyId="story-1" entityId="scene-1" entityType="Scene" />,
    );

    expect(view.getByText('favorited_by_empty')).toBeTruthy();
  });
});
