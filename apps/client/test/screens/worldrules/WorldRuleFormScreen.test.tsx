import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockGoBack = jest.fn();
const mockNavigation = { goBack: mockGoBack, navigate: jest.fn() };
const mockSetTitle = jest.fn();
const mockSetDescription = jest.fn();
const mockSetSection = jest.fn();
const mockSetType = jest.fn();
const mockSetCategory = jest.fn();
const mockSetBehavior = jest.fn();
const mockSetUsability = jest.fn();
const mockSetDanger = jest.fn();
const mockSetIsFavorite = jest.fn();
const mockSetExtraNotes = jest.fn();
const mockSetCustomValues = jest.fn();
const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();
const mockHandleTagSelectionChange = jest.fn();
const mockUseWorldRuleFormState = jest.fn();
const mockUseWorldRuleFormAssociations = jest.fn();
const mockUseWorldRuleFormActions = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
const mockCopy = {
  editTitle: 'copy_edit',
  createTitle: 'copy_create',
  formDescription: 'copy_description',
  saveLabel: 'copy_save',
  deleteLabel: 'copy_delete',
};
let mockRouteParams: { worldRuleId?: string } | undefined = {};
let mockStory: { id: string } | null = { id: 'story-1' };
let mockUserId: string | null = 'user-1';
let mockFormState = {
  currentWorldRuleId: null as string | null,
  title: '',
  description: '',
  section: 'rule',
  type: null as string | null,
  category: null as string | null,
  behavior: null as string | null,
  usability: null as string | null,
  danger: null as string | null,
  isFavorite: false,
  extraNotes: null as string | null,
  customValues: {},
  loading: false,
  isEditing: false,
  isDirty: true,
  resetForm: jest.fn().mockResolvedValue(undefined),
};
let mockSaving = false;
let mockDeleting = false;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('@/src/components/common/controls/Button/Button', () => ({
  __esModule: true,
  default: ({
    onPress,
    disabled,
    children,
  }: {
    onPress: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      {
        testID: `btn-${children}`,
        onPress: disabled ? undefined : onPress,
      },
      `${children}${disabled ? ' (disabled)' : ''}`,
    );
  },
}));
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenLoading: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-loading' }, 'loading');
  },
}));
jest.mock('@/src/components/common/forms/EntityFormContainer/EntityFormContainer', () => ({
  __esModule: true,
  default: ({
    title,
    description,
    actions,
    children,
  }: {
    title: string;
    description: string;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'form-container' },
      react.createElement(native.Text, { testID: 'form-title' }, title),
      react.createElement(native.Text, { testID: 'form-description' }, description),
      actions,
      children,
    );
  },
}));
jest.mock('@/src/components/common/forms/FormField/FormField', () => ({
  __esModule: true,
  default: ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode | ((a11y: object) => React.ReactNode);
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: `field-${label}` },
      typeof children === 'function' ? children({}) : children,
    );
  },
}));
jest.mock('@/src/components/common/forms/FormSwitchField/FormSwitchField', () => ({
  __esModule: true,
  default: (props: { label: string; value: boolean; onValueChange: (v: boolean) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID: `switch-${props.label}`, onPress: () => props.onValueChange(!props.value) },
      `${props.label}:${props.value}`,
    );
  },
}));
jest.mock('@/src/components/common/inputs/TextInput/TextInput', () => ({
  __esModule: true,
  default: (props: {
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.TextInput, {
      testID: `input-${props.placeholder}`,
      value: props.value,
      onChangeText: props.onChangeText,
    });
  },
}));
jest.mock('@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput', () => ({
  __esModule: true,
  default: (props: {
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    type: string;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.TextInput, {
      testID: `suggest-${props.placeholder}`,
      value: props.value,
      onChangeText: props.onChangeText,
    });
  },
}));
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => ({
  __esModule: true,
  default: (props: { selectedValues: string[]; onSelectionChange: (v: string[]) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      {
        testID: 'tag-pill',
        onPress: () => props.onSelectionChange(['tag-1']),
      },
      JSON.stringify(props.selectedValues),
    );
  },
  SingleSelectPill: (props: {
    value: string;
    onValueChange: (v: string | null) => void;
    options: { value: string }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'section-pill' },
      react.createElement(native.Text, { testID: 'section-value' }, props.value),
      react.createElement(
        native.Text,
        { testID: 'section-pick-item', onPress: () => props.onValueChange('item') },
        'item',
      ),
      react.createElement(
        native.Text,
        { testID: 'section-clear', onPress: () => props.onValueChange(null) },
        'clear',
      ),
    );
  },
}));
jest.mock('@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields', () => ({
  __esModule: true,
  default: (props: { onChange: (fieldId: string, value: string) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID: 'custom-fields', onPress: () => props.onChange('f-1', 'v') },
      'custom',
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
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityFormSecondaryDraft', () => ({
  __esModule: true,
  useEntityFormSecondaryDraft: () => ({
    persistSecondaryDraft: jest.fn(),
    clearSecondaryDraft: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/useStorySchemaFields', () => ({
  __esModule: true,
  useStorySchemaFields: () => [],
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { error: '#f00', primaryContainer: '#eef' } }),
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: () => mockCopy,
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));
jest.mock('../../../src/screens/worldrules/useWorldRuleFormResources', () => ({
  __esModule: true,
  useWorldRuleFormResources: () => ({ drizzleDb: mockDb, worldRuleServiceRef: { current: null } }),
}));
jest.mock('../../../src/screens/worldrules/useWorldRuleFormState', () => ({
  __esModule: true,
  useWorldRuleFormState: (...args: unknown[]) => mockUseWorldRuleFormState(...args),
}));
jest.mock('../../../src/screens/worldrules/useWorldRuleFormAssociations', () => ({
  __esModule: true,
  useWorldRuleFormAssociations: (...args: unknown[]) => mockUseWorldRuleFormAssociations(...args),
}));
jest.mock('../../../src/screens/worldrules/useWorldRuleFormActions', () => ({
  __esModule: true,
  useWorldRuleFormActions: (...args: unknown[]) => mockUseWorldRuleFormActions(...args),
}));

import WorldRuleFormScreen from '../../../src/screens/worldrules/WorldRuleFormScreen';

const freshFormState = () => ({
  currentWorldRuleId: null as string | null,
  title: '',
  description: '',
  section: 'rule',
  type: null as string | null,
  category: null as string | null,
  behavior: null as string | null,
  usability: null as string | null,
  danger: null as string | null,
  isFavorite: false,
  extraNotes: null as string | null,
  customValues: {},
  loading: false,
  isEditing: false,
  isDirty: true,
  resetForm: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  mockStory = { id: 'story-1' };
  mockUserId = 'user-1';
  mockFormState = freshFormState();
  mockSaving = false;
  mockDeleting = false;
  mockUseWorldRuleFormState.mockImplementation(() => ({
    ...mockFormState,
    setTitle: mockSetTitle,
    setDescription: mockSetDescription,
    setSection: mockSetSection,
    setType: mockSetType,
    setCategory: mockSetCategory,
    setBehavior: mockSetBehavior,
    setUsability: mockSetUsability,
    setDanger: mockSetDanger,
    setIsFavorite: mockSetIsFavorite,
    setExtraNotes: mockSetExtraNotes,
    setCustomValues: mockSetCustomValues,
  }));
  mockUseWorldRuleFormAssociations.mockReturnValue({
    availableTags: [],
    selectedTagIds: [],
    allNotes: [],
    worldRuleNoteRelations: [],
    pendingNoteRelations: [],
    persistTagRelations: jest.fn(),
    saveNoteRelation: jest.fn(),
    deleteNoteRelation: jest.fn(),
    persistNoteRelations: jest.fn(),
    handleTagSelectionChange: mockHandleTagSelectionChange,
  });
  mockUseWorldRuleFormActions.mockImplementation(() => ({
    deleting: mockDeleting,
    handleDelete: mockHandleDelete,
    handleSave: mockHandleSave,
    saving: mockSaving,
    seeAlsoManagerRef: { current: null },
  }));
});

afterEach(() => {
  cleanup();
});

it('shows the loading state', async () => {
  mockFormState = { ...freshFormState(), loading: true };
  const view = await render(<WorldRuleFormScreen />);

  expect(view.getByTestId('screen-loading')).toBeTruthy();
});

it('renders the creation form and wires the hooks', async () => {
  const view = await render(<WorldRuleFormScreen />);

  expect(view.getByTestId('form-title').props.children).toBe('copy_create');
  expect(view.getByTestId('form-description').props.children).toBe('copy_description');
  expect(view.getByTestId('field-title')).toBeTruthy();
  expect(view.getByTestId('field-description')).toBeTruthy();
  expect(view.queryByTestId('btn-copy_delete')).toBeNull();

  expect(mockUseWorldRuleFormState).toHaveBeenCalledWith(
    expect.objectContaining({ initialWorldRuleId: undefined, storyId: 'story-1' }),
  );
  expect(mockUseWorldRuleFormActions).toHaveBeenCalledWith(
    expect.objectContaining({ storyId: 'story-1', userId: 'user-1' }),
  );

  await fireEvent.press(view.getByTestId('btn-copy_save'));
  expect(mockHandleSave).toHaveBeenCalled();
});

it('renders the edit form with delete and disabled states', async () => {
  mockRouteParams = { worldRuleId: 'wr-1' };
  mockFormState = { ...freshFormState(), isEditing: true };
  mockSaving = true;
  const view = await render(<WorldRuleFormScreen />);

  expect(view.getByTestId('form-title').props.children).toBe('copy_edit');
  expect(view.getByTestId('btn-copy_save').props.children).toBe('copy_save (disabled)');
  expect(view.getByTestId('btn-copy_delete')).toBeTruthy();
  expect(mockUseWorldRuleFormState).toHaveBeenCalledWith(
    expect.objectContaining({ initialWorldRuleId: 'wr-1' }),
  );
});

it('deletes through the edit action', async () => {
  mockFormState = { ...freshFormState(), isEditing: true };
  const view = await render(<WorldRuleFormScreen />);

  await fireEvent.press(view.getByTestId('btn-copy_delete'));
  expect(mockHandleDelete).toHaveBeenCalled();
});

it('wires text inputs to their setters', async () => {
  const view = await render(<WorldRuleFormScreen />);

  await fireEvent.changeText(view.getByTestId('input-world_rule_title_placeholder'), 'Gravity');
  expect(mockSetTitle).toHaveBeenCalledWith('Gravity');
  await fireEvent.changeText(view.getByTestId('input-world_rule_description_placeholder'), 'Desc');
  expect(mockSetDescription).toHaveBeenCalledWith('Desc');
  await fireEvent.changeText(view.getByTestId('input-world_piece_behavior_placeholder'), 'B');
  expect(mockSetBehavior).toHaveBeenCalledWith('B');
  await fireEvent.changeText(view.getByTestId('input-world_piece_usability_placeholder'), 'U');
  expect(mockSetUsability).toHaveBeenCalledWith('U');
  await fireEvent.changeText(view.getByTestId('input-world_piece_danger_placeholder'), 'D');
  expect(mockSetDanger).toHaveBeenCalledWith('D');
  await fireEvent.changeText(view.getByTestId('input-world_rule_extra_notes_placeholder'), 'N');
  expect(mockSetExtraNotes).toHaveBeenCalledWith('N');
});

it('wires suggestion inputs, switch and custom fields', async () => {
  const view = await render(<WorldRuleFormScreen />);

  await fireEvent.changeText(view.getByTestId('suggest-world_piece_type_placeholder'), 'physical');
  expect(mockSetType).toHaveBeenCalledWith('physical');
  await fireEvent.changeText(view.getByTestId('suggest-category_placeholder'), 'cat');
  expect(mockSetCategory).toHaveBeenCalledWith('cat');
  await fireEvent.press(view.getByTestId('switch-is_favorite'));
  expect(mockSetIsFavorite).toHaveBeenCalledWith(true);

  mockSetCustomValues.mockImplementation((updater: (prev: object) => object) => updater({}));
  await fireEvent.press(view.getByTestId('custom-fields'));
  expect(mockSetCustomValues).toHaveBeenCalled();
});

it('clears the type when the section changes', async () => {
  mockFormState = { ...freshFormState(), type: 'physical' };
  const view = await render(<WorldRuleFormScreen />);

  await fireEvent.press(view.getByTestId('section-pick-item'));
  expect(mockSetType).toHaveBeenCalledWith(null);
  expect(mockSetSection).toHaveBeenCalledWith('item');
});

it('keeps a null type and defaults cleared sections to rule', async () => {
  const view = await render(<WorldRuleFormScreen />);

  await fireEvent.press(view.getByTestId('section-pick-item'));
  expect(mockSetType).not.toHaveBeenCalled();
  expect(mockSetSection).toHaveBeenCalledWith('item');

  mockSetSection.mockClear();
  await fireEvent.press(view.getByTestId('section-clear'));
  expect(mockSetSection).toHaveBeenCalledWith('rule');
});

it('wires tag selection and shows notes with a story', async () => {
  const view = await render(<WorldRuleFormScreen />);

  await fireEvent.press(view.getByTestId('tag-pill'));
  expect(mockHandleTagSelectionChange).toHaveBeenCalledWith(['tag-1']);
  expect(view.getByTestId('note-manager')).toBeTruthy();
  expect(view.getByTestId('seealso-manager')).toBeTruthy();
});

it('hides notes and see-also without a story', async () => {
  mockStory = null;
  const view = await render(<WorldRuleFormScreen />);

  expect(view.queryByTestId('note-manager')).toBeNull();
  expect(view.queryByTestId('seealso-manager')).toBeNull();
});

it('tolerates missing route params', async () => {
  mockRouteParams = undefined;
  const view = await render(<WorldRuleFormScreen />);

  expect(view.getByTestId('form-title').props.children).toBe('copy_create');
});

it('registers a reset header action while dirty', async () => {
  await render(<WorldRuleFormScreen />);
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
  mockFormState = { ...freshFormState(), isDirty: false };
  await render(<WorldRuleFormScreen />);
  const config = mockUseScreenHeader.mock.calls.at(-1)?.[0] as {
    actions: Array<{ disabled: boolean }>;
  };
  expect(config.actions[0].disabled).toBe(true);
});
