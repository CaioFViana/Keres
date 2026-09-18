import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

let mockRouteParams: { chapterId?: string } | undefined = {};
let mockSelectedStory: { id: string; type: string } | null = { id: 'story-1', type: 'linear' };
let mockActiveArcId: string | null = null;
let mockCustomFields: unknown[] = [];
let mockSaving = false;
let mockDeleting = false;

const mockSetName = jest.fn();
const mockSetSummary = jest.fn();
const mockSetIsFavorite = jest.fn();
const mockSetIsEvent = jest.fn();
const mockSetExtraNotes = jest.fn();
const mockSetArcId = jest.fn();
const mockSetCustomValues = jest.fn();
const mockHandleTagSelectionChange = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();

interface FormState {
  currentChapterId?: string;
  name: string;
  summary: string | null;
  isFavorite: boolean;
  isEvent: boolean;
  extraNotes: string | null;
  arcId: string | null;
  customValues: Record<string, unknown>;
  loading: boolean;
  isEditing: boolean;
}

const baseFormState = (): FormState => ({
  currentChapterId: undefined,
  name: '',
  summary: null,
  isFavorite: false,
  isEvent: false,
  extraNotes: null,
  arcId: null,
  customValues: {},
  loading: false,
  isEditing: false,
});

let mockFormState: FormState = baseFormState();

interface Associations {
  availableTags: { id: string; name: string; color: string | null }[];
  selectedTagIds: string[];
  allNotes: unknown[];
  chapterNoteRelations: unknown[];
  pendingNoteRelations: unknown[];
  arcs: { id: string; title: string; color: string }[];
}

const baseAssociations = (): Associations => ({
  availableTags: [{ id: 'tag-1', name: 'Tag', color: null }],
  selectedTagIds: [],
  allNotes: [],
  chapterNoteRelations: [],
  pendingNoteRelations: [],
  arcs: [],
});

let mockAssociations: Associations = baseAssociations();

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

