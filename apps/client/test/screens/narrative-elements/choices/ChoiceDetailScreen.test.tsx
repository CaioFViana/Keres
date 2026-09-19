import {
  act,
  cleanup,
  fireEvent,
  render,
  type RenderResult,
  waitFor,
} from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigateToDetail = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockUpdateComment = jest.fn();

const mockGetChoiceById = jest.fn();
const mockGetCheckGroupsByChoiceId = jest.fn();
const mockGetChecksByGroupId = jest.fn();
const mockGetEffectsByEntity = jest.fn();
const mockGetAllScenesByStoryId = jest.fn();
const mockGetItemsByStoryId = jest.fn();

let mockSelectedStory: { id: string; type: string } | null = {
  id: 'story-1',
  type: 'branching',
};
let mockCanEdit = true;
let mockHeaderArgs: {
  title: string;
  actions: { id: string; label: string; onPress: () => void; visible: boolean }[];
} | null = null;
let mockSubscriptions: { event: string; listener: (...args: never[]) => unknown }[] = [];

jest.mock('@react-navigation/native', () => {
  const route = { params: { choiceId: 'choice-1' } };
  let navigation: { navigate: (...args: never[]) => void; goBack: () => void } | null = null;
  return {
    __esModule: true,
    useNavigation: () => (navigation ??= { navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => route,
  };
});

jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));

jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (args: {
    title: string;
    actions: { id: string; onPress: () => void; visible: boolean }[];
  }) => {
    mockHeaderArgs = args as never;
  },
}));

jest.mock('../../../../src/hooks/useEntityRefreshLifecycle', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useEntityInitialLoad: (callback: () => void) => {
      react.useEffect(() => {
        callback();
      }, [callback]);
    },
    useEntityEventSubscriptions: (
      subs: { event: string; listener: (...args: never[]) => unknown }[],
    ) => {
      mockSubscriptions = subs;
    },
  };
});

jest.mock('../../../../src/hooks/useEntityComments', () => ({
  __esModule: true,
  useEntityComments: () => ({
    commentsByField: {},
    canComment: false,
    isStoryOwner: false,
    currentUserId: null,
    addComment: mockAddComment,
    deleteComment: mockDeleteComment,
    updateComment: mockUpdateComment,
  }),
}));

jest.mock('../../../../src/hooks/useEntityRelations', () => ({
  __esModule: true,
  useEntityRelations: () => ({
    selectedTags: [{ id: 'tag-1', name: 'Tag' }],
    allNotes: [],
    noteRelations: [],
    saveNoteRelation: mockSaveNoteRelation,
    deleteNoteRelation: mockDeleteNoteRelation,
  }),
}));

jest.mock('../../../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigateToDetail,
}));

jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));

jest.mock('../../../../src/db', () => {
  const db = {};
  return {
    __esModule: true,
    useDrizzle: () => db,
  };
});

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      primary: '#0000ff',
      surface: '#f5f5f5',
      background: '#ffffff',
      border: '#cccccc',
      text: '#111111',
      textSecondary: '#555555',
      error: '#ff0000',
    },
  }),
}));

jest.mock('../../../../src/vocabulary/useVocabularyEntityCopy', () => {
  const copies: Record<string, object> = {};
  return {
    __esModule: true,
    useVocabularyEntityCopy: (kind: string) =>
      (copies[kind] ??= {
        entity: `${kind}-entity`,
        fromEntity: `from-${kind}`,
        detailsTitle: `details-${kind}`,
        notFound: `notfound-${kind}`,
        failedToLoad: `failed-${kind}`,
        loadingDetails: `loading-${kind}`,
        dataMissing: `missing-${kind}`,
      }),
  };
});

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return {
    __esModule: true,
    useTranslation: () => ({ t }),
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: () => ({ getById: mockGetChoiceById }),
}));

jest.mock('../../../../src/services/storymanagement/ChoiceCheckGroupService', () => ({
  __esModule: true,
  createChoiceCheckGroupService: () => ({
    getChoiceCheckGroupsByChoiceId: mockGetCheckGroupsByChoiceId,
  }),
}));

jest.mock('../../../../src/services/storymanagement/ChoiceCheckService', () => ({
  __esModule: true,
  createChoiceCheckService: () => ({ getChoiceChecksByGroupId: mockGetChecksByGroupId }),
}));

