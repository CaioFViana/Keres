import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };
const mockRoute = { params: { noteId: 'note-1' } };
const mockGetNoteById = jest.fn();
const mockGetTagsForEntity = jest.fn();
const mockGetRelationsForNote = jest.fn();
const mockGetEntityIdentifier = jest.fn();
const mockOpenGalleryMediaViewer = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockUpdateComment = jest.fn();
const mockEntityComments = {
  commentsByField: {},
  canComment: false,
  isStoryOwner: false,
  currentUserId: null,
  addComment: mockAddComment,
  deleteComment: mockDeleteComment,
  updateComment: mockUpdateComment,
};
const mockSelectedStory = { id: 'story-1' };
const mockCanEdit: { current: boolean } = { current: true };
const mockHeaderConfig: {
  current: { title: string; actions: { onPress: () => void; visible?: boolean }[] } | null;
} = { current: null };
const mockDb = {};
const mockI18n = { t: (key: string) => key };
let mockRelatedProps: { groupedEntities: Record<string, { id: string; name: string }[]> } | null =
  null;
let mockGalleryProps: { ownerId: string; onPressMedia: (id: string) => void } | null = null;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@/src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => {
    mockHeaderConfig.current = config as never;
  },
}));
jest.mock('@/src/components/layout/DetailContainer/DetailContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      footer,
      children,
    }: {
      title: string;
      footer?: React.ReactNode;
      children?: React.ReactNode;
    }) => (
      <>
        <Text testID="detail-title">{title}</Text>
        {children}
        {footer}
      </>
    ),
  };
});
jest.mock('@/src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title }: { title: string }) => <Text testID={`section-${title}`}>{title}</Text>,
  };
});
jest.mock('@/src/components/common/display/TagList/TagList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ tags, emptyMessage }: { tags: { name: string }[]; emptyMessage: string }) => (
      <Text testID="tag-list">
        {tags.length > 0 ? tags.map((tag) => tag.name).join(',') : emptyMessage}
      </Text>
    ),
  };
});
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message: string }) => (
      <Text testID="screen-loading">{message}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});
