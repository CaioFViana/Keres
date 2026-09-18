import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockGetWorldRuleById = jest.fn();
const mockOpenGalleryMediaViewer = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
const mockCopy = {
  detailsTitle: 'copy_details',
  notFound: 'copy_not_found',
  failedToLoad: 'copy_failed',
  dataMissing: 'copy_missing',
  loadingDetails: 'copy_loading',
};
let mockCanEdit = true;
let mockStory: { id: string } | null = { id: 'story-1' };

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { worldRuleId: 'wr-1' } }),
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
jest.mock('@/src/components/layout/ScreenSection/ScreenSection', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `section-${title}` }, title);
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
  default: ({ tags }: { tags: { name: string }[] }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID: 'tag-list' },
      JSON.stringify(tags.map((tag) => tag.name)),
    );
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
jest.mock(
  '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields',
  () => ({
    __esModule: true,
    default: () => {
      const react = jest.requireActual('react') as typeof import('react');
      const native = jest.requireActual('react-native') as typeof import('react-native');
      return react.createElement(native.Text, { testID: 'custom-attrs' }, 'attrs');
    },
  }),
);
jest.mock('@/src/components/features/gallery/GalleryManager/EntityGalleryManager', () => ({
  __esModule: true,
  default: (props: { editable: boolean; onPressMedia: (id: string) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'gallery-manager' },
      react.createElement(
        native.Text,
        { testID: 'gallery-press', onPress: () => props.onPressMedia('media-1') },
        props.editable ? 'editable' : 'readonly',
      ),
    );
  },
}));
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
jest.mock('../../../src/hooks/useEntityRelations', () => ({
  __esModule: true,
  useEntityRelations: () => ({
    allNotes: [],
    noteRelations: [],
    saveNoteRelation: jest.fn(),
    deleteNoteRelation: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/useOpenGalleryMediaViewer', () => ({
  __esModule: true,
  useOpenGalleryMediaViewer: () => mockOpenGalleryMediaViewer,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/services/storymanagement/WorldRuleService', () => ({
  __esModule: true,
  createWorldRuleService: () => ({ getById: mockGetWorldRuleById }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { text: '#111', textSecondary: '#666' } }),
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: () => mockCopy,
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import WorldRuleDetailScreen from '../../../src/screens/worldrules/WorldRuleDetailScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const makeWorldRule = (overrides = {}) => ({
  id: 'wr-1',
  storyId: 'story-1',
  title: 'Gravity',
  section: 'rule',
  type: 'physical',
  category: null,
  behavior: 'Falls down',
  usability: null,
  danger: 'low',
  description: 'What goes up',
  extraNotes: null,
  tags: [{ id: 'tag-1', name: 'Physics' }],
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
  mockGetWorldRuleById.mockResolvedValue(makeWorldRule());
});

afterEach(() => {
  cleanup();
});

it('renders the rule with section, fields and managers', async () => {
  const view = await render(<WorldRuleDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(view.getByTestId('detail-title').props.children).toBe('Gravity');
  expect(view.getByTestId('field-world_piece_section').props.children).toBe(
    'world_piece_section:world_piece_section_rule',
  );
  expect(view.getByTestId('field-world_piece_type').props.children).toBe(
    'world_piece_type:physical',
  );
  expect(view.getByTestId('field-category').props.children).toBe('category:common_na');
  expect(view.getByTestId('field-world_piece_behavior').props.children).toBe(
    'world_piece_behavior:Falls down',
  );
  expect(view.getByTestId('field-description').props.children).toBe('description:What goes up');
  expect(view.getByTestId('field-extra_notes').props.children).toBe('extra_notes:common_na');
  expect(view.getByTestId('tag-list').props.children).toBe('["Physics"]');
  expect(view.getByTestId('custom-attrs')).toBeTruthy();
  expect(view.getByTestId('section-media_section_title')).toBeTruthy();
  expect(view.getByTestId('gallery-press').props.children).toBe('editable');
  expect(view.getByTestId('note-manager')).toBeTruthy();
  expect(view.getByTestId('seealso-manager')).toBeTruthy();
  expect(view.getByTestId('entity-metadata')).toBeTruthy();
  expect(view.getByTestId('favorited-marker')).toBeTruthy();

  await fireEvent.press(view.getByTestId('gallery-press'));
  expect(mockOpenGalleryMediaViewer).toHaveBeenCalledWith('media-1');

  await fireEvent.press(view.getByTestId('go-back-btn'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('registers the edit action only when editable', async () => {
  const view = await render(<WorldRuleDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(headerConfig().title).toBe('Gravity');
  expect(headerConfig().actions[0]!.visible).toBe(true);
  await act(async () => {
    headerConfig().actions[0]!.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith('WorldRuleForm', { worldRuleId: 'wr-1' });

  mockCanEdit = false;
  await render(<WorldRuleDetailScreen />);
  await waitFor(() => expect(headerConfig().actions[0]!.visible).toBe(false));
});

it('falls back to the copy title without a rule title', async () => {
  mockGetWorldRuleById.mockResolvedValueOnce(makeWorldRule({ title: '' }));
  const view = await render(<WorldRuleDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  expect(headerConfig().title).toBe('copy_details');
});

it('shows the error state when the rule is missing or loading fails', async () => {
  mockGetWorldRuleById.mockResolvedValueOnce(null);
  const missing = await render(<WorldRuleDetailScreen />);
  await waitFor(() => expect(missing.getByTestId('screen-error')).toBeTruthy());
  expect(missing.getByTestId('screen-error').props.children).toBe('copy_not_found');

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetWorldRuleById.mockRejectedValueOnce(new Error('boom'));
  const failed = await render(<WorldRuleDetailScreen />);
  await waitFor(() => expect(failed.getByTestId('screen-error')).toBeTruthy());
  expect(failed.getByTestId('screen-error').props.children).toBe('copy_failed');
  await fireEvent.press(failed.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();
  consoleSpy.mockRestore();
});

it('goes back when the rule was deleted', async () => {
  mockGetWorldRuleById.mockResolvedValueOnce(makeWorldRule({ isDeleted: true }));
  await render(<WorldRuleDetailScreen />);

  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
});

it('refreshes the rule on change events', async () => {
  const view = await render(<WorldRuleDetailScreen />);

  await waitFor(() => expect(view.getByTestId('detail-title')).toBeTruthy());
  mockGetWorldRuleById.mockResolvedValueOnce(makeWorldRule({ title: 'Buoyancy' }));
  await act(async () => {
    entityEventEmitter.emit('worldrule_changed', 'story-1', 'wr-1');
  });
  await waitFor(() => expect(view.getByTestId('detail-title').props.children).toBe('Buoyancy'));

  mockGetWorldRuleById.mockResolvedValueOnce(null);
  await act(async () => {
    entityEventEmitter.emit('worldrule_changed', 'story-1', 'wr-1');
  });
  await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
});

it('refreshes tags on tag relation changes for this rule', async () => {
  const view = await render(<WorldRuleDetailScreen />);

  await waitFor(() => expect(view.getByTestId('tag-list')).toBeTruthy());
  mockGetWorldRuleById.mockResolvedValueOnce(
    makeWorldRule({ tags: [{ id: 'tag-2', name: 'Magic' }] }),
  );
  await act(async () => {
    entityEventEmitter.emit('tag_relation_changed', 'story-1', 'wr-1');
  });
  await waitFor(() => expect(view.getByTestId('tag-list').props.children).toBe('["Magic"]'));

  await act(async () => {
    entityEventEmitter.emit('tag_relation_changed', 'story-1', 'other-id');
  });
  expect(view.getByTestId('tag-list').props.children).toBe('["Magic"]');

  mockGetWorldRuleById.mockResolvedValueOnce(null);
  await act(async () => {
    entityEventEmitter.emit('tag_relation_changed', 'story-1', 'wr-1');
  });
  expect(view.getByTestId('tag-list').props.children).toBe('["Magic"]');
});
