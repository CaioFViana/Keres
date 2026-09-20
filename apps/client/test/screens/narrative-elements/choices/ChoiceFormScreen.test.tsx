import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

let mockRouteParams: { choiceId?: string; sceneId?: string } | undefined = {};
let mockSelectedStory: { id: string; type: string } | null = { id: 'story-1', type: 'branching' };

const mockSetSceneId = jest.fn();
const mockSetNextSceneId = jest.fn();
const mockSetText = jest.fn();
const mockSetNotes = jest.fn();
const mockSetSelectedTagIds = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();
const mockHandleAddCheckGroup = jest.fn();
const mockHandleUpdateCheckGroupCombinator = jest.fn();
const mockHandleDeleteCheckGroup = jest.fn();
const mockHandleAddCheck = jest.fn();
const mockHandleUpdateCheck = jest.fn();
const mockHandleDeleteCheck = jest.fn();
const mockHandleChangeCheckType = jest.fn();
const mockHandleAddEffect = jest.fn();
const mockHandleUpdateEffect = jest.fn();
const mockHandleChangeEffectType = jest.fn();
const mockHandleDeleteEffect = jest.fn();
const mockHandleTagSelectionChange = jest.fn();

let mockSaving = false;
let mockDeleting = false;

interface FormState {
  currentChoiceId?: string;
  sceneId: string | null;
  nextSceneId: string | null;
  text: string;
  notes: string | null;
  loading: boolean;
  isEditing: boolean;
  isDirty: boolean;
  resetForm: () => Promise<void>;
}

const baseFormState = (): FormState => ({
  currentChoiceId: undefined,
  sceneId: null,
  nextSceneId: null,
  text: '',
  notes: null,
  loading: false,
  isEditing: false,
  isDirty: false,
  resetForm: jest.fn().mockResolvedValue(undefined),
});

let mockFormState: FormState = baseFormState();

let mockScenes = [
  { id: 'scene-1', name: 'Opening' },
  { id: 'scene-2', name: 'Climax' },
];
let mockItems = [
  { id: 'item-1', name: 'Sword', isDeleted: false },
  { id: 'item-2', name: 'Rust', isDeleted: true },
];
let mockCheckGroups = [{ id: 'g1', combinator: 'AND' }];
let mockChoiceChecks = [{ id: 'c1', groupId: 'g1' }];
let mockChoiceEffects = [{ id: 'e1', effectType: 'itemGrant' }];
let mockAvailableTags = [{ id: 'tag-1', name: 'Tag', color: null as string | null }];
let mockSelectedTagIds: string[] = [];

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));

jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));

jest.mock('../../../../src/hooks/useEntityFormSecondaryDraft', () => ({
  __esModule: true,
  useEntityFormSecondaryDraft: () => ({
    persistSecondaryDraft: jest.fn(),
    clearSecondaryDraft: jest.fn(),
  }),
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));

jest.mock('../../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      primary: '#0000ff',
      primaryContainer: '#aaaaff',
      error: '#ff0000',
      surface: '#f5f5f5',
      background: '#ffffff',
      text: '#111111',
      textSecondary: '#555555',
    },
  }),
}));

