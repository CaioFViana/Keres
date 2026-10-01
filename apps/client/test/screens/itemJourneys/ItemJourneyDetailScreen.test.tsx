import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockGetItemJourneyById = jest.fn();
const mockNavigateToEntity = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
const mockItemCopy = { entity: 'Item', unknown: 'Unknown item', itemJourney: 'Journey' };
const mockSceneCopy = { entity: 'Scene' };
const mockAgree = (_entity: string, forms: { masculine: string }) => forms.masculine;
const mockTerm = (value: string) => value;
let mockCanEdit = true;
let mockStory: { id: string } | null = { id: 'story-1' };
let mockItems = [{ id: 'item-1', name: 'Sword' }];
let mockScenes = [{ id: 'scene-1', name: 'Opening' }];
let mockCharacters = [{ id: 'char-1', name: 'Aria' }];

const storeStub = (key: 'items' | 'scenes' | 'characters') => () => ({
  [key]: key === 'items' ? mockItems : key === 'scenes' ? mockScenes : mockCharacters,
  fetchItems: jest.fn(),
  fetchScenes: jest.fn(),
  fetchCharacters: jest.fn(),
  setDbAndStoryId: jest.fn(),
  initializeService: jest.fn(),
});

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { itemJourneyId: 'journey-1' } }),
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
jest.mock('@/src/components/common/display/DetailField/DetailField', () => ({
  __esModule: true,
  default: ({ label, value }: { label: string; value: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `detail-${label}` }, `${label}:${value}`);
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
jest.mock('@/src/components/common/display/TagList/TagList', () => ({
  __esModule: true,
  default: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'tag-list' }, 'tags');
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
jest.mock('@/src/components/features/notes/NoteManager', () => ({
  __esModule: true,
  default: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'note-manager' }, 'notes');
  },
}));
jest.mock('@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => ({
  __esModule: true,
  default: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'seealso-manager' }, 'seealso');
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
jest.mock('../../../src/hooks/useEntityRelations', () => ({
  __esModule: true,
  useEntityRelations: () => ({
    selectedTags: [],
    allNotes: [],
    noteRelations: [],
    saveNoteRelation: jest.fn(),
    deleteNoteRelation: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigateToEntity,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/services/storymanagement/ItemJourneyService', () => ({
  __esModule: true,
  createItemJourneyService: () => ({ getById: mockGetItemJourneyById }),
}));
jest.mock('../../../src/state/itemStore', () => ({
  __esModule: true,
  useItemStore: () => storeStub('items')(),
}));
jest.mock('../../../src/state/sceneStore', () => ({
  __esModule: true,
  useSceneStore: () => storeStub('scenes')(),
}));
jest.mock('../../../src/state/characterStore', () => ({
  __esModule: true,
  useCharacterStore: () => storeStub('characters')(),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { textSecondary: '#666' } }),
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: (entity: string) => (entity === 'Item' ? mockItemCopy : mockSceneCopy),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ agree: mockAgree, term: mockTerm }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import ItemJourneyDetailScreen from '../../../src/screens/itemJourneys/ItemJourneyDetailScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const makeJourney = (overrides = {}) => ({
  id: 'journey-1',
  storyId: 'story-1',
  itemId: 'item-1',
  sceneId: 'scene-1',
  newCharacterOwnerId: 'char-1',
  newState: 'Broken',
  extraNotes: 'fell down',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

function headerConfig() {
  return mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    title: string;
    actions: { visible: boolean; onPress: () => void }[];
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanEdit = true;
  mockStory = { id: 'story-1' };
  mockItems = [{ id: 'item-1', name: 'Sword' }];
  mockScenes = [{ id: 'scene-1', name: 'Opening' }];
  mockCharacters = [{ id: 'char-1', name: 'Aria' }];
  mockGetItemJourneyById.mockResolvedValue(makeJourney());
});

afterEach(() => {
  cleanup();
});

it('renders the journey with linked item, scene and owner', async () => {
  const view = await render(<ItemJourneyDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(view.getByTestId('detail-title').props.children).toBe('Sword - Broken');
  expect(view.getByTestId('detail-Item').props.children).toBe('Item:Sword');
  expect(view.getByTestId('detail-Scene').props.children).toBe('Scene:Opening');
  expect(view.getByTestId('field-item_state').props.children).toBe('item_state:Broken');
  expect(view.getByTestId('field-extra_notes').props.children).toBe('extra_notes:fell down');
  expect(view.getByTestId('tag-list')).toBeTruthy();
  expect(view.getByTestId('note-manager')).toBeTruthy();
  expect(view.getByTestId('seealso-manager')).toBeTruthy();
  expect(view.getByTestId('entity-metadata')).toBeTruthy();

  await fireEvent.press(view.getByTestId('detail-Item'));
  expect(mockNavigateToEntity).toHaveBeenCalledWith('Item', 'item-1');
  await fireEvent.press(view.getByTestId('detail-Scene'));
  expect(mockNavigateToEntity).toHaveBeenCalledWith('Scene', 'scene-1');

  await fireEvent.press(view.getByTestId('go-back-btn'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('navigates to the new owner and falls back for unknown items', async () => {
  mockItems = [];
  const view = await render(<ItemJourneyDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(view.getByTestId('detail-title').props.children).toBe('Unknown item - Broken');
  expect(view.queryByTestId('detail-Item')).toBeNull();

  await fireEvent.press(view.getByTestId('detail-item_journey_new_character_owner_label'));
  expect(mockNavigateToEntity).toHaveBeenCalledWith('Character', 'char-1');
});

it('hides relation rows without matches', async () => {
  mockGetItemJourneyById.mockResolvedValueOnce(
    makeJourney({ sceneId: 'missing', newCharacterOwnerId: null, newState: null }),
  );
  const view = await render(<ItemJourneyDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-Item')).toBeTruthy());
  expect(view.queryByTestId('detail-Scene')).toBeNull();
  expect(view.getByTestId('field-item_state').props.children).toBe('item_state:common_na');
});

it('registers the edit action only when editable', async () => {
  const view = await render(<ItemJourneyDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(headerConfig().actions[0]!.visible).toBe(true);
  await act(async () => {
    headerConfig().actions[0]!.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith('ItemJourneyForm', { itemJourneyId: 'journey-1' });

  mockCanEdit = false;
  await render(<ItemJourneyDetailScreen />);
  await waitFor(() => expect(headerConfig().actions[0]!.visible).toBe(false));
});

it('shows error states for missing and failed loads', async () => {
  mockGetItemJourneyById.mockResolvedValueOnce(null);
  const missing = await render(<ItemJourneyDetailScreen />);
  await waitFor(() => expect(missing.getByTestId('screen-error')).toBeTruthy());

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetItemJourneyById.mockRejectedValueOnce(new Error('boom'));
  const failed = await render(<ItemJourneyDetailScreen />);
  await waitFor(() => expect(failed.getByTestId('screen-error')).toBeTruthy());
  await fireEvent.press(failed.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();
  consoleSpy.mockRestore();
});

it('goes back when the journey was deleted', async () => {
  mockGetItemJourneyById.mockResolvedValueOnce(makeJourney({ isDeleted: true }));
  await render(<ItemJourneyDetailScreen />);

  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
});

it('refreshes the journey on change events', async () => {
  const view = await render(<ItemJourneyDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  mockGetItemJourneyById.mockResolvedValueOnce(makeJourney({ newState: 'Mended' }));
  await act(async () => {
    entityEventEmitter.emit('item_journey_changed', 'story-1', 'journey-1');
  });
  await waitFor(() =>
    expect(view.getByTestId('detail-title').props.children).toBe('Sword - Mended'),
  );

  await act(async () => {
    entityEventEmitter.emit('item_journey_changed', 'story-1', 'other-id');
  });
  expect(view.getByTestId('detail-title').props.children).toBe('Sword - Mended');

  mockGetItemJourneyById.mockResolvedValueOnce(null);
  await act(async () => {
    entityEventEmitter.emit('item_journey_changed', 'story-1', 'journey-1');
  });
  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
});
