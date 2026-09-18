import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

let mockRouteParams: { sceneId?: string; chapterId?: string } | undefined = {};
let mockSelectedStory: { id: string; type: string } | null = { id: 'story-1', type: 'branching' };
let mockCustomFields: unknown[] = [];
let mockCalendars: unknown[] = [];
let mockSaving = false;
let mockDeleting = false;

const mockSetChapterId = jest.fn();
const mockSetLocationId = jest.fn();
const mockSetName = jest.fn();
const mockSetSummary = jest.fn();
const mockSetIsFavorite = jest.fn();
const mockSetExtraNotes = jest.fn();
const mockSetGapInput = jest.fn();
const mockSetGapType = jest.fn();
const mockSetCalendarDateOverride = jest.fn();
const mockSetCalendarDateOverrideCalendarId = jest.fn();
const mockSetDurationInput = jest.fn();
const mockSetDurationType = jest.fn();
const mockSetIsStart = jest.fn();
const mockSetIsFinish = jest.fn();
const mockSetCustomValues = jest.fn();
const mockSetSelectedTagIds = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();
const mockHandleSaveCharacterSceneRelation = jest.fn();
const mockHandleDeleteCharacterSceneRelation = jest.fn();
const mockHandleAddEffect = jest.fn();
const mockHandleUpdateEffect = jest.fn();
const mockHandleChangeEffectType = jest.fn();
const mockHandleDeleteEffect = jest.fn();

interface FormState {
  currentSceneId?: string;
  chapterId: string | null;
  locationId: string | null;
  name: string;
  summary: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  gapInput: string;
  gapType: string | null;
  calendarDateOverride: string;
  calendarDateOverrideCalendarId: string | null;
  durationInput: string;
  durationType: string | null;
  isStart: boolean;
  isFinish: boolean;
  customValues: Record<string, unknown>;
  loading: boolean;
  isEditing: boolean;
}

const baseFormState = (): FormState => ({
  currentSceneId: undefined,
  chapterId: null,
  locationId: null,
  name: '',
  summary: null,
  isFavorite: false,
  extraNotes: null,
  gapInput: '',
  gapType: null,
  calendarDateOverride: '',
  calendarDateOverrideCalendarId: null,
  durationInput: '',
  durationType: null,
  isStart: false,
  isFinish: false,
  customValues: {},
  loading: false,
  isEditing: false,
});

let mockFormState: FormState = baseFormState();

let mockChapters = [{ id: 'ch-1', name: 'Arrival' }];
let mockLocations = [{ id: 'loc-1', name: 'Harbor' }];
let mockCharacters = [
  { id: 'char-1', name: 'Ada', isDeleted: false },
  { id: 'char-2', name: 'Ghost', isDeleted: true },
];
let mockItems = [
  { id: 'item-1', name: 'Sword', isDeleted: false },
  { id: 'item-2', name: 'Rust', isDeleted: true },
];
let mockCharacterSceneRelations = [{ id: 'rel-1' }];
let mockPendingCharacterSceneRelations = [{ id: 'pending-1' }];
let mockSceneEffects = [{ id: 'e1', effectType: 'itemGrant' }];
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

jest.mock('../../../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: () => ({ calendars: mockCalendars }),
}));

