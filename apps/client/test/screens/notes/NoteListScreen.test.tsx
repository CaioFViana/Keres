import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockToggleFavorite = jest.fn();
const mockGetTagsByStoryId = jest.fn();
const mockUseEntityListScreen = jest.fn();
const mockUseScreenTour = jest.fn();
let mockListState = {
  listProps: {},
  items: [] as { id: string; title: string }[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
};
let mockListProps: {
  data: { id: string; title: string }[];
  renderItem: (info: { item: { id: string; title: string } }) => React.ReactNode;
  filterOptions: { label: string; value: string }[];
  sortOptions: { label: string; value: string }[];
} | null = null;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      getParent: () => ({ setOptions: jest.fn() }),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('@/src/components/layout/ScreenContainer/ScreenContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'notes-container' }, children);
  },
}));
jest.mock('@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList', () => ({
  __esModule: true,
  default: (props: {
    data: { id: string; title: string }[];
    renderItem: (info: { item: { id: string; title: string } }) => React.ReactNode;
    filterOptions: { label: string; value: string }[];
    sortOptions: { label: string; value: string }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockListProps = props;
    return react.createElement(
      native.View,
      { testID: 'note-list-stub' },
      props.data.map((item) =>
        react.createElement(react.Fragment, { key: item.id }, props.renderItem({ item })),
      ),
    );
  },
}));
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenLoading: ({ message }: { message: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-loading' }, message);
  },
  ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-error', onPress: onGoBack }, message);
  },
}));
jest.mock('@/src/components/features/list-items/NoteListItem', () => ({
  __esModule: true,
  default: ({
    note,
    onToggleFavorite,
    onViewDetails,
  }: {
    note: { id: string; title: string; isFavorite?: boolean };
    onToggleFavorite: (id: string, isFavorite: boolean) => void;
    onViewDetails: (id: string) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        {
          testID: `fav-${note.id}`,
          onPress: () => onToggleFavorite(note.id, !note.isFavorite),
        },
        `fav ${note.title}`,
      ),
      react.createElement(
        native.Text,
        { testID: `view-${note.id}`, onPress: () => onViewDetails(note.id) },
        `view ${note.title}`,
      ),
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityListScreen', () => ({
  __esModule: true,
  useEntityListScreen: (...args: unknown[]) => mockUseEntityListScreen(...args),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: () => ({ getTagsByStoryId: mockGetTagsByStoryId }),
}));
jest.mock('../../../src/state/noteStore', () => ({
  __esModule: true,
  useNoteStore: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import NotesScreen from '../../../src/screens/notes/NoteListScreen';

const freshListState = () => ({
  listProps: {},
  items: [] as { id: string; title: string }[],
  isInitialLoading: false,
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
});

describe('NotesScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListState = freshListState();
    mockListProps = null;
    mockUseEntityListScreen.mockImplementation(() => mockListState);
    mockGetTagsByStoryId.mockResolvedValue([]);
  });

  it('requests its guided tour', async () => {
    await render(<NotesScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('NotesStack');
  });

  it('binds the note store through the shared list hook', async () => {
    const view = await render(<NotesScreen />);

    expect(mockUseEntityListScreen).toHaveBeenCalledWith(
      expect.objectContaining({ collectionKey: 'notes', changeEvent: 'note_changed' }),
    );
    expect(view.getByTestId('notes-container')).toBeTruthy();
  });

  it('shows loading and error states from the list hook', async () => {
    mockListState = { ...freshListState(), isInitialLoading: true };
    const loading = await render(<NotesScreen />);
    expect(loading.getByTestId('screen-loading')).toBeTruthy();

    mockListState = { ...freshListState(), error: 'load failed' };
    const failed = await render(<NotesScreen />);
    await fireEvent.press(failed.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders notes with tag filters and wires item actions', async () => {
    mockGetTagsByStoryId.mockResolvedValue([{ id: 'tag-1', name: 'Lore', color: '#f00' }]);
    mockListState = {
      ...freshListState(),
      items: [{ id: 'note-1', title: 'First note' }],
    };
    const view = await render(<NotesScreen />);

    await waitFor(() => expect(mockGetTagsByStoryId).toHaveBeenCalledWith('story-1'));
    expect(view.getByTestId('note-list-stub')).toBeTruthy();
    expect(mockListProps?.filterOptions).toEqual([
      { label: 'Lore', value: 'tag-1', color: '#f00' },
    ]);
    expect(mockListProps?.sortOptions.map((option) => option.value)).toEqual([
      'title',
      'createdAt',
      'updatedAt',
    ]);
    expect(mockListProps?.data).toHaveLength(1);

    await fireEvent.press(view.getByTestId('fav-note-1'));
    expect(mockToggleFavorite).toHaveBeenCalledWith('note-1', true);

    await fireEvent.press(view.getByTestId('view-note-1'));
    expect(mockNavigate).toHaveBeenCalledWith('NoteDetail', { noteId: 'note-1' });
  });

  it('clears tag filters without a story', async () => {
    mockListState = { ...freshListState(), storyId: undefined };
    const view = await render(<NotesScreen />);

    await waitFor(() => expect(mockListProps?.filterOptions).toEqual([]));
    expect(view.getByTestId('note-list-stub')).toBeTruthy();
    expect(mockGetTagsByStoryId).not.toHaveBeenCalled();
  });
});
