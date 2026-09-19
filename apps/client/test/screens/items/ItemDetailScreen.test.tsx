import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };
const mockRoute = { params: { itemId: 'item-1' } };
const mockGetItemById = jest.fn();
const mockGetCharacters = jest.fn();
const mockOpenGalleryMediaViewer = jest.fn();
const mockOpenJourneyMap = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockUpdateComment = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();
const mockEntityComments = {
  commentsByField: {},
  canComment: false,
  isStoryOwner: false,
  currentUserId: null,
  addComment: mockAddComment,
  deleteComment: mockDeleteComment,
  updateComment: mockUpdateComment,
};
const mockEntityRelations = {
  selectedTags: [],
  allNotes: [],
  noteRelations: [],
  saveNoteRelation: mockSaveNoteRelation,
  deleteNoteRelation: mockDeleteNoteRelation,
};
const mockVocabularyCopy = {
  detailsTitle: 'Item details',
  notFound: 'Item not found',
  failedToLoad: 'Failed to load item',
  loadingDetails: 'Loading item',
  dataMissing: 'Item missing',
};
const mockVocabulary = {
  agree: () => 'o',
  term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
};
const mockSelectedStory = { id: 'story-1', type: 'linear' };
const mockArcs = [{ id: 'arc-1' }];
const mockCanEdit: { current: boolean } = { current: true };
const mockHeaderConfig: {
  current: { title: string; actions: { onPress: () => void; visible?: boolean }[] } | null;
} = { current: null };
const mockDb = {};
const mockI18n = { t: (key: string) => key };
let mockTimelineProps: { item: { id: string }; storyId: string; storyType: string } | null = null;
let mockNoteManagerProps: { noteRelations: unknown[]; editable: boolean } | null = null;

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
jest.mock('@/src/components/common/display/DetailField/DetailField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value }: { label: string; value: string }) => (
      <Text testID={`field-${label}`}>{`${label}:${value}`}</Text>
    ),
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
      onPressMedia: (id: string) => void;
    }) => (
      <>
        <Text testID="gallery-marker">{`${props.ownerType}:${props.ownerId}`}</Text>
        <Text testID="gallery-media" onPress={() => props.onPressMedia('gallery-9')}>
          media
        </Text>
      </>
    ),
  };
});
jest.mock('@/src/components/features/item-journeys/ItemJourney/ItemJourneyTimeline', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { item: { id: string }; storyId: string; storyType: string }) => {
      mockTimelineProps = props;
      return <Text testID="timeline-marker">{`${props.storyId}:${props.storyType}`}</Text>;
    },
  };
});
jest.mock('@/src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      noteRelations: unknown[];
      onSave: () => void;
      onDelete: () => void;
      editable: boolean;
    }) => {
      mockNoteManagerProps = props;
      return (
        <>
          <Text testID="notes-marker">{props.editable ? 'editable' : 'readonly'}</Text>
          <Text testID="notes-save" onPress={props.onSave}>
            save
          </Text>
          <Text testID="notes-delete" onPress={props.onDelete}>
            delete
          </Text>
        </>
      );
    },
  };
});
jest.mock('@/src/components/features/arcs/AppearsInArcsSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ arcs }: { arcs: unknown[] }) => (
      <Text testID="arcs-marker">{`arcs:${arcs.length}`}</Text>
    ),
  };
});
jest.mock('@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="seealso-marker">seealso</Text>,
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
jest.mock('../../../src/hooks/useEntityRelations', () => ({
  __esModule: true,
  useEntityRelations: () => mockEntityRelations,
}));
jest.mock('../../../src/hooks/useAppearsInArcs', () => ({
  __esModule: true,
  useAppearsInArcs: () => mockArcs,
}));
jest.mock('../../../src/hooks/useOpenGalleryMediaViewer', () => ({
  __esModule: true,
  useOpenGalleryMediaViewer: () => mockOpenGalleryMediaViewer,
}));
jest.mock('../../../src/hooks/useOpenPresenceMatrixViewer', () => ({
  __esModule: true,
  useOpenPresenceMatrixViewer: () => ({ openItem: mockOpenJourneyMap }),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit.current }),
}));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: () => ({ getAllByStoryId: mockGetCharacters }),
}));
jest.mock('../../../src/services/storymanagement/ItemService', () => ({
  __esModule: true,
  createItemService: () => ({ getById: mockGetItemById }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { primary: '#00f' } }),
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: () => mockVocabularyCopy,
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => mockVocabulary,
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import ItemDetailScreen from '../../../src/screens/items/ItemDetailScreen';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeItem(overrides = {}) {
  return {
    id: 'item-1',
    storyId: 'story-1',
    characterOwnerId: 'char-1',
    name: 'Sword',
    category: 'Weapon',
    description: 'Sharp blade',
    initialState: null,
    isFavorite: true,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

describe('ItemDetailScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimelineProps = null;
    mockNoteManagerProps = null;
    mockHeaderConfig.current = null;
    mockCanEdit.current = true;
    mockGetItemById.mockResolvedValue(makeItem());
    mockGetCharacters.mockResolvedValue([{ id: 'char-1', name: 'Aria' }]);
  });

  it('loads the item and renders its detail sections', async () => {
    const view = await render(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
    expect(view.getByTestId('detail-title').props.children).toBe('Sword');
    expect(mockGetItemById).toHaveBeenCalledWith('item-1');
    expect(view.getByTestId('commentable-description').props.children).toBe(
      'description:Sharp blade',
    );
    expect(view.getByTestId('commentable-category').props.children).toBe('category:Weapon');
    expect(view.getByTestId('commentable-initial_state').props.children).toBe(
      'initial_state:common_na',
    );
    expect(view.getByTestId('commentable-extra_notes').props.children).toBe(
      'extra_notes:common_na',
    );
    await waitFor(() => expect(mockGetCharacters).toHaveBeenCalledWith('story-1'));
    expect(view.getByTestId('field-item_character_owner_label').props.children).toBe(
      'item_character_owner_label:Aria',
    );
    expect(view.getByTestId('field-is_favorite').props.children).toBe('is_favorite:common_yes');
    expect(view.getByTestId('tag-list').props.children).toBe('no_tags_found');
    expect(view.getByTestId('custom-attrs').props.children).toBe('item-1');
    expect(view.getByTestId('arcs-marker').props.children).toBe('arcs:1');
    expect(view.getByTestId('seealso-marker')).toBeTruthy();
    expect(view.getByTestId('entity-metadata')).toBeTruthy();
    expect(view.getByTestId('favorited-marker')).toBeTruthy();
    expect(mockHeaderConfig.current?.title).toBe('Sword');
  });

  it('shows not-found and load-failure errors, and leaves deleted items', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetItemById.mockResolvedValue(null);
      const missing = await render(<ItemDetailScreen />);
      await waitFor(() => expect(missing.getByTestId('screen-error')).toBeTruthy());
      expect(missing.getByTestId('screen-error').props.children).toBe('Item not found');

      mockGetItemById.mockRejectedValue(new Error('db down'));
      const failed = await render(<ItemDetailScreen />);
      await waitFor(() => expect(failed.getByTestId('screen-error')).toBeTruthy());
      expect(failed.getByTestId('screen-error').props.children).toBe('Failed to load item');

      mockGetItemById.mockResolvedValue(makeItem({ isDeleted: true }));
      await render(<ItemDetailScreen />);
      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    });
  });

  it('binds the journey timeline, notes and gallery to the item', async () => {
    const view = await render(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
    expect(view.getByTestId('timeline-marker').props.children).toBe('story-1:linear');
    expect(mockTimelineProps?.item.id).toBe('item-1');
    expect(view.getByTestId('notes-marker').props.children).toBe('readonly');
    expect(mockNoteManagerProps?.editable).toBe(false);
    await fireEvent.press(view.getByTestId('notes-save'));
    expect(mockSaveNoteRelation).toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('notes-delete'));
    expect(mockDeleteNoteRelation).toHaveBeenCalled();
    expect(view.getByTestId('gallery-marker').props.children).toBe('Item:item-1');
    await fireEvent.press(view.getByTestId('gallery-media'));
    expect(mockOpenGalleryMediaViewer).toHaveBeenCalledWith('gallery-9');
  });

  it('opens the journey map and the form from header actions, and goes back', async () => {
    const view = await render(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
    expect(mockHeaderConfig.current?.actions[0].visible).toBe(true);
    mockHeaderConfig.current?.actions[0].onPress();
    expect(mockOpenJourneyMap).toHaveBeenCalledWith('item-1');
    mockHeaderConfig.current?.actions[1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('ItemForm', { itemId: 'item-1' });

    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