jest.mock('../../../../src/hooks/useStorySchemaFields', () => ({
  __esModule: true,
  useStorySchemaFields: () => mockCustomFields,
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
    selectOptional: `select-opt-${kind}`,
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../src/screens/narrative-elements/scenes/useSceneFormResources', () => ({
  __esModule: true,
  useSceneFormResources: () => ({
    drizzleDb: {},
    sceneServiceRef: { current: null },
    chapters: mockChapters,
    locations: mockLocations,
    characters: mockCharacters,
    items: mockItems,
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/scenes/useSceneFormState', () => ({
  __esModule: true,
  useSceneFormState: () => ({
    ...mockFormState,
    setChapterId: mockSetChapterId,
    setLocationId: mockSetLocationId,
    setName: mockSetName,
    setSummary: mockSetSummary,
    setIsFavorite: mockSetIsFavorite,
    setExtraNotes: mockSetExtraNotes,
    setGapInput: mockSetGapInput,
    setGapType: mockSetGapType,
    setCalendarDateOverride: mockSetCalendarDateOverride,
    setCalendarDateOverrideCalendarId: mockSetCalendarDateOverrideCalendarId,
    setDurationInput: mockSetDurationInput,
    setDurationType: mockSetDurationType,
    setIsStart: mockSetIsStart,
    setIsFinish: mockSetIsFinish,
    setCustomValues: mockSetCustomValues,
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/scenes/useSceneFormAssociations', () => ({
  __esModule: true,
  useSceneFormAssociations: () => ({
    characterPresence: {
      characterSceneRelations: mockCharacterSceneRelations,
      pendingCharacterSceneRelations: mockPendingCharacterSceneRelations,
      handleSaveCharacterSceneRelation: mockHandleSaveCharacterSceneRelation,
      handleDeleteCharacterSceneRelation: mockHandleDeleteCharacterSceneRelation,
      persistPendingCharacterSceneRelations: jest.fn(),
    },
    effects: {
      effects: mockSceneEffects,
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
    },
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/scenes/useSceneFormActions', () => ({
  __esModule: true,
  useSceneFormActions: () => ({
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
      help,
      children,
    }: {
      label: string;
      help?: string;
      children: React.ReactNode | ((a11y: object) => React.ReactNode);
    }) => (
      <>
        <Text testID={`field-${label}`}>{help ? `${label}:${help}` : label}</Text>
        {typeof children === 'function' ? children({}) : children}
      </>
    ),
  };
});

jest.mock('../../../../src/components/common/forms/FormSwitchField/FormSwitchField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onValueChange,
    }: {
      label: string;
      value: boolean;
      onValueChange: (v: boolean) => void;
    }) => (
      <Text testID={`switch-${label}`} onPress={() => onValueChange(!value)}>
        {`${label}:${value}`}
      </Text>
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

jest.mock(
  '../../../../src/components/common/forms/CustomAttributeFields/CustomAttributeFields',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({
        storyId,
        fields,
        values,
        onChange,
      }: {
        storyId: string;
        fields: unknown[];
        values: Record<string, unknown>;
        onChange: (fieldId: string, value: unknown) => void;
      }) => (
        <>
          <Text testID="custom-fields">
            {JSON.stringify({ storyId, fields: fields.length, values })}
          </Text>
          <Text testID="custom-fields-change" onPress={() => onChange('f1', 'v1')}>
            edit
          </Text>
        </>
      ),
    };
  },
);

jest.mock('../../../../src/components/features/scenes/SceneTimingFields', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      gapInput: string;
      onGapInputChange: (v: string) => void;
      gapType: string | null;
      onGapTypeChange: (v: string) => void;
      durationInput: string;
      onDurationInputChange: (v: string) => void;
      durationType: string | null;
      onDurationTypeChange: (v: string) => void;
      calendarDateOverride: string;
      onCalendarDateOverrideChange: (v: string) => void;
      calendarDateOverrideCalendarId: string | null;
      onCalendarDateOverrideCalendarIdChange: (v: string) => void;
      calendars: unknown[];
    }) => (
      <>
        <Text testID="timing-fields">
          {JSON.stringify({
            gapInput: props.gapInput,
            gapType: props.gapType,
            durationInput: props.durationInput,
            durationType: props.durationType,
            calendarDateOverride: props.calendarDateOverride,
            calendarDateOverrideCalendarId: props.calendarDateOverrideCalendarId,
            calendars: props.calendars.length,
          })}
        </Text>
        <Text testID="timing-gap" onPress={() => props.onGapInputChange('2')}>
          gap
        </Text>
        <Text testID="timing-gap-type" onPress={() => props.onGapTypeChange('days')}>
          gap-type
        </Text>
        <Text testID="timing-duration" onPress={() => props.onDurationInputChange('3')}>
          duration
        </Text>
        <Text testID="timing-duration-type" onPress={() => props.onDurationTypeChange('hours')}>
          duration-type
        </Text>
        <Text testID="timing-override" onPress={() => props.onCalendarDateOverrideChange('D5')}>
          override
        </Text>
        <Text
          testID="timing-override-cal"
          onPress={() => props.onCalendarDateOverrideCalendarIdChange('cal-1')}
        >
          override-cal
        </Text>
      </>
    ),
  };
});