jest.mock('../../../../src/services/storymanagement/EffectService', () => ({
  __esModule: true,
  createEffectService: () => ({ getEffectsByEntity: mockGetEffectsByEntity }),
}));

jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getAllByStoryId: mockGetAllScenesByStoryId }),
}));

jest.mock('../../../../src/services/storymanagement/ItemService', () => ({
  __esModule: true,
  createItemService: () => ({ getItemsByStoryId: mockGetItemsByStoryId }),
}));

jest.mock('../../../../src/components/common/feedback/ScreenState/ScreenState', () => {
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

jest.mock('../../../../src/components/layout/DetailContainer/DetailContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      footer,
      children,
    }: {
      title: string;
      footer: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <>
        <Text testID="detail-title">{title}</Text>
        {children}
        {footer}
      </>
    ),
  };
});

jest.mock('../../../../src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title }: { title: string }) => <Text testID={`section-${title}`}>{title}</Text>,
  };
});

jest.mock('../../../../src/components/common/display/DetailField/DetailField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value }: { label: string; value: string }) => (
      <Text testID={`field-${label}`}>{`${label}=${value}`}</Text>
    ),
  };
});

jest.mock('../../../../src/components/common/display/TagList/TagList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ tags, emptyMessage }: { tags: { name: string }[]; emptyMessage: string }) => (
      <Text testID="tag-list">
        {JSON.stringify({ tags: tags.map((tag) => tag.name), emptyMessage })}
      </Text>
    ),
  };
});

jest.mock(
  '../../../../src/components/features/comments/CommentableDetailField/CommentableDetailField',
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

jest.mock('../../../../src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      editable,
      currentStoryId,
      currentEntityId,
      currentEntityType,
    }: {
      editable: boolean;
      currentStoryId: string;
      currentEntityId: string;
      currentEntityType: string;
    }) => (
      <Text testID="note-manager">
        {JSON.stringify({ editable, currentStoryId, currentEntityId, currentEntityType })}
      </Text>
    ),
  };
});

jest.mock('../../../../src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      storyId,
      entityType,
      entityId,
      editable,
    }: {
      storyId: string;
      entityType: string;
      entityId: string;
      editable: boolean;
    }) => (
      <Text testID="seealso">{JSON.stringify({ storyId, entityType, entityId, editable })}</Text>
    ),
  };
});

jest.mock('../../../../src/components/features/mentions/EntityMetadataWithBacklinks', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ version }: { version: number }) => (
      <Text testID="entity-metadata">{`v${version}`}</Text>
    ),
  };
});

