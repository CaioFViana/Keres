import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockGoBack = jest.fn();
const mockNavigation = { goBack: mockGoBack };
const mockRoute: { params: { noteId?: string } } = { params: {} };
const mockSetTitle = jest.fn();
const mockSetBody = jest.fn();
const mockSetIsFavorite = jest.fn();
const mockSetExtraNotes = jest.fn();
const mockSetCustomValues = jest.fn();
const mockHandleDelete = jest.fn();
const mockHandleSave = jest.fn();
const mockPersistTagRelations = jest.fn();
const mockHandleTagSelectionChange = jest.fn();
const mockFormState: {
  current: {
    title: string;
    body: string | null;
    isFavorite: boolean;
    extraNotes: string | null;
    customValues: Record<string, unknown>;
    loading: boolean;
    isEditing: boolean;
    currentNoteId: string | null;
  };
} = {
  current: {
    title: '',
    body: '',
    isFavorite: false,
    extraNotes: '',
    customValues: {},
    loading: false,
    isEditing: false,
    currentNoteId: null,
  },
};
const mockActionsState: { current: { deleting: boolean; saving: boolean } } = {
  current: { deleting: false, saving: false },
};
const mockSelectedStory = { id: 'story-1' };
const mockCustomFields: unknown[] = [];
const mockHeaderConfig: { current: { title: string } | null } = { current: null };
const mockDb = {};
const mockI18n = { t: (key: string) => key };
let mockPillProps: { selectedValues: string[]; onSelectionChange: (v: string[]) => void } | null =
  null;
let mockCustomProps: { onChange: (fieldId: string, value: unknown) => void } | null = null;

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
    default: (props: { onChange: (fieldId: string, value: unknown) => void }) => {
      mockCustomProps = props;
      return (
        <Text testID="custom-fields" onPress={() => props.onChange('field-1', 'v')}>
          custom
        </Text>
      );
    },
  };
});
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { selectedValues: string[]; onSelectionChange: (v: string[]) => void }) => {
      mockPillProps = props;
      return (
        <Text
          testID="tags-pill"
          onPress={() => props.onSelectionChange(['tag-1'])}
        >{`tags:${props.selectedValues.join(',')}`}</Text>
      );
    },
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
jest.mock('../../../src/screens/notes/useNoteFormResources', () => ({
  __esModule: true,
  useNoteFormResources: () => ({ drizzleDb: mockDb, noteServiceRef: { current: {} } }),
}));
jest.mock('../../../src/screens/notes/useNoteFormState', () => ({
  __esModule: true,
  useNoteFormState: () => ({
    ...mockFormState.current,
    setTitle: mockSetTitle,
    setBody: mockSetBody,
    setIsFavorite: mockSetIsFavorite,
    setExtraNotes: mockSetExtraNotes,
    setCustomValues: mockSetCustomValues,
  }),
}));
jest.mock('../../../src/screens/notes/useNoteFormAssociations', () => ({
  __esModule: true,
  useNoteFormAssociations: () => ({
    availableTags: [{ id: 'tag-1', name: 'Lore', color: '#f00' }],
    selectedTagIds: [],
    persistTagRelations: mockPersistTagRelations,
    handleTagSelectionChange: mockHandleTagSelectionChange,
  }),
}));
jest.mock('../../../src/screens/notes/useNoteFormActions', () => ({
  __esModule: true,
  useNoteFormActions: () => ({
    deleting: mockActionsState.current.deleting,
    handleDelete: mockHandleDelete,
    handleSave: mockHandleSave,
    saving: mockActionsState.current.saving,
  }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
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
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import NoteFormScreen from '../../../src/screens/notes/NoteFormScreen';

describe('NoteFormScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPillProps = null;
    mockCustomProps = null;
    mockHeaderConfig.current = null;
    mockRoute.params = {};
    mockFormState.current = {
      title: '',
      body: '',
      isFavorite: false,
      extraNotes: '',
      customValues: {},
      loading: false,
      isEditing: false,
      currentNoteId: null,
    };
    mockActionsState.current = { deleting: false, saving: false };
  });

  it('renders the create form and wires its fields', async () => {
    const view = await render(<NoteFormScreen />);

    expect(view.getByTestId('form-title').props.children).toBe('create_note_title');
    expect(view.getByTestId('form-description').props.children).toBe('note_form_description');
    expect(mockHeaderConfig.current?.title).toBe('create_note_title');
    expect(view.getByTestId('field-title')).toBeTruthy();
    expect(view.queryByText('delete_note_title')).toBeNull();

    await fireEvent.changeText(view.getByPlaceholderText('title_placeholder'), 'Hello');
    expect(mockSetTitle).toHaveBeenCalledWith('Hello');
    await fireEvent.changeText(view.getByPlaceholderText('body_placeholder'), 'Body');
    expect(mockSetBody).toHaveBeenCalledWith('Body');
    await fireEvent.changeText(view.getByPlaceholderText('extra_notes_placeholder'), 'More');
    expect(mockSetExtraNotes).toHaveBeenCalledWith('More');
    await fireEvent.press(view.getByTestId('switch-is_favorite'));
    expect(mockSetIsFavorite).toHaveBeenCalledWith(true);

    await fireEvent.press(view.getByText('create_note'));
    expect(mockHandleSave).toHaveBeenCalled();
  });

  it('renders the edit form with deletion', async () => {
    mockRoute.params = { noteId: 'note-1' };
    mockFormState.current = {
      ...mockFormState.current,
      title: 'Hello',
      body: 'Body',
      isFavorite: true,
      isEditing: true,
      currentNoteId: 'note-1',
    };
    const view = await render(<NoteFormScreen />);

    expect(view.getByTestId('form-title').props.children).toBe('edit_note_title');
    expect(view.getByDisplayValue('Hello')).toBeTruthy();
    expect(view.getByTestId('switch-is_favorite').props.children).toBe('is_favorite:true');

    await fireEvent.press(view.getByText('save_changes'));
    expect(mockHandleSave).toHaveBeenCalled();
    await fireEvent.press(view.getByText('delete_note_title'));
    expect(mockHandleDelete).toHaveBeenCalled();
  });

  it('binds tags and custom attributes', async () => {
    const view = await render(<NoteFormScreen />);

    expect(view.getByTestId('tags-pill').props.children).toBe('tags:');
    expect(mockPillProps?.selectedValues).toEqual([]);
    await fireEvent.press(view.getByTestId('tags-pill'));
    expect(mockHandleTagSelectionChange).toHaveBeenCalledWith(['tag-1']);

    expect(mockCustomProps).not.toBeNull();
    await fireEvent.press(view.getByTestId('custom-fields'));
    expect(mockSetCustomValues).toHaveBeenCalled();
  });

  it('shows loading while the note loads', async () => {
    mockFormState.current = { ...mockFormState.current, loading: true };
    const view = await render(<NoteFormScreen />);

    expect(view.queryByTestId('form-title')).toBeNull();
  });
});