jest.mock(
  '../../../../src/components/features/characters/CharacterManager/SceneCharacterManager',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        characterRelations: unknown[];
        availableCharacters: { name: string }[];
        onSave: (r: unknown) => void;
        onDelete: (id: string) => void;
        editable: boolean;
        currentStoryId: string;
        currentSceneId: string;
      }) => (
        <>
          <Text testID="character-manager">
            {JSON.stringify({
              relations: props.characterRelations.length,
              available: props.availableCharacters.map((c) => c.name),
              editable: props.editable,
              currentStoryId: props.currentStoryId,
              currentSceneId: props.currentSceneId,
            })}
          </Text>
          <Text testID="character-save" onPress={() => props.onSave({ id: 'rel-9' })}>
            save
          </Text>
          <Text testID="character-delete" onPress={() => props.onDelete('rel-9')}>
            delete
          </Text>
        </>
      ),
    };
  },
);

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

import SceneFormScreen from '../../../../src/screens/narrative-elements/scenes/SceneFormScreen';

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
  mockCustomFields = [];
  mockCalendars = [];
  mockSaving = false;
  mockDeleting = false;
  mockFormState = baseFormState();
  mockChapters = [{ id: 'ch-1', name: 'Arrival' }];
  mockLocations = [{ id: 'loc-1', name: 'Harbor' }];
  mockCharacters = [
    { id: 'char-1', name: 'Ada', isDeleted: false },
    { id: 'char-2', name: 'Ghost', isDeleted: true },
  ];
  mockItems = [
    { id: 'item-1', name: 'Sword', isDeleted: false },
    { id: 'item-2', name: 'Rust', isDeleted: true },
  ];
  mockCharacterSceneRelations = [{ id: 'rel-1' }];
  mockPendingCharacterSceneRelations = [{ id: 'pending-1' }];
  mockSceneEffects = [{ id: 'e1', effectType: 'itemGrant' }];
  mockAvailableTags = [{ id: 'tag-1', name: 'Tag', color: null }];
  mockSelectedTagIds = [];
});