jest.mock('../../../../src/hooks/useStorySchemaFields', () => ({
  __esModule: true,
  useStorySchemaFields: () => mockCustomFields,
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory, activeArcId: mockActiveArcId }),
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

jest.mock('../../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
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

jest.mock('../../../../src/screens/narrative-elements/chapters/useChapterFormResources', () => ({
  __esModule: true,
  useChapterFormResources: () => ({ drizzleDb: {}, chapterServiceRef: { current: null } }),
}));

jest.mock('../../../../src/screens/narrative-elements/chapters/useChapterFormState', () => ({
  __esModule: true,
  useChapterFormState: () => ({
    ...mockFormState,
    setName: mockSetName,
    setSummary: mockSetSummary,
    setIsFavorite: mockSetIsFavorite,
    setIsEvent: mockSetIsEvent,
    setExtraNotes: mockSetExtraNotes,
    setArcId: mockSetArcId,
    setCustomValues: mockSetCustomValues,
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/chapters/useChapterFormAssociations', () => ({
  __esModule: true,
  useChapterFormAssociations: () => ({
    ...mockAssociations,
    persistTagRelations: jest.fn(),
    saveNoteRelation: mockSaveNoteRelation,
    deleteNoteRelation: mockDeleteNoteRelation,
    persistNoteRelations: jest.fn(),
    handleTagSelectionChange: mockHandleTagSelectionChange,
  }),
}));

jest.mock('../../../../src/screens/narrative-elements/chapters/useChapterFormActions', () => ({
  __esModule: true,
  useChapterFormActions: () => ({
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
      testID,
    }: {
      label: string;
      value: boolean;
      onValueChange: (v: boolean) => void;
      testID?: string;
    }) => (
      <Text testID={testID ?? `switch-${label}`} onPress={() => onValueChange(!value)}>
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
        <Text testID="arc-pill">{JSON.stringify({ options, value, placeholder })}</Text>
        <Text testID="arc-pill-change" onPress={() => onValueChange('arc-2')}>
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

jest.mock('../../../../src/components/features/chapters/AnchorManager/AnchorManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      storyId,
      chapterId,
      currentUserId,
      editable,
    }: {
      storyId: string;
      chapterId: string;
      currentUserId: string;
      editable: boolean;
    }) => (
      <Text testID="anchor-manager">
        {JSON.stringify({ storyId, chapterId, currentUserId, editable })}
      </Text>
    ),
  };
});

jest.mock('../../../../src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      noteRelations,
      availableNotes,
      onSave,
      onDelete,
      editable,
      currentStoryId,
      currentEntityId,
      currentEntityType,
    }: {
      noteRelations: unknown[];
      availableNotes: unknown[];
      onSave: (r: unknown) => void;
      onDelete: (id: string) => void;
      editable: boolean;
      currentStoryId: string;
      currentEntityId: string;
      currentEntityType: string;
    }) => (
      <>
        <Text testID="note-manager">
          {JSON.stringify({
            relations: noteRelations.length,
            notes: availableNotes.length,
            editable,
            currentStoryId,
            currentEntityId,
            currentEntityType,
          })}
        </Text>
        <Text testID="note-manager-save" onPress={() => onSave({ id: 'nr-1' })}>
          save
        </Text>
        <Text testID="note-manager-delete" onPress={() => onDelete('nr-1')}>
          delete
        </Text>
      </>
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

import ChapterFormScreen from '../../../../src/screens/narrative-elements/chapters/ChapterFormScreen';

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  mockSelectedStory = { id: 'story-1', type: 'linear' };
  mockActiveArcId = null;
  mockCustomFields = [];
  mockSaving = false;
  mockDeleting = false;
  mockFormState = baseFormState();
  mockAssociations = baseAssociations();
});

describe('ChapterFormScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the loading state', async () => {
    mockFormState = { ...baseFormState(), loading: true };
    const view = await render(<ChapterFormScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
    expect(view.queryByTestId('form-title')).toBeNull();
  });

  it('renders the create form and saves', async () => {
    const view = await render(<ChapterFormScreen />);
    expect(view.getByTestId('form-title').props.children).toBe('create-Chapter');
    expect(view.getByTestId('form-description').props.children).toBe('desc-Chapter');
    expect(view.getByText('save-Chapter')).toBeTruthy();
    expect(view.queryByText('delete-Chapter')).toBeNull();
    await fireEvent.press(view.getByText('save-Chapter'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
  });

  it('renders the edit form with delete and event copy', async () => {
    mockFormState = { ...baseFormState(), isEditing: true, isEvent: true, name: 'Quake' };
    const view = await render(<ChapterFormScreen />);
    expect(view.getByTestId('form-title').props.children).toBe('edit-Event');
    await fireEvent.press(view.getByText('delete-Event'));
    expect(mockHandleDelete).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('chapter-is-event')).toBeNull();
    expect(view.queryByText('chapter_is_event_hint')).toBeNull();
  });

  it('wires the text inputs to the form state', async () => {
    mockFormState = { ...baseFormState(), name: 'N', summary: 'S', extraNotes: 'E' };
    const view = await render(<ChapterFormScreen />);
    expect(view.getByTestId('input-name_placeholder').props.value).toBe('N');
    await fireEvent.changeText(view.getByTestId('input-name_placeholder'), 'N2');
    expect(mockSetName).toHaveBeenCalledWith('N2');
    await fireEvent.changeText(view.getByTestId('input-summary_placeholder'), 'S2');
    expect(mockSetSummary).toHaveBeenCalledWith('S2');
    await fireEvent.changeText(view.getByTestId('input-extra_notes_placeholder'), 'E2');
    expect(mockSetExtraNotes).toHaveBeenCalledWith('E2');
  });

  it('falls back to empty strings for missing optional text', async () => {
    const view = await render(<ChapterFormScreen />);
    expect(view.getByTestId('input-summary_placeholder').props.value).toBe('');
    expect(view.getByTestId('input-extra_notes_placeholder').props.value).toBe('');
  });

  it('toggles favorite and event switches while creating', async () => {
    const view = await render(<ChapterFormScreen />);
    expect(view.getByTestId('switch-is_favorite').props.children).toBe('is_favorite:false');
    await fireEvent.press(view.getByTestId('switch-is_favorite'));
    expect(mockSetIsFavorite).toHaveBeenCalledWith(true);
    expect(view.getByTestId('chapter-is-event').props.children).toBe('chapter_is_event:false');
    expect(view.getByText('chapter_is_event_hint')).toBeTruthy();
    await fireEvent.press(view.getByTestId('chapter-is-event'));
    expect(mockSetIsEvent).toHaveBeenCalledWith(true);
  });

  it('shows the arc selector only with more than one arc', async () => {
    mockAssociations = {
      ...baseAssociations(),
      arcs: [
        { id: 'arc-1', title: 'A1', color: 'red' },
        { id: 'arc-2', title: 'A2', color: 'blue' },
      ],
    };
    const view = await render(<ChapterFormScreen />);
    expect(view.getByTestId('field-Arc')).toBeTruthy();
    expect(jsonOf(view, 'arc-pill')).toMatchObject({
      options: [
        { label: 'A1', value: 'arc-1', color: 'red' },
        { label: 'A2', value: 'arc-2', color: 'blue' },
      ],
      value: null,
      placeholder: 'select-Arc',
    });
    await fireEvent.press(view.getByTestId('arc-pill-change'));
    expect(mockSetArcId).toHaveBeenCalledWith('arc-2');
  });

  it('hides the arc selector with a single arc', async () => {
    mockAssociations = {
      ...baseAssociations(),
      arcs: [{ id: 'arc-1', title: 'A1', color: 'red' }],
    };
    const view = await render(<ChapterFormScreen />);
    expect(view.queryByTestId('arc-pill')).toBeNull();
  });

  it('wires custom attributes through the state updater', async () => {
    mockCustomFields = [{ id: 'f1' }];
    mockFormState = { ...baseFormState(), customValues: { f0: 'v0' } };
    const view = await render(<ChapterFormScreen />);
    expect(jsonOf(view, 'custom-fields')).toMatchObject({ storyId: 'story-1', fields: 1 });
    await fireEvent.press(view.getByTestId('custom-fields-change'));
    expect(mockSetCustomValues).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockSetCustomValues.mock.calls[0][0] as (
      prev: Record<string, unknown>,
    ) => Record<string, unknown>;
    expect(updater({})).toEqual({ f1: 'v1' });
  });

  it('wires the tag selector', async () => {
    const view = await render(<ChapterFormScreen />);
    expect(jsonOf(view, 'tags-pill')).toMatchObject({
      selectedValues: [],
      placeholder: 'select_tags_for_chapter',
      label: 'chapter_tags',
    });
    await fireEvent.press(view.getByTestId('tags-pill-change'));
    expect(mockHandleTagSelectionChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('renders the anchor manager only for a persisted chapter', async () => {
    const creating = await render(<ChapterFormScreen />);
    expect(creating.queryByTestId('anchor-manager')).toBeNull();
    mockFormState = { ...baseFormState(), currentChapterId: 'ch-1', isEditing: true };
    const editing = await render(<ChapterFormScreen />);
    expect(jsonOf(editing, 'anchor-manager')).toMatchObject({
      storyId: 'story-1',
      chapterId: 'ch-1',
      currentUserId: 'user-1',
      editable: true,
    });
  });

  it('wires the note manager', async () => {
    mockFormState = { ...baseFormState(), currentChapterId: 'ch-1', isEditing: true };
    const view = await render(<ChapterFormScreen />);
    expect(jsonOf(view, 'note-manager')).toMatchObject({
      editable: true,
      currentStoryId: 'story-1',
      currentEntityId: 'ch-1',
      currentEntityType: 'Chapter',
    });
    await fireEvent.press(view.getByTestId('note-manager-save'));
    expect(mockSaveNoteRelation).toHaveBeenCalledWith({ id: 'nr-1' });
    await fireEvent.press(view.getByTestId('note-manager-delete'));
    expect(mockDeleteNoteRelation).toHaveBeenCalledWith('nr-1');
  });

  it('renders the see-also manager for the draft entity', async () => {
    const view = await render(<ChapterFormScreen />);
    expect(jsonOf(view, 'seealso-manager')).toMatchObject({
      storyId: 'story-1',
      entityType: 'Chapter',
      entityId: '',
      editable: true,
    });
  });

  it('hides story-bound sections without a story', async () => {
    mockSelectedStory = null;
    const view = await render(<ChapterFormScreen />);
    expect(view.queryByTestId('tags-pill')).toBeNull();
    expect(view.queryByTestId('note-manager')).toBeNull();
    expect(view.queryByTestId('seealso-manager')).toBeNull();
    expect(jsonOf(view, 'custom-fields').storyId).toBe('');
  });

  it('disables actions while saving or deleting', async () => {
    mockSaving = true;
    const savingView = await render(<ChapterFormScreen />);
    await fireEvent.press(savingView.getByTestId('stub-button-save-Chapter'));
    expect(mockHandleSave).not.toHaveBeenCalled();
    mockSaving = false;
    mockDeleting = true;
    mockFormState = { ...baseFormState(), isEditing: true };
    const deletingView = await render(<ChapterFormScreen />);
    await fireEvent.press(deletingView.getByTestId('stub-button-delete-Chapter'));
    expect(mockHandleDelete).not.toHaveBeenCalled();
  });
});