jest.mock('../../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: (kind: string) => ({
    entity: `${kind}-entity`,
    editTitle: `edit-${kind}`,
    createTitle: `create-${kind}`,
    formDescription: `desc-${kind}`,
    saveLabel: `save-${kind}`,
    deleteLabel: `delete-${kind}`,
    select: `select-${kind}`,
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../src/screens/narrative-elements/choices/useChoiceFormResources', () => ({
  __esModule: true,
  useChoiceFormResources: () => ({
    choiceServiceRef: { current: null },
    scenes: mockScenes,
    items: mockItems,
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/choices/useChoiceFormState', () => ({
  __esModule: true,
  useChoiceFormState: () => ({
    ...mockFormState,
    setSceneId: mockSetSceneId,
    setNextSceneId: mockSetNextSceneId,
    setText: mockSetText,
    setNotes: mockSetNotes,
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/choices/useChoiceFormAssociations', () => ({
  __esModule: true,
  useChoiceFormAssociations: () => ({
    checks: {
      checkGroups: mockCheckGroups,
      checks: mockChoiceChecks,
      handleAddCheckGroup: mockHandleAddCheckGroup,
      handleUpdateCheckGroupCombinator: mockHandleUpdateCheckGroupCombinator,
      handleDeleteCheckGroup: mockHandleDeleteCheckGroup,
      handleAddCheck: mockHandleAddCheck,
      handleUpdateCheck: mockHandleUpdateCheck,
      handleDeleteCheck: mockHandleDeleteCheck,
      handleChangeCheckType: mockHandleChangeCheckType,
    },
    effects: {
      effects: mockChoiceEffects,
      handleAddEffect: mockHandleAddEffect,
      handleUpdateEffect: mockHandleUpdateEffect,
      handleChangeEffectType: mockHandleChangeEffectType,
      handleDeleteEffect: mockHandleDeleteEffect,
    },
    relations: {
      availableTags: mockAvailableTags,
      selectedTagIds: mockSelectedTagIds,
      setSelectedTagIds: mockSetSelectedTagIds,
      allNotes: [],
      noteRelations: [],
      pendingNoteRelations: [],
      persistTagRelations: jest.fn(),
      saveNoteRelation: mockSaveNoteRelation,
      deleteNoteRelation: mockDeleteNoteRelation,
      persistNoteRelations: jest.fn(),
      handleTagSelectionChange: mockHandleTagSelectionChange,
    },
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/choices/useChoiceFormActions', () => ({
  __esModule: true,
  useChoiceFormActions: () => ({
    deleting: mockDeleting,
    handleDelete: mockHandleDelete,
    handleSave: mockHandleSave,
    saving: mockSaving,
    seeAlsoManagerRef: { current: null },
  }),
}));

jest.mock('../../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: () => <Text testID="screen-loading">loading</Text>,
  };
});

jest.mock('../../../../src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      description,
      actions,
      children,
    }: {
      title: string;
      description: string;
      actions: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <>
        <Text testID="form-title">{title}</Text>
        <Text testID="form-description">{description}</Text>
        {actions}
        {children}
      </>
    ),
  };
});

jest.mock('../../../../src/components/common/controls/Button/Button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({
      onPress,
      disabled,
      children,
    }: {
      onPress: () => void;
      disabled?: boolean;
      children: React.ReactNode;
    }) => (
      <TouchableOpacity testID={`stub-button-${children}`} onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../../../src/components/common/forms/FormField/FormField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      children,
    }: {
      label: string;
      children: React.ReactNode | ((a11y: object) => React.ReactNode);
    }) => (
      <>
        <Text testID={`field-${label}`}>{label}</Text>
        {typeof children === 'function' ? children({}) : children}
      </>
    ),
  };
});

jest.mock('../../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return {
    __esModule: true,
    default: ({
      placeholder,
      value,
      onChangeText,
      multiline,
    }: {
      placeholder: string;
      value: string;
      onChangeText: (v: string) => void;
      multiline?: boolean;
    }) => (
      <TextInput
        testID={`input-${placeholder}`}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
      />
    ),
  };
});

