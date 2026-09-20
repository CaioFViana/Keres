import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockShowNotification = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockReadSecondaryDraft = jest.fn();
const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();

let mockRouteParams: { characterId?: string } = {};
let mockFormState: Record<string, unknown> = {};
let mockSaving = false;
let mockDeleting = false;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/hooks/useStorySchemaFields', () => ({
  __esModule: true,
  useStorySchemaFields: () => [],
}));
jest.mock('../../../src/hooks/useEntityFormSecondaryDraft', () => ({
  __esModule: true,
  useEntityFormSecondaryDraft: () => ({
    persistSecondaryDraft: jest.fn(),
    clearSecondaryDraft: jest.fn(),
  }),
}));
jest.mock('../../../src/services/storymanagement/EntityFormSecondaryDraftStore', () => ({
  __esModule: true,
  readEntityFormSecondaryDraft: (...args: unknown[]) => mockReadSecondaryDraft(...args),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => mockShowNotification,
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: { id: 'story-1' } }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { error: '#f00', primaryContainer: '#eef' }, isDarkMode: false }),
}));
jest.mock('../../../src/theme/commonStyles', () => ({
  __esModule: true,
  getCommonInputStyles: () => ({ input: {}, multiline: {} }),
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: () => ({
    createTitle: 'Create character',
    editTitle: 'Edit character',
    formDescription: 'Character fields',
    saveLabel: 'Save',
    deleteLabel: 'Delete',
  }),
}));
jest.mock('../../../src/screens/characters/useCharacterFormResources', () => ({
  __esModule: true,
  useCharacterFormResources: () => ({
    drizzleDb: {},
    characterServiceRef: { current: {} },
    characterRelationServiceRef: { current: {} },
  }),
}));
jest.mock('../../../src/screens/characters/useCharacterFormState', () => ({
  __esModule: true,
  useCharacterFormState: () => mockFormState,
}));
jest.mock('../../../src/screens/characters/useCharacterFormAssociations', () => ({
  __esModule: true,
  useCharacterFormAssociations: () => ({
    availableTags: [{ id: 'tag-1', name: 'Hero' }],
    selectedTagIds: ['tag-1'],
    allNotes: [],
    characterNoteRelations: [],
    pendingNoteRelations: [],
    persistTagRelations: jest.fn(),
    saveNoteRelation: jest.fn(),
    deleteNoteRelation: jest.fn(),
    persistNoteRelations: jest.fn(),
    handleTagSelectionChange: jest.fn(),
    allCharacters: [],
    characterRelations: [],
    pendingCharacterRelations: [],
    handleSaveRelation: jest.fn(),
    handleDeleteRelation: jest.fn(),
    persistPendingCharacterRelations: jest.fn(),
    statData: { modes: [], stats: [] },
    characterModes: [],
    modeService: jest.fn(),
    statRelationService: jest.fn(),
  }),
}));
jest.mock('../../../src/screens/characters/useCharacterFormActions', () => ({
  __esModule: true,
  useCharacterFormActions: () => ({
    deleting: mockDeleting,
    handleDelete: mockHandleDelete,
    handleSave: mockHandleSave,
    saving: mockSaving,
    seeAlsoManagerRef: { current: null },
  }),
}));
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenLoading: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-loading' }, 'loading');
  },
}));
jest.mock('../../../src/screens/characters/CharacterFormContent', () => ({
  __esModule: true,
  CharacterFormContent: (props: {
    formTitle: string;
    formDescription?: string;
    name: string;
    saving: boolean;
    deleting: boolean;
    isEditing: boolean;
    selectedTagIds: string[];
    handleSave: () => void;
    handleDelete: () => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        { testID: 'form-marker' },
        JSON.stringify({
          title: props.formTitle,
          description: props.formDescription,
          name: props.name,
          saving: props.saving,
          deleting: props.deleting,
          editing: props.isEditing,
          tags: props.selectedTagIds,
        }),
      ),
      react.createElement(native.Text, { testID: 'form-save', onPress: props.handleSave }, 'save'),
      react.createElement(
        native.Text,
        { testID: 'form-delete', onPress: props.handleDelete },
        'delete',
      ),
    );
  },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import CharacterFormScreen from '../../../src/screens/characters/CharacterFormScreen';

function freshFormState(overrides: Record<string, unknown> = {}) {
  const noop = jest.fn();
  return {
    currentCharacterId: 'char-1',
    name: 'Aria',
    setName: noop,
    title: null,
    setTitle: noop,
    description: null,
    setDescription: noop,
    gender: null,
    setGender: noop,
    race: null,
    setRace: noop,
    subrace: null,
    setSubrace: noop,
    personality: null,
    setPersonality: noop,
    motivation: null,
    setMotivation: noop,
    qualities: null,
    setQualities: noop,
    weaknesses: null,
    setWeaknesses: noop,
    biography: null,
    setBiography: noop,
    plannedTimeline: null,
    setPlannedTimeline: noop,
    isFavorite: false,
    setIsFavorite: noop,
    extraNotes: null,
    setExtraNotes: noop,
    customValues: {},
    setCustomValues: noop,
    loading: false,
    isEditing: true,
    isDirty: true,
    resetForm: noop,
    ...overrides,
  };
}

function jsonOf(view: { getByTestId: (id: string) => { props: { children?: unknown } } }) {
  return JSON.parse(view.getByTestId('form-marker').props.children as string);
}

describe('CharacterFormScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    mockFormState = freshFormState({ currentCharacterId: undefined, isEditing: false });
    mockSaving = false;
    mockDeleting = false;
    mockReadSecondaryDraft.mockResolvedValue(null);
  });

  it('shows the loading state while the form state loads', async () => {
    mockFormState = freshFormState({ loading: true });
    const view = await render(<CharacterFormScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
  });

  it('renders the create form without an initial character id', async () => {
    const view = await render(<CharacterFormScreen />);
    expect(jsonOf(view)).toMatchObject({
      title: 'Create character',
      description: 'Character fields',
      name: 'Aria',
      editing: false,
      tags: ['tag-1'],
    });
    await fireEvent.press(view.getByTestId('form-save'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('form-delete'));
    expect(mockHandleDelete).toHaveBeenCalledTimes(1);
    expect(mockUseScreenHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Create character' }),
    );
  });

  it('renders the edit form with an initial character id', async () => {
    mockRouteParams = { characterId: 'char-1' };
    mockFormState = freshFormState();
    const view = await render(<CharacterFormScreen />);
    expect(jsonOf(view)).toMatchObject({ title: 'Edit character', editing: true });
    expect(mockUseScreenHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Edit character' }),
    );
    await waitFor(() =>
      expect(mockReadSecondaryDraft).toHaveBeenCalledWith('story-1', 'Character', 'char-1'),
    );
  });

  it('notifies when a secondary draft was restored', async () => {
    mockRouteParams = { characterId: 'char-1' };
    mockFormState = freshFormState();
    mockReadSecondaryDraft.mockResolvedValue({
      selectedTagIds: [],
      pendingNoteRelations: [{ id: 'nr-1' }],
      pendingEntityRelations: [],
      customValues: {},
    });
    await render(<CharacterFormScreen />);
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith('entity_secondary_draft_restored', 'info'),
    );
  });

  it('stays silent when no draft exists', async () => {
    mockRouteParams = { characterId: 'char-1' };
    mockFormState = freshFormState();
    await render(<CharacterFormScreen />);
    await waitFor(() => expect(mockReadSecondaryDraft).toHaveBeenCalled());
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('registers a reset header action while dirty', async () => {
    await render(<CharacterFormScreen />);
    const config = mockUseScreenHeader.mock.calls.at(-1)?.[0] as {
      actions: Array<{ id: string; icon: string; disabled: boolean; onPress: () => void }>;
    };
    expect(config.actions).toHaveLength(1);
    expect(config.actions[0]).toMatchObject({
      id: 'reset-form',
      icon: 'arrow-undo-outline',
      disabled: false,
    });
  });

  it('disables the reset header action while pristine', async () => {
    mockFormState = freshFormState({ isDirty: false });
    await render(<CharacterFormScreen />);
    const config = mockUseScreenHeader.mock.calls.at(-1)?.[0] as {
      actions: Array<{ disabled: boolean }>;
    };
    expect(config.actions[0].disabled).toBe(true);
  });
});
