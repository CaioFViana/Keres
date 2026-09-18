import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockGetTagById = jest.fn();
const mockGetRelationsForTag = jest.fn();
const mockGetEntityIdentifier = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
let mockStory: { id: string } | null = { id: 'story-1' };

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { tagId: 'tag-1' } }),
}));
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('@/src/components/common/controls/Button/Button', () => ({
  __esModule: true,
  default: ({ onPress, children }: { onPress: () => void; children?: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'go-back-btn', onPress }, children);
  },
}));
jest.mock('@/src/components/layout/DetailContainer/DetailContainer', () => ({
  __esModule: true,
  default: ({
    title,
    footer,
    children,
  }: {
    title: string;
    footer?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'detail-container' },
      react.createElement(native.Text, { testID: 'detail-title' }, title),
      children,
      footer,
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
jest.mock(
  '@/src/components/features/comments/CommentableDetailField/CommentableDetailField',
  () => ({
    __esModule: true,
    default: ({ label, value }: { label: string; value: string }) => {
      const react = jest.requireActual('react') as typeof import('react');
      const native = jest.requireActual('react-native') as typeof import('react-native');
      return react.createElement(native.Text, { testID: `field-${label}` }, `${label}:${value}`);
    },
  }),
);
jest.mock('@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList', () => ({
  __esModule: true,
  default: ({ groupedEntities }: { groupedEntities: unknown }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID: 'related-entities' },
      JSON.stringify(groupedEntities),
    );
  },
}));
jest.mock('@/src/components/features/mentions/EntityMetadataWithBacklinks', () => ({
  __esModule: true,
  default: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'entity-metadata' }, 'metadata');
  },
}));
jest.mock('@/src/components/features/favorites/FavoritedByList/FavoritedByList', () => ({
  __esModule: true,
  default: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'favorited-marker' }, 'favorited');
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityComments', () => ({
  __esModule: true,
  useEntityComments: () => ({
    canComment: false,
    isStoryOwner: true,
    currentUserId: 'user-1',
    commentsByField: {},
    addComment: jest.fn(),
    deleteComment: jest.fn(),
    updateComment: jest.fn(),
  }),
}));
jest.mock('../../../src/services/EntityService', () => ({
  __esModule: true,
  EntityService: { getEntityIdentifier: (...args: unknown[]) => mockGetEntityIdentifier(...args) },
}));
jest.mock('../../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: () => ({ getById: mockGetTagById }),
}));
jest.mock('../../../src/services/storymanagement/TagRelationService', () => ({
  __esModule: true,
  createTagRelationService: () => ({ getRelationsForTag: mockGetRelationsForTag }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { text: '#111', textSecondary: '#666' } }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import TagDetailScreen from '../../../src/screens/tags/TagDetailScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const makeTag = (overrides = {}) => ({
  id: 'tag-1',
  storyId: 'story-1',
  name: 'Urgent',
  color: '#ff0000',
  isFavorite: false,
  extraNotes: 'side note',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

function headerActions() {
  const header = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    title: string;
    actions: { onPress: () => void }[];
  };
  return header;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStory = { id: 'story-1' };
  mockGetTagById.mockResolvedValue(makeTag());
  mockGetRelationsForTag.mockResolvedValue([]);
  mockGetEntityIdentifier.mockResolvedValue('Aria');
});

afterEach(() => {
  cleanup();
});

it('renders the tag with color, notes and relations', async () => {
  mockGetRelationsForTag.mockResolvedValue([
    { relationType: 'Character', relationId: 'char-1' },
    { relationType: 'Scene', relationId: 'scene-9' },
  ]);
  mockGetEntityIdentifier.mockImplementation(async (_db: unknown, type: string, id: string) =>
    id === 'scene-9' ? null : `${type}-${id}`,
  );
  const view = await render(<TagDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(view.getByTestId('detail-title').props.children).toBe('Urgent');
  expect(view.getByText(/color/)).toBeTruthy();
  expect(view.getByTestId('field-extra_notes').props.children).toBe('extra_notes:side note');
  expect(view.getByTestId('entity-metadata')).toBeTruthy();
  expect(view.getByTestId('favorited-marker')).toBeTruthy();

  await waitFor(() => {
    const grouped = JSON.parse(
      view.getByTestId('related-entities').props.children as string,
    ) as Record<string, { id: string }[]>;
    expect(grouped.character).toEqual([{ id: 'char-1', name: 'Character-char-1' }]);
    expect(grouped.scene).toEqual([]);
  });

  await fireEvent.press(view.getByTestId('go-back-btn'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('falls back for missing notes and registers the edit action', async () => {
  mockGetTagById.mockResolvedValueOnce(makeTag({ color: null, extraNotes: null, name: '' }));
  const view = await render(<TagDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(view.getByTestId('field-extra_notes').props.children).toBe('extra_notes:common_na');
  expect(headerActions().title).toBe('tag_details_title');

  await act(async () => {
    headerActions().actions[0]!.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith('TagForm', { tagId: 'tag-1' });
});

it('shows the error state when the tag is missing', async () => {
  mockGetTagById.mockResolvedValueOnce(null);
  const view = await render(<TagDetailScreen />);

  await waitFor(() => expect(view.getByTestId('screen-error')).toBeTruthy());
  expect(view.getByTestId('screen-error').props.children).toBe('tag_not_found');
  await fireEvent.press(view.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('shows the error state when loading fails', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetTagById.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<TagDetailScreen />);

  await waitFor(() => expect(view.getByTestId('screen-error')).toBeTruthy());
  expect(view.getByTestId('screen-error').props.children).toBe('failed_to_load_tag');
  consoleSpy.mockRestore();
});

it('goes back when the tag was deleted', async () => {
  mockGetTagById.mockResolvedValueOnce(makeTag({ isDeleted: true }));
  await render(<TagDetailScreen />);

  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
});

it('refreshes the tag on change events', async () => {
  const view = await render(<TagDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  const callsBefore = mockGetTagById.mock.calls.length;

  await act(async () => {
    entityEventEmitter.emit('tag_changed', 'story-1', 'other-tag');
  });
  expect(mockGetTagById.mock.calls.length).toBe(callsBefore);

  mockGetTagById.mockResolvedValueOnce(makeTag({ name: 'Renamed' }));
  await act(async () => {
    entityEventEmitter.emit('tag_changed', 'story-1', 'tag-1');
  });
  await waitFor(() => expect(view.getByTestId('detail-title').props.children).toBe('Renamed'));
});

it('goes back when the change event reports a deletion', async () => {
  const view = await render(<TagDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  mockGoBack.mockClear();
  mockGetTagById.mockResolvedValueOnce(makeTag({ isDeleted: true }));
  await act(async () => {
    entityEventEmitter.emit('tag_changed', 'story-1', 'tag-1');
  });
  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
});

it('refetches relations on tag relation changes', async () => {
  const view = await render(<TagDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  const callsBefore = mockGetRelationsForTag.mock.calls.length;

  await act(async () => {
    entityEventEmitter.emit('tag_relation_changed', 'story-1', 'other-tag');
  });
  expect(mockGetRelationsForTag.mock.calls.length).toBe(callsBefore);

  await act(async () => {
    entityEventEmitter.emit('tag_relation_changed', 'story-1', 'tag-1');
  });
  await waitFor(() =>
    expect(mockGetRelationsForTag.mock.calls.length).toBeGreaterThan(callsBefore),
  );
});
