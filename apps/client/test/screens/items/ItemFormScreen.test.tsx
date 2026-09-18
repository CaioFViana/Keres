import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockGoBack = jest.fn();
const mockNavigation = { goBack: mockGoBack };
const mockRoute: { params: { itemId?: string } } = { params: {} };
const mockSetName = jest.fn();
const mockSetCategory = jest.fn();
const mockSetDescription = jest.fn();
const mockSetInitialState = jest.fn();
const mockSetIsFavorite = jest.fn();
const mockSetExtraNotes = jest.fn();
const mockSetCharacterOwnerId = jest.fn();
const mockSetCustomValues = jest.fn();
const mockHandleDelete = jest.fn();
const mockHandleSave = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();
const mockHandleTagSelectionChange = jest.fn();
const mockSeeAlsoManagerRef = { current: null };
const mockVocabularyCopy = {
  editTitle: 'Edit item',
  createTitle: 'Create item',
  formDescription: 'Item form',
  saveLabel: 'Save item',
  deleteLabel: 'Delete item',
  entity: 'Item name',
};
const mockVocabulary = {
  agree: () => 'o',
  term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
};
const mockFormState: {
  current: {
    currentItemId: string | null;
    name: string;
    category: string | null;
    description: string | null;
    initialState: string | null;
    isFavorite: boolean;
    extraNotes: string | null;
    characterOwnerId: string | null;
    customValues: Record<string, unknown>;
    loading: boolean;
    isEditing: boolean;
  };
} = {
  current: {
    currentItemId: null,
    name: '',
    category: '',
    description: '',
    initialState: '',
    isFavorite: false,
    extraNotes: '',
    characterOwnerId: null,
    customValues: {},
    loading: false,
    isEditing: false,
  },
};
const mockActionsState: { current: { deleting: boolean; saving: boolean } } = {
  current: { deleting: false, saving: false },
};
const mockSelectedStory: { current: { id: string } | null } = { current: { id: 'story-1' } };
const mockCustomFields: unknown[] = [];
const mockHeaderConfig: { current: { title: string } | null } = { current: null };
const mockDb = {};
const mockI18n = { t: (key: string) => key };

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
jest.mock('@/src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
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
        {children}
        {actions}
      </>
    ),
  };
});
jest.mock('@/src/components/common/forms/FormField/FormField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      children,
    }: {
      label: string;
      children: ((a11y: object) => React.ReactNode) | React.ReactNode;
    }) => (
      <>
        <Text testID={`field-${label}`}>{label}</Text>
        {typeof children === 'function' ? children({}) : children}
      </>
    ),
  };
});
jest.mock('@/src/components/common/forms/FormSwitchField/FormSwitchField', () => {
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
jest.mock('@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { onChange: (fieldId: string, value: unknown) => void }) => (
      <Text testID="custom-fields" onPress={() => props.onChange('field-1', 'v')}>
        custom
      </Text>
    ),
  };
});
jest.mock('@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      placeholder,
      value,
      onChangeText,
      type,
    }: {
      placeholder: string;
      value: string;
      onChangeText: (v: string) => void;
      type: string;
    }) => (
      <Text testID={`suggestion-${type}`} onPress={() => onChangeText(`typed:${placeholder}`)}>
        {value || placeholder}
      </Text>
    ),
  };
});
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { selectedValues: string[]; onSelectionChange: (v: string[]) => void }) => (
      <Text testID="tags-pill" onPress={() => props.onSelectionChange(['tag-1'])}>
        {`tags:${props.selectedValues.join(',')}`}
      </Text>
    ),
    SingleSelectPill: (props: { value: string | null; onValueChange: (v: string) => void }) => (
      <Text testID="owner-pill" onPress={() => props.onValueChange('char-2')}>
        {props.value ?? 'no-owner'}
      </Text>
    ),
  };
});
jest.mock('@/src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { onSave: () => void; onDelete: () => void }) => (
      <>
        <Text testID="notes-manager">notes</Text>
        <Text testID="notes-save" onPress={props.onSave}>
          save
        </Text>
        <Text testID="notes-delete" onPress={props.onDelete}>
          delete
        </Text>
      </>
    ),
  };
});
jest.mock('@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const react = jest.requireActual('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: react.forwardRef(() => <Text testID="seealso-manager">seealso</Text>),
  };
});
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
  useStorySchemaFields: () => mockCustomFields,
}));
jest.mock('../../../src/screens/items/useItemFormResources', () => ({
  __esModule: true,
  useItemFormResources: () => ({ drizzleDb: mockDb, itemServiceRef: { current: {} } }),
}));
jest.mock('../../../src/screens/items/useItemFormState', () => ({
  __esModule: true,
  useItemFormState: () => ({
    ...mockFormState.current,
    setName: mockSetName,
    setCategory: mockSetCategory,
    setDescription: mockSetDescription,
    setInitialState: mockSetInitialState,
    setIsFavorite: mockSetIsFavorite,
    setExtraNotes: mockSetExtraNotes,
    setCharacterOwnerId: mockSetCharacterOwnerId,
    setCustomValues: mockSetCustomValues,
  }),
}));
jest.mock('../../../src/screens/items/useItemFormAssociations', () => ({
  __esModule: true,
  useItemFormAssociations: () => ({
    availableTags: [{ id: 'tag-1', name: 'Relic', color: '#f00' }],
    selectedTagIds: [],
    allNotes: [],
    itemNoteRelations: [],
    pendingNoteRelations: [],
    persistTagRelations: jest.fn(),
    saveNoteRelation: mockSaveNoteRelation,
    deleteNoteRelation: mockDeleteNoteRelation,
    persistNoteRelations: jest.fn(),
    handleTagSelectionChange: mockHandleTagSelectionChange,
    characterOptions: [{ label: 'Aria', value: 'char-1' }],
  }),
}));
jest.mock('../../../src/screens/items/useItemFormActions', () => ({
  __esModule: true,
  useItemFormActions: () => ({
    deleting: mockActionsState.current.deleting,
    handleDelete: mockHandleDelete,
    handleSave: mockHandleSave,
    saving: mockActionsState.current.saving,
    seeAlsoManagerRef: mockSeeAlsoManagerRef,
  }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory.current }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ccf',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
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

import ItemFormScreen from '../../../src/screens/items/ItemFormScreen';

describe('ItemFormScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaderConfig.current = null;
    mockRoute.params = {};
    mockSelectedStory.current = { id: 'story-1' };
    mockFormState.current = {
      currentItemId: null,
      name: '',
      category: '',
      description: '',
      initialState: '',
      isFavorite: false,
      extraNotes: '',
      characterOwnerId: null,
      customValues: {},
      loading: false,
      isEditing: false,
    };
    mockActionsState.current = { deleting: false, saving: false };
  });

  it('renders the create form and wires its fields', async () => {
    const view = await render(<ItemFormScreen />);

    expect(view.getByTestId('form-title').props.children).toBe('Create item');
    expect(view.getByTestId('form-description').props.children).toBe('Item form');
    expect(mockHeaderConfig.current?.title).toBe('Create item');
    expect(view.queryByText('Delete item')).toBeNull();

    await fireEvent.changeText(view.getByPlaceholderText('Item name'), 'Sword');
    expect(mockSetName).toHaveBeenCalledWith('Sword');
    await fireEvent.changeText(view.getByPlaceholderText('description_placeholder'), 'Sharp');
    expect(mockSetDescription).toHaveBeenCalledWith('Sharp');
    await fireEvent.changeText(view.getByPlaceholderText('extra_notes_placeholder'), 'More');
    expect(mockSetExtraNotes).toHaveBeenCalledWith('More');
    await fireEvent.press(view.getByTestId('suggestion-item_category'));
    expect(mockSetCategory).toHaveBeenCalledWith('typed:category_placeholder');
    await fireEvent.press(view.getByTestId('suggestion-item_initial_state'));
    expect(mockSetInitialState).toHaveBeenCalledWith('typed:initial_state_placeholder');
    await fireEvent.press(view.getByTestId('owner-pill'));
    expect(mockSetCharacterOwnerId).toHaveBeenCalledWith('char-2');
    await fireEvent.press(view.getByTestId('switch-is_favorite'));
    expect(mockSetIsFavorite).toHaveBeenCalledWith(true);

    await fireEvent.press(view.getByText('Save item'));
    expect(mockHandleSave).toHaveBeenCalled();
  });

  it('renders the edit form with deletion and associations', async () => {
    mockRoute.params = { itemId: 'item-1' };
    mockFormState.current = {
      ...mockFormState.current,
      currentItemId: 'item-1',
      name: 'Sword',
      characterOwnerId: 'char-1',
      isEditing: true,
    };
    const view = await render(<ItemFormScreen />);

    expect(view.getByTestId('form-title').props.children).toBe('Edit item');
    expect(view.getByDisplayValue('Sword')).toBeTruthy();
    expect(view.getByTestId('owner-pill').props.children).toBe('char-1');

    await fireEvent.press(view.getByText('Save item'));
    expect(mockHandleSave).toHaveBeenCalled();
    await fireEvent.press(view.getByText('Delete item'));
    expect(mockHandleDelete).toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('tags-pill'));
    expect(mockHandleTagSelectionChange).toHaveBeenCalledWith(['tag-1']);
    await fireEvent.press(view.getByTestId('notes-save'));
    expect(mockSaveNoteRelation).toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('notes-delete'));
    expect(mockDeleteNoteRelation).toHaveBeenCalled();
    expect(view.getByTestId('seealso-manager')).toBeTruthy();
    await fireEvent.press(view.getByTestId('custom-fields'));
    expect(mockSetCustomValues).toHaveBeenCalled();
  });

  it('hides story-bound sections without a selected story', async () => {
    mockSelectedStory.current = null;
    const view = await render(<ItemFormScreen />);

    expect(view.queryByTestId('tags-pill')).toBeNull();
    expect(view.queryByTestId('notes-manager')).toBeNull();
    expect(view.queryByTestId('seealso-manager')).toBeNull();
    expect(view.getByText('Save item')).toBeTruthy();
  });

  it('shows loading while the item loads', async () => {
    mockFormState.current = { ...mockFormState.current, loading: true };
    const view = await render(<ItemFormScreen />);

    expect(view.queryByTestId('form-title')).toBeNull();
  });
});