jest.mock('@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ entityId }: { entityId: string }) => <Text testID="custom-attrs">{entityId}</Text>,
  };
});
jest.mock(
  '@/src/components/features/comments/CommentableDetailField/CommentableDetailField',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ label, value }: { label: string; value: string }) => (
        <Text testID={`commentable-${label}`}>{`${label}:${value}`}</Text>
      ),
    };
  },
);
jest.mock('@/src/components/features/favorites/FavoritedByList/FavoritedByList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="favorited-marker">favorited</Text>,
  };
});
jest.mock('@/src/components/features/gallery/GalleryManager/EntityGalleryManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      ownerId: string;
      ownerType: string;
      editable: boolean;
      onPressMedia: (id: string) => void;
    }) => {
      mockGalleryProps = props;
      return (
        <>
          <Text testID="gallery-marker">{`${props.ownerType}:${props.ownerId}`}</Text>
          <Text testID="gallery-media" onPress={() => props.onPressMedia('gallery-9')}>
            {props.editable ? 'editable' : 'readonly'}
          </Text>
        </>
      );
    },
  };
});
jest.mock('@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      title: string;
      groupedEntities: Record<string, { id: string; name: string }[]>;
    }) => {
      mockRelatedProps = props;
      return <Text testID="related-marker">{props.title}</Text>;
    },
  };
});
jest.mock('@/src/components/features/mentions/EntityMetadataWithBacklinks', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="entity-metadata">metadata</Text>,
  };
});
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityComments', () => ({
  __esModule: true,
  useEntityComments: () => mockEntityComments,
}));
jest.mock('../../../src/hooks/useOpenGalleryMediaViewer', () => ({
  __esModule: true,
  useOpenGalleryMediaViewer: () => mockOpenGalleryMediaViewer,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit.current }),
}));
jest.mock('../../../src/services/EntityService', () => ({
  __esModule: true,
  EntityService: { getEntityIdentifier: (...args: unknown[]) => mockGetEntityIdentifier(...args) },
}));
jest.mock('../../../src/services/storymanagement/NoteService', () => ({
  __esModule: true,
  createNoteService: () => ({ getById: mockGetNoteById }),
}));
jest.mock('../../../src/services/storymanagement/NoteRelationService', () => ({
  __esModule: true,
  createNoteRelationService: () => ({ getRelationsForNote: mockGetRelationsForNote }),
}));
jest.mock('../../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: () => ({}),
}));
jest.mock('../../../src/services/storymanagement/TagRelationService', () => ({
  __esModule: true,
  createTagRelationService: () => ({ getTagsForEntity: mockGetTagsForEntity }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { primary: '#00f' } }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import NoteDetailScreen from '../../../src/screens/notes/NoteDetailScreen';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeNote(overrides = {}) {
  return {
    id: 'note-1',
    storyId: 'story-1',
    title: 'My note',
    body: 'Body text',
    extraNotes: null,
    isFavorite: false,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

describe('NoteDetailScreen', () => {
  afterEach(() => {
    cleanup();
    (console.warn as jest.Mock).mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation((() => undefined) as never);
    mockRelatedProps = null;
    mockGalleryProps = null;
    mockHeaderConfig.current = null;
    mockCanEdit.current = true;
    mockGetNoteById.mockResolvedValue(makeNote());
    mockGetTagsForEntity.mockResolvedValue([]);
    mockGetRelationsForNote.mockResolvedValue([]);
    mockGetEntityIdentifier.mockResolvedValue('Entity name');
  });

  it('loads the note and renders its detail sections', async () => {
    const view = await render(<NoteDetailScreen />);

    await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
    expect(view.getByTestId('detail-title').props.children).toBe('My note');
    expect(mockGetNoteById).toHaveBeenCalledWith('note-1');
    expect(view.getByTestId('commentable-body').props.children).toBe('body:Body text');
    expect(view.getByTestId('commentable-extra_notes').props.children).toBe(
      'extra_notes:common_na',
    );
    expect(view.getByTestId('custom-attrs').props.children).toBe('note-1');
    expect(view.getByTestId('tag-list').props.children).toBe('no_tags_found');
    expect(view.getByTestId('entity-metadata')).toBeTruthy();
    expect(view.getByTestId('favorited-marker')).toBeTruthy();
    expect(mockHeaderConfig.current?.title).toBe('My note');
  });

  it('shows the not-found and load-failure errors', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetNoteById.mockResolvedValue(null);
      const missing = await render(<NoteDetailScreen />);
      await waitFor(() => expect(missing.getByTestId('screen-error')).toBeTruthy());
      expect(missing.getByTestId('screen-error').props.children).toBe('note_not_found');
      await fireEvent.press(missing.getByTestId('screen-error'));
      expect(mockGoBack).toHaveBeenCalled();

      mockGetNoteById.mockRejectedValue(new Error('db down'));
      const failed = await render(<NoteDetailScreen />);
      await waitFor(() => expect(failed.getByTestId('screen-error')).toBeTruthy());
      expect(failed.getByTestId('screen-error').props.children).toBe('failed_to_load_note');
    });
  });

  it('leaves when the note was deleted', async () => {
    mockGetNoteById.mockResolvedValue(makeNote({ isDeleted: true }));
    await render(<NoteDetailScreen />);

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('fetches tags and groups related entities by type', async () => {
    mockGetTagsForEntity.mockResolvedValue([{ id: 'tag-1', name: 'Lore' }]);
    mockGetRelationsForNote.mockResolvedValue([
      { relationType: 'Character', relationId: 'char-1' },
      { relationType: 'Scene', relationId: 'scene-9' },
    ]);
    mockGetEntityIdentifier.mockImplementation(
      async (_db: unknown, type: string, id: string) => `${type}:${id}`,
    );
    const view = await render(<NoteDetailScreen />);

    await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
    await waitFor(() =>
      expect(mockGetTagsForEntity).toHaveBeenCalledWith('story-1', 'note-1', 'Note'),
    );
    expect(view.getByTestId('tag-list').props.children).toBe('Lore');
    await waitFor(() => expect(mockGetEntityIdentifier).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mockRelatedProps?.groupedEntities.character).toEqual([
        { id: 'char-1', name: 'Character:char-1' },
      ]),
    );
    expect(mockRelatedProps?.groupedEntities.scene).toEqual([
      { id: 'scene-9', name: 'Scene:scene-9' },
    ]);
  });

  it('wires the gallery, the edit action and going back', async () => {
    const view = await render(<NoteDetailScreen />);

    await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
    expect(view.getByTestId('gallery-marker').props.children).toBe('Note:note-1');
    expect(mockGalleryProps?.ownerId).toBe('note-1');
    expect(view.getByTestId('gallery-media').props.children).toBe('editable');
    await fireEvent.press(view.getByTestId('gallery-media'));
    expect(mockOpenGalleryMediaViewer).toHaveBeenCalledWith('gallery-9');

    expect(mockHeaderConfig.current?.actions[0].visible).toBe(true);
    mockHeaderConfig.current?.actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('NoteForm', { noteId: 'note-1' });

    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