jest.mock('../../../../src/components/common/controls/Button/Button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({ onPress, children }: { onPress: () => void; children: React.ReactNode }) => (
      <TouchableOpacity testID={`stub-button-${children}`} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

import ChoiceDetailScreen from '../../../../src/screens/narrative-elements/choices/ChoiceDetailScreen';
import { withSilencedConsole } from '../../../helpers/silenceConsole';

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeChoice(overrides = {}) {
  return {
    id: 'choice-1',
    storyId: 'story-1',
    sceneId: 'scene-1',
    nextSceneId: 'scene-2',
    text: 'Go left',
    notes: 'Risky',
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function mockServicesLoaded() {
  mockGetChoiceById.mockResolvedValue(makeChoice());
  mockGetCheckGroupsByChoiceId.mockResolvedValue([]);
  mockGetChecksByGroupId.mockResolvedValue([]);
  mockGetEffectsByEntity.mockResolvedValue([]);
  mockGetAllScenesByStoryId.mockResolvedValue([
    { id: 'scene-1', name: 'Opening' },
    { id: 'scene-2', name: 'Climax' },
  ]);
  mockGetItemsByStoryId.mockResolvedValue([{ id: 'item-1', name: 'Sword' }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedStory = { id: 'story-1', type: 'branching' };
  mockCanEdit = true;
  mockHeaderArgs = null;
  mockSubscriptions = [];
  mockServicesLoaded();
});

describe('ChoiceDetailScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('stays on loading while the choice resolves', async () => {
    mockGetChoiceById.mockReturnValue(new Promise(() => {}));
    const view = await render(<ChoiceDetailScreen />);
    expect(view.getByTestId('screen-loading').props.children).toBe('loading-Choice');
    expect(view.queryByTestId('detail-title')).toBeNull();
  });

  it('renders the choice content with scene links', async () => {
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByTestId('detail-title').props.children).toBe('Go left');
    expect(jsonOf(view, 'tag-list')).toMatchObject({ tags: ['Tag'] });
    expect(view.getByTestId('field-from-Scene').props.children).toBe('from-Scene=Opening');
    expect(view.getByTestId('field-next_scene').props.children).toBe('next_scene=Climax');
    expect(view.getByTestId('commentable-text').props.children).toBe('text:Go left');
    expect(view.getByTestId('commentable-choice_notes').props.children).toBe('choice_notes:Risky');
    expect(jsonOf(view, 'note-manager')).toMatchObject({
      editable: false,
      currentStoryId: 'story-1',
      currentEntityId: 'choice-1',
      currentEntityType: 'Choice',
    });
    expect(jsonOf(view, 'seealso')).toMatchObject({
      storyId: 'story-1',
      entityType: 'Choice',
      entityId: 'choice-1',
      editable: false,
    });
    expect(view.getByTestId('entity-metadata').props.children).toBe('v1');
    await fireEvent.press(view.getByTestId('stub-button-go_back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('falls back for missing text, notes and scene names', async () => {
    mockGetChoiceById.mockResolvedValue(
      makeChoice({ text: '', notes: null, sceneId: 'scene-9', nextSceneId: 'scene-8' }),
    );
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByTestId('field-from-Scene').props.children).toBe('from-Scene=common_na');
    expect(view.getByTestId('field-next_scene').props.children).toBe('next_scene=common_na');
    expect(view.getByTestId('commentable-text').props.children).toBe('text:common_na');
    expect(view.getByTestId('commentable-choice_notes').props.children).toBe(
      'choice_notes:common_na',
    );
  });

  it('navigates to the linked scenes', async () => {
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    await fireEvent.press(view.getByTestId('field-from-Scene'));
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Scene', 'scene-1');
    await fireEvent.press(view.getByTestId('field-next_scene'));
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Scene', 'scene-2');
  });

  it('renders empty check and effect states', async () => {
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByTestId('section-checks_title')).toBeTruthy();
    expect(view.getByText('checks_groups_and_note')).toBeTruthy();
    expect(view.getByTestId('field-checks_title').props.children).toBe(
      'checks_title=no_check_groups',
    );
    expect(view.getByTestId('section-effects_title')).toBeTruthy();
    expect(view.getByTestId('field-effects_title').props.children).toBe('effects_title=no_effects');
  });

  it('renders check groups with combinators and checks', async () => {
    mockGetCheckGroupsByChoiceId.mockResolvedValue([
      { id: 'g1', combinator: 'OR' },
      { id: 'g2', combinator: 'AND' },
    ]);
    mockGetChecksByGroupId.mockImplementation(async (_storyId: string, groupId: string) =>
      groupId === 'g1'
        ? [
            {
              id: 'c1',
              groupId: 'g1',
              type: 'inventory',
              mode: 'block',
              itemId: 'item-1',
              itemPresence: 'has',
            },
          ]
        : [],
    );
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByText('check_group_combinator_or_label')).toBeTruthy();
    expect(view.getByText('check_group_combinator_and_label')).toBeTruthy();
    expect(view.getByText('no_checks_in_group')).toBeTruthy();
    expect(view.getByText(/check_condition_prefix_block/)).toBeTruthy();
    expect(view.getByText(/check_condition_inventory_has/)).toBeTruthy();
    expect(mockGetChecksByGroupId).toHaveBeenCalledWith('story-1', 'g1');
    expect(mockGetChecksByGroupId).toHaveBeenCalledWith('story-1', 'g2');
  });

  it('renders choice effects', async () => {
    mockGetEffectsByEntity.mockResolvedValue([
      { id: 'e1', effectType: 'itemGrant', itemId: 'item-1' },
      { id: 'e2', effectType: 'triggerSet', triggerName: 'met_ada' },
    ]);
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByText(/effect_description_item_grant/)).toBeTruthy();
    expect(view.getByText(/effect_description_trigger_set/)).toBeTruthy();
    expect(view.queryByTestId('field-effects_title')).toBeNull();
  });

  it('hides checks and effects for linear stories', async () => {
    mockSelectedStory = { id: 'story-1', type: 'linear' };
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.queryByTestId('section-checks_title')).toBeNull();
    expect(view.queryByTestId('section-effects_title')).toBeNull();
    expect(mockGetCheckGroupsByChoiceId).not.toHaveBeenCalled();
    expect(mockGetEffectsByEntity).not.toHaveBeenCalled();
  });

  it('tolerates failing check and lookup loads', async () => {
    await withSilencedConsole(['error', 'warn'], async () => {
      mockGetCheckGroupsByChoiceId.mockRejectedValue(new Error('no groups'));
      mockGetAllScenesByStoryId.mockRejectedValue(new Error('no scenes'));
      const view = await render(<ChoiceDetailScreen />);
      await view.findByTestId('detail-title');
      expect(view.getByTestId('field-from-Scene').props.children).toBe('from-Scene=common_na');
      expect(view.getByTestId('field-checks_title').props.children).toBe(
        'checks_title=no_check_groups',
      );
    });
  });

  it('shows an error when loading fails and navigates back', async () => {
    await withSilencedConsole(['error', 'warn'], async () => {
      mockGetChoiceById.mockRejectedValue(new Error('db down'));
      const view = await render(<ChoiceDetailScreen />);
      await waitFor(() =>
        expect(view.getByTestId('screen-error').props.children).toBe('failed-Choice'),
      );
      expect(mockHeaderArgs?.title).toBe('error');
      await fireEvent.press(view.getByTestId('screen-error'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the not-found state for a missing choice', async () => {
    mockGetChoiceById.mockResolvedValue(null);
    const view = await render(<ChoiceDetailScreen />);
    await waitFor(() =>
      expect(view.getByTestId('screen-error').props.children).toBe('notfound-Choice'),
    );
    expect(mockHeaderArgs?.title).toBe('notfound-Choice');
  });

  it('navigates back when the choice was deleted', async () => {
    mockGetChoiceById.mockResolvedValue(makeChoice({ isDeleted: true }));
    await render(<ChoiceDetailScreen />);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  });

  it('opens the edit form from the header action', async () => {
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    const actions = mockHeaderArgs?.actions ?? [];
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ label: 'edit', visible: true });
    actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('ChoiceForm', { choiceId: 'choice-1' });
  });

  it('hides the edit action without edit rights', async () => {
    mockCanEdit = false;
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    expect((mockHeaderArgs?.actions ?? [])[0].visible).toBe(false);
  });

  it('refreshes the choice on change events', async () => {
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    const choiceChanged = mockSubscriptions.find((sub) => sub.event === 'choice_changed');
    expect(choiceChanged).toBeTruthy();
    mockGetChoiceById.mockResolvedValue(makeChoice({ text: 'Go right' }));
    await act(async () => {
      await (choiceChanged?.listener as (storyId: string, choiceId: string) => Promise<void>)(
        'story-1',
        'choice-1',
      );
    });
    await waitFor(() => expect(view.getByTestId('detail-title').props.children).toBe('Go right'));
    await waitFor(() => expect(mockHeaderArgs?.title).toBe('Go right'));
  });

  it('ignores change events for other choices', async () => {
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    const calls = mockGetChoiceById.mock.calls.length;
    const choiceChanged = mockSubscriptions.find((sub) => sub.event === 'choice_changed');
    await act(async () => {
      await (choiceChanged?.listener as (storyId: string, choiceId: string) => Promise<void>)(
        'story-1',
        'choice-9',
      );
    });
    expect(mockGetChoiceById.mock.calls.length).toBe(calls);
  });

  it('navigates back when a change event reports deletion', async () => {
    const view = await render(<ChoiceDetailScreen />);
    await view.findByTestId('detail-title');
    const choiceChanged = mockSubscriptions.find((sub) => sub.event === 'choice_changed');
    mockGetChoiceById.mockResolvedValue(null);
    await act(async () => {
      await (choiceChanged?.listener as (storyId: string, choiceId: string) => Promise<void>)(
        'story-1',
        'choice-1',
      );
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});