jest.mock('../../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      options,
      selectedValues,
      onSelectionChange,
      placeholder,
      label,
    }: {
      options: unknown[];
      selectedValues: string[];
      onSelectionChange: (ids: string[]) => void;
      placeholder: string;
      label: string;
    }) => (
      <>
        <Text testID="tags-pill">
          {JSON.stringify({ options, selectedValues, placeholder, label })}
        </Text>
        <Text testID="tags-pill-change" onPress={() => onSelectionChange(['tag-1'])}>
          pick
        </Text>
      </>
    ),
    SingleSelectPill: ({
      options,
      value,
      onValueChange,
      placeholder,
    }: {
      options: unknown[];
      value: string | null;
      onValueChange: (v: string) => void;
      placeholder: string;
    }) => (
      <>
        <Text testID="single-pill">{JSON.stringify({ options, value, placeholder })}</Text>
        <Text testID="single-pill-change" onPress={() => onValueChange('picked')}>
          pick
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/choices/ChoiceCheckGroupEditor', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      checkGroups: unknown[];
      checks: unknown[];
      combinatorOptions: unknown[];
      checkTypeOptions: unknown[];
      checkModeOptions: unknown[];
      sceneOptions: unknown[];
      itemOptions: unknown[];
      itemPresenceOptions: unknown[];
      triggerStateOptions: unknown[];
      scenePlaceholder: string;
      onUpdateCombinator: (id: string, c: string) => void;
      onDeleteGroup: (id: string) => void;
      onAddGroup: () => void;
      onChangeCheckType: (id: string, t: string) => void;
      onUpdateCheck: (id: string, v: unknown) => void;
      onDeleteCheck: (id: string) => void;
      onAddCheck: (groupId: string) => void;
    }) => (
      <>
        <Text testID="check-editor">
          {JSON.stringify({
            groups: props.checkGroups.length,
            checks: props.checks.length,
            combinators: props.combinatorOptions,
            checkTypes: props.checkTypeOptions,
            checkModes: props.checkModeOptions,
            scenes: props.sceneOptions,
            items: props.itemOptions,
            presence: props.itemPresenceOptions,
            triggers: props.triggerStateOptions,
            scenePlaceholder: props.scenePlaceholder,
          })}
        </Text>
        <Text testID="check-add-group" onPress={() => props.onAddGroup()}>
          add-group
        </Text>
        <Text testID="check-update-combinator" onPress={() => props.onUpdateCombinator('g1', 'OR')}>
          combinator
        </Text>
        <Text testID="check-delete-group" onPress={() => props.onDeleteGroup('g1')}>
          del-group
        </Text>
        <Text testID="check-add" onPress={() => props.onAddCheck('g1')}>
          add-check
        </Text>
        <Text testID="check-update" onPress={() => props.onUpdateCheck('c1', { v: 1 })}>
          upd-check
        </Text>
        <Text testID="check-delete" onPress={() => props.onDeleteCheck('c1')}>
          del-check
        </Text>
        <Text testID="check-change-type" onPress={() => props.onChangeCheckType('c1', 'inventory')}>
          change-type
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/effects/EffectListEditor', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      effects: unknown[];
      itemOptions: unknown[];
      itemLabel: string;
      onChangeType: (id: string, t: string) => void;
      onUpdate: (id: string, v: unknown) => void;
      onDelete: (id: string) => void;
      onAdd: () => void;
    }) => (
      <>
        <Text testID="effect-editor">
          {JSON.stringify({
            effects: props.effects.length,
            items: props.itemOptions,
            itemLabel: props.itemLabel,
          })}
        </Text>
        <Text testID="effect-add" onPress={() => props.onAdd()}>
          add
        </Text>
        <Text testID="effect-update" onPress={() => props.onUpdate('e1', { v: 1 })}>
          upd
        </Text>
        <Text testID="effect-change-type" onPress={() => props.onChangeType('e1', 'itemTake')}>
          change
        </Text>
        <Text testID="effect-delete" onPress={() => props.onDelete('e1')}>
          del
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      currentStoryId,
      currentEntityId,
      currentEntityType,
      editable,
    }: {
      currentStoryId: string;
      currentEntityId: string;
      currentEntityType: string;
      editable: boolean;
    }) => (
      <Text testID="note-manager">
        {JSON.stringify({ currentStoryId, currentEntityId, currentEntityType, editable })}
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
      <Text testID="seealso-manager">
        {JSON.stringify({ storyId, entityType, entityId, editable })}
      </Text>
    ),
  };
});

import ChoiceFormScreen from '../../../../src/screens/narrative-elements/choices/ChoiceFormScreen';

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

function jsonAllOf(view: RenderResult, testID: string) {
  return view.getAllByTestId(testID).map((el) => JSON.parse(el.props.children as string));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  mockSelectedStory = { id: 'story-1', type: 'branching' };
  mockSaving = false;
  mockDeleting = false;
  mockFormState = baseFormState();
  mockScenes = [
    { id: 'scene-1', name: 'Opening' },
    { id: 'scene-2', name: 'Climax' },
  ];
  mockItems = [
    { id: 'item-1', name: 'Sword', isDeleted: false },
    { id: 'item-2', name: 'Rust', isDeleted: true },
  ];
  mockCheckGroups = [{ id: 'g1', combinator: 'AND' }];
  mockChoiceChecks = [{ id: 'c1', groupId: 'g1' }];
  mockChoiceEffects = [{ id: 'e1', effectType: 'itemGrant' }];
  mockAvailableTags = [{ id: 'tag-1', name: 'Tag', color: null }];
  mockSelectedTagIds = [];
});