describe('SceneFormScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the loading state', async () => {
    mockFormState = { ...baseFormState(), loading: true };
    const view = await render(<SceneFormScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
    expect(view.queryByTestId('form-title')).toBeNull();
  });

  it('renders the create form and saves', async () => {
    const view = await render(<SceneFormScreen />);
    expect(view.getByTestId('form-title').props.children).toBe('create-Scene');
    expect(view.getByTestId('form-description').props.children).toBe('desc-Scene');
    await fireEvent.press(view.getByText('save-Scene'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
    expect(view.queryByText('delete-Scene')).toBeNull();
  });

  it('renders the edit form with delete', async () => {
    mockFormState = { ...baseFormState(), currentSceneId: 'scene-1', isEditing: true };
    const view = await render(<SceneFormScreen />);
    expect(view.getByTestId('form-title').props.children).toBe('edit-Scene');
    await fireEvent.press(view.getByText('delete-Scene'));
    expect(mockHandleDelete).toHaveBeenCalledTimes(1);
  });

  it('wires the chapter and location selectors with optional hints', async () => {
    mockFormState = { ...baseFormState(), chapterId: 'ch-1', locationId: 'loc-1' };
    const view = await render(<SceneFormScreen />);
    expect(view.getByTestId('field-Chapter-entity').props.children).toBe('Chapter-entity');
    expect(view.getByTestId('field-Location-entity').props.children).toBe(
      'Location-entity:scene_location_optional_hint',
    );
    expect(view.getByText('scene_chapter_optional_hint')).toBeTruthy();
    const pills = jsonAllOf(view, 'single-pill');
    expect(pills).toHaveLength(2);
    expect(pills[0]).toMatchObject({
      options: [{ label: 'Arrival', value: 'ch-1' }],
      value: 'ch-1',
      placeholder: 'select-opt-Chapter',
    });
    expect(pills[1]).toMatchObject({
      options: [{ label: 'Harbor', value: 'loc-1' }],
      value: 'loc-1',
      placeholder: 'select-opt-Location',
    });
    const triggers = view.getAllByTestId('single-pill-change');
    await fireEvent.press(triggers[0]);
    expect(mockSetChapterId).toHaveBeenCalledWith('picked');
    await fireEvent.press(triggers[1]);
    expect(mockSetLocationId).toHaveBeenCalledWith('picked');
  });

  it('wires the text inputs to the form state', async () => {
    mockFormState = { ...baseFormState(), name: 'N', summary: 'S', extraNotes: 'E' };
    const view = await render(<SceneFormScreen />);
    await fireEvent.changeText(view.getByTestId('input-name_placeholder'), 'N2');
    expect(mockSetName).toHaveBeenCalledWith('N2');
    await fireEvent.changeText(view.getByTestId('input-summary_placeholder'), 'S2');
    expect(mockSetSummary).toHaveBeenCalledWith('S2');
    await fireEvent.changeText(view.getByTestId('input-extra_notes_placeholder'), 'E2');
    expect(mockSetExtraNotes).toHaveBeenCalledWith('E2');
  });

  it('falls back to empty strings for missing optional text', async () => {
    const view = await render(<SceneFormScreen />);
    expect(view.getByTestId('input-summary_placeholder').props.value).toBe('');
    expect(view.getByTestId('input-extra_notes_placeholder').props.value).toBe('');
  });

  it('toggles favorite, start and finish switches', async () => {
    const view = await render(<SceneFormScreen />);
    await fireEvent.press(view.getByTestId('switch-is_favorite'));
    expect(mockSetIsFavorite).toHaveBeenCalledWith(true);
    await fireEvent.press(view.getByTestId('switch-is_start_scene'));
    expect(mockSetIsStart).toHaveBeenCalledWith(true);
    await fireEvent.press(view.getByTestId('switch-is_finish_scene'));
    expect(mockSetIsFinish).toHaveBeenCalledWith(true);
  });

  it('wires the timing fields', async () => {
    mockCalendars = [{ id: 'cal-1' }];
    mockFormState = {
      ...baseFormState(),
      gapInput: '2',
      gapType: 'days',
      durationInput: '3',
      durationType: 'hours',
      calendarDateOverride: 'D5',
      calendarDateOverrideCalendarId: 'cal-1',
    };
    const view = await render(<SceneFormScreen />);
    expect(jsonOf(view, 'timing-fields')).toMatchObject({
      gapInput: '2',
      gapType: 'days',
      durationInput: '3',
      durationType: 'hours',
      calendarDateOverride: 'D5',
      calendarDateOverrideCalendarId: 'cal-1',
      calendars: 1,
    });
    await fireEvent.press(view.getByTestId('timing-gap'));
    expect(mockSetGapInput).toHaveBeenCalledWith('2');
    await fireEvent.press(view.getByTestId('timing-gap-type'));
    expect(mockSetGapType).toHaveBeenCalledWith('days');
    await fireEvent.press(view.getByTestId('timing-duration'));
    expect(mockSetDurationInput).toHaveBeenCalledWith('3');
    await fireEvent.press(view.getByTestId('timing-duration-type'));
    expect(mockSetDurationType).toHaveBeenCalledWith('hours');
    await fireEvent.press(view.getByTestId('timing-override'));
    expect(mockSetCalendarDateOverride).toHaveBeenCalledWith('D5');
    await fireEvent.press(view.getByTestId('timing-override-cal'));
    expect(mockSetCalendarDateOverrideCalendarId).toHaveBeenCalledWith('cal-1');
  });

  it('wires custom attributes through the state updater', async () => {
    mockCustomFields = [{ id: 'f1' }];
    const view = await render(<SceneFormScreen />);
    expect(jsonOf(view, 'custom-fields')).toMatchObject({ storyId: 'story-1', fields: 1 });
    await fireEvent.press(view.getByTestId('custom-fields-change'));
    expect(mockSetCustomValues).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockSetCustomValues.mock.calls[0][0] as (
      prev: Record<string, unknown>,
    ) => Record<string, unknown>;
    expect(updater({})).toEqual({ f1: 'v1' });
  });

  it('wires the tag selector', async () => {
    const view = await render(<SceneFormScreen />);
    expect(jsonOf(view, 'tags-pill')).toMatchObject({
      placeholder: 'select_tags_for_scene',
      label: 'scene_tags',
    });
    await fireEvent.press(view.getByTestId('tags-pill-change'));
    expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-1']);
  });

  it('passes pending character relations for a draft scene', async () => {
    const view = await render(<SceneFormScreen />);
    expect(jsonOf(view, 'character-manager')).toMatchObject({
      relations: 1,
      available: ['Ada'],
      editable: true,
      currentStoryId: 'story-1',
      currentSceneId: '',
    });
    await fireEvent.press(view.getByTestId('character-save'));
    expect(mockHandleSaveCharacterSceneRelation).toHaveBeenCalledWith({ id: 'rel-9' });
    await fireEvent.press(view.getByTestId('character-delete'));
    expect(mockHandleDeleteCharacterSceneRelation).toHaveBeenCalledWith('rel-9');
  });

  it('passes persisted character relations for an editing scene', async () => {
    mockCharacterSceneRelations = [{ id: 'rel-1' }, { id: 'rel-2' }];
    mockFormState = { ...baseFormState(), currentSceneId: 'scene-1', isEditing: true };
    const view = await render(<SceneFormScreen />);
    expect(jsonOf(view, 'character-manager')).toMatchObject({
      relations: 2,
      currentSceneId: 'scene-1',
    });
  });

  it('hides the effect editor for drafts and linear stories', async () => {
    const draft = await render(<SceneFormScreen />);
    expect(draft.queryByTestId('effect-editor')).toBeNull();
    mockSelectedStory = { id: 'story-1', type: 'linear' };
    mockFormState = { ...baseFormState(), currentSceneId: 'scene-1', isEditing: true };
    const linear = await render(<SceneFormScreen />);
    expect(linear.queryByTestId('effect-editor')).toBeNull();
  });

  it('renders the effect editor for persisted branching scenes', async () => {
    mockFormState = { ...baseFormState(), currentSceneId: 'scene-1', isEditing: true };
    const view = await render(<SceneFormScreen />);
    expect(jsonOf(view, 'effect-editor')).toMatchObject({
      effects: 1,
      items: [{ label: 'Sword', value: 'item-1' }],
      itemLabel: 'Item-entity',
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
    const view = await render(<SceneFormScreen />);
    expect(jsonOf(view, 'note-manager')).toMatchObject({
      currentStoryId: 'story-1',
      currentEntityId: '',
      currentEntityType: 'Scene',
      editable: true,
    });
    expect(jsonOf(view, 'seealso-manager')).toMatchObject({
      storyId: 'story-1',
      entityType: 'Scene',
      entityId: '',
      editable: true,
    });
  });

  it('hides story-bound sections without a story', async () => {
    mockSelectedStory = null;
    const view = await render(<SceneFormScreen />);
    expect(view.queryByTestId('tags-pill')).toBeNull();
    expect(view.queryByTestId('character-manager')).toBeNull();
    expect(view.queryByTestId('note-manager')).toBeNull();
    expect(view.queryByTestId('seealso-manager')).toBeNull();
  });

  it('disables actions while saving or deleting', async () => {
    mockSaving = true;
    const savingView = await render(<SceneFormScreen />);
    await fireEvent.press(savingView.getByTestId('stub-button-save-Scene'));
    expect(mockHandleSave).not.toHaveBeenCalled();
    mockSaving = false;
    mockDeleting = true;
    mockFormState = { ...baseFormState(), isEditing: true };
    const deletingView = await render(<SceneFormScreen />);
    await fireEvent.press(deletingView.getByTestId('stub-button-delete-Scene'));
    expect(mockHandleDelete).not.toHaveBeenCalled();
  });
});