describe('ChoiceFormScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the loading state', async () => {
    mockFormState = { ...baseFormState(), loading: true };
    const view = await render(<ChoiceFormScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
    expect(view.queryByTestId('form-title')).toBeNull();
  });

  it('renders the create form and saves', async () => {
    const view = await render(<ChoiceFormScreen />);
    expect(view.getByTestId('form-title').props.children).toBe('create-Choice');
    expect(view.getByTestId('form-description').props.children).toBe('desc-Choice');
    await fireEvent.press(view.getByText('save-Choice'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
    expect(view.queryByText('delete-Choice')).toBeNull();
  });

  it('renders the edit form with delete', async () => {
    mockFormState = { ...baseFormState(), currentChoiceId: 'choice-1', isEditing: true };
    const view = await render(<ChoiceFormScreen />);
    expect(view.getByTestId('form-title').props.children).toBe('edit-Choice');
    await fireEvent.press(view.getByText('delete-Choice'));
    expect(mockHandleDelete).toHaveBeenCalledTimes(1);
  });

  it('wires the text inputs to the form state', async () => {
    mockFormState = { ...baseFormState(), text: 'Go left', notes: 'Risky' };
    const view = await render(<ChoiceFormScreen />);
    expect(view.getByTestId('input-text_placeholder').props.value).toBe('Go left');
    await fireEvent.changeText(view.getByTestId('input-text_placeholder'), 'Go right');
    expect(mockSetText).toHaveBeenCalledWith('Go right');
    await fireEvent.changeText(view.getByTestId('input-choice_notes_placeholder'), 'Safe');
    expect(mockSetNotes).toHaveBeenCalledWith('Safe');
  });

  it('falls back to an empty string for missing notes', async () => {
    const view = await render(<ChoiceFormScreen />);
    expect(view.getByTestId('input-choice_notes_placeholder').props.value).toBe('');
  });

  it('wires the from and next scene selectors', async () => {
    mockFormState = { ...baseFormState(), sceneId: 'scene-1', nextSceneId: 'scene-2' };
    const view = await render(<ChoiceFormScreen />);
    expect(view.getByTestId('field-text')).toBeTruthy();
    const pills = jsonAllOf(view, 'single-pill');
    expect(pills).toHaveLength(2);
    expect(pills[0]).toMatchObject({
      options: [
        { label: 'Opening', value: 'scene-1' },
        { label: 'Climax', value: 'scene-2' },
      ],
      value: 'scene-1',
      placeholder: 'select-Scene',
    });
    expect(pills[1]).toMatchObject({ value: 'scene-2' });
    const triggers = view.getAllByTestId('single-pill-change');
    await fireEvent.press(triggers[0]);
    expect(mockSetSceneId).toHaveBeenCalledWith('picked');
    await fireEvent.press(triggers[1]);
    expect(mockSetNextSceneId).toHaveBeenCalledWith('picked');
  });

  it('wires the tag selector', async () => {
    const view = await render(<ChoiceFormScreen />);
    expect(jsonOf(view, 'tags-pill')).toMatchObject({
      placeholder: 'select_tags_for_choice',
      label: 'choice_tags',
    });
    await fireEvent.press(view.getByTestId('tags-pill-change'));
    expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-1']);
  });

  it('hides check and effect editors for a draft choice', async () => {
    const view = await render(<ChoiceFormScreen />);
    expect(view.queryByTestId('check-editor')).toBeNull();
    expect(view.queryByTestId('effect-editor')).toBeNull();
  });

  it('hides check and effect editors in linear stories', async () => {
    mockSelectedStory = { id: 'story-1', type: 'linear' };
    mockFormState = { ...baseFormState(), currentChoiceId: 'choice-1', isEditing: true };
    const view = await render(<ChoiceFormScreen />);
    expect(view.queryByTestId('check-editor')).toBeNull();
    expect(view.queryByTestId('effect-editor')).toBeNull();
  });

  it('renders the check editor with option vocabularies', async () => {
    mockFormState = { ...baseFormState(), currentChoiceId: 'choice-1', isEditing: true };
    const view = await render(<ChoiceFormScreen />);
    const editor = jsonOf(view, 'check-editor');
    expect(editor).toMatchObject({
      groups: 1,
      checks: 1,
      scenePlaceholder: 'select-Scene',
      combinators: [
        { label: 'combinator_and', value: 'AND' },
        { label: 'combinator_or', value: 'OR' },
      ],
      checkTypes: [
        { label: 'check_type_scene_count', value: 'sceneCount' },
        { label: 'check_type_inventory', value: 'inventory' },
        { label: 'check_type_trigger', value: 'trigger' },
      ],
      checkModes: [
        { label: 'check_mode_block', value: 'block' },
        { label: 'check_mode_enable', value: 'enable' },
      ],
      presence: [
        { label: 'item_presence_has', value: 'has' },
        { label: 'item_presence_lacks', value: 'lacks' },
      ],
      triggers: [
        { label: 'trigger_state_set', value: 'set' },
        { label: 'trigger_state_unset', value: 'unset' },
      ],
    });
    expect(editor.items).toEqual([{ label: 'Sword', value: 'item-1' }]);
    await fireEvent.press(view.getByTestId('check-add-group'));
    expect(mockHandleAddCheckGroup).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('check-update-combinator'));
    expect(mockHandleUpdateCheckGroupCombinator).toHaveBeenCalledWith('g1', 'OR');
    await fireEvent.press(view.getByTestId('check-delete-group'));
    expect(mockHandleDeleteCheckGroup).toHaveBeenCalledWith('g1');
    await fireEvent.press(view.getByTestId('check-add'));
    expect(mockHandleAddCheck).toHaveBeenCalledWith('g1');
    await fireEvent.press(view.getByTestId('check-update'));
    expect(mockHandleUpdateCheck).toHaveBeenCalledWith('c1', { v: 1 });
    await fireEvent.press(view.getByTestId('check-delete'));
    expect(mockHandleDeleteCheck).toHaveBeenCalledWith('c1');
    await fireEvent.press(view.getByTestId('check-change-type'));
    expect(mockHandleChangeCheckType).toHaveBeenCalledWith('c1', 'inventory');
  });

  it('renders the effect editor and wires its handlers', async () => {
    mockFormState = { ...baseFormState(), currentChoiceId: 'choice-1', isEditing: true };
    const view = await render(<ChoiceFormScreen />);
    expect(jsonOf(view, 'effect-editor')).toMatchObject({
      effects: 1,
      items: [{ label: 'Sword', value: 'item-1' }],
      itemLabel: 'check_item',
    });
    await fireEvent.press(view.getByTestId('effect-add'));
    expect(mockHandleAddEffect).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('effect-update'));
    expect(mockHandleUpdateEffect).toHaveBeenCalledWith('e1', { v: 1 });
    await fireEvent.press(view.getByTestId('effect-change-type'));
    expect(mockHandleChangeEffectType).toHaveBeenCalledWith('e1', 'itemTake');
    await fireEvent.press(view.getByTestId('effect-delete'));
    expect(mockHandleDeleteEffect).toHaveBeenCalledWith('e1');
  });

  it('renders note and see-also managers for the draft entity', async () => {
    const view = await render(<ChoiceFormScreen />);
    expect(jsonOf(view, 'note-manager')).toMatchObject({
      currentStoryId: 'story-1',
      currentEntityId: '',
      currentEntityType: 'Choice',
      editable: true,
    });
    expect(jsonOf(view, 'seealso-manager')).toMatchObject({
      storyId: 'story-1',
      entityType: 'Choice',
      entityId: '',
      editable: true,
    });
  });

  it('hides story-bound sections without a story', async () => {
    mockSelectedStory = null;
    const view = await render(<ChoiceFormScreen />);
    expect(view.queryByTestId('tags-pill')).toBeNull();
    expect(view.queryByTestId('note-manager')).toBeNull();
    expect(view.queryByTestId('seealso-manager')).toBeNull();
  });

  it('disables actions while saving or deleting', async () => {
    mockSaving = true;
    const savingView = await render(<ChoiceFormScreen />);
    await fireEvent.press(savingView.getByTestId('stub-button-save-Choice'));
    expect(mockHandleSave).not.toHaveBeenCalled();
    mockSaving = false;
    mockDeleting = true;
    mockFormState = { ...baseFormState(), isEditing: true };
    const deletingView = await render(<ChoiceFormScreen />);
    await fireEvent.press(deletingView.getByTestId('stub-button-delete-Choice'));
    expect(mockHandleDelete).not.toHaveBeenCalled();
  });
});
