import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockGoBack = jest.fn();
const mockNavigation = { goBack: mockGoBack, navigate: jest.fn() };
const mockSetItemId = jest.fn();
const mockSetSceneId = jest.fn();
const mockSetNewCharacterOwnerId = jest.fn();
const mockSetNewState = jest.fn();
const mockSetExtraNotes = jest.fn();
const mockSetSelectedTagIds = jest.fn();
const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();
const mockUseFormResources = jest.fn();
const mockUseFormState = jest.fn();
const mockUseFormAssociations = jest.fn();
const mockUseFormActions = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
const mockItemCopy = { itemJourney: 'Journey', entity: 'Item', select: 'Select item' };
const mockSceneCopy = { entity: 'Scene', select: 'Select scene' };
let mockRouteParams: { itemJourneyId?: string; itemId?: string } | undefined = {};
let mockStory: { id: string } | null = { id: 'story-1' };
let mockUserId: string | null = 'user-1';
let mockItems = [
  { id: 'item-1', name: 'Sword', isDeleted: false },
  { id: 'item-2', name: 'Gone', isDeleted: true },
];
let mockScenes = [{ id: 'scene-1', name: 'Opening', isDeleted: false }];
let mockCharacters = [{ id: 'char-1', name: 'Aria', isDeleted: false }];
let mockFormState = {
  currentItemJourneyId: null as string | null,
  itemId: null as string | null,
  sceneId: null as string | null,
  newCharacterOwnerId: null as string | null,
  newState: null as string | null,
  extraNotes: null as string | null,
  loading: false,
  isEditing: false,
};
let mockSaving = false;
let mockDeleting = false;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));
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
jest.mock('@/src/components/layout/ScreenSection/ScreenSection', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `section-${title}` }, title);
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
      { testID: 'tag-pill', onPress: () => props.onSelectionChange(['tag-1']) },
      JSON.stringify(props.selectedValues),
    );
  },
  SingleSelectPill: (props: {
    value: string | null;
    onValueChange: (v: string | null) => void;
    options: { label: string; value: string }[];
    placeholder: string;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: `single-${props.placeholder}` },
      react.createElement(
        native.Text,
        { testID: `single-${props.placeholder}-options` },
        JSON.stringify(props.options.map((option) => option.value)),
      ),
      ...props.options.map((option) =>
        react.createElement(
          native.Text,
          {
            key: option.value,
            testID: `single-${props.placeholder}-${option.value}`,
            onPress: () => props.onValueChange(option.value),
          },
          option.label,
        ),
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
  useVocabularyEntityCopy: (entity: string) => (entity === 'Item' ? mockItemCopy : mockSceneCopy),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    agree: (_entity: string, forms: { masculine: string }) => forms.masculine,
    term: (value: string) => value,
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));
jest.mock('../../../src/screens/itemJourneys/useItemJourneyFormResources', () => ({
  __esModule: true,
  useItemJourneyFormResources: (...args: unknown[]) => mockUseFormResources(...args),
}));
jest.mock('../../../src/screens/itemJourneys/useItemJourneyFormState', () => ({
  __esModule: true,
  useItemJourneyFormState: (...args: unknown[]) => mockUseFormState(...args),
}));
jest.mock('../../../src/screens/itemJourneys/useItemJourneyFormAssociations', () => ({
  __esModule: true,
  useItemJourneyFormAssociations: (...args: unknown[]) => mockUseFormAssociations(...args),
}));
jest.mock('../../../src/screens/itemJourneys/useItemJourneyFormActions', () => ({
  __esModule: true,
  useItemJourneyFormActions: (...args: unknown[]) => mockUseFormActions(...args),
}));

import ItemJourneyFormScreen from '../../../src/screens/itemJourneys/ItemJourneyFormScreen';

const freshFormState = () => ({
  currentItemJourneyId: null as string | null,
  itemId: null as string | null,
  sceneId: null as string | null,
  newCharacterOwnerId: null as string | null,
  newState: null as string | null,
  extraNotes: null as string | null,
  loading: false,
  isEditing: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  mockStory = { id: 'story-1' };
  mockUserId = 'user-1';
  mockItems = [
    { id: 'item-1', name: 'Sword', isDeleted: false },
    { id: 'item-2', name: 'Gone', isDeleted: true },
  ];
  mockScenes = [{ id: 'scene-1', name: 'Opening', isDeleted: false }];
  mockCharacters = [{ id: 'char-1', name: 'Aria', isDeleted: false }];
  mockFormState = freshFormState();
  mockSaving = false;
  mockDeleting = false;
  mockUseFormResources.mockReturnValue({
    itemJourneyServiceRef: { current: null },
    items: mockItems,
    scenes: mockScenes,
    characters: mockCharacters,
  });
  mockUseFormState.mockImplementation(() => ({
    ...mockFormState,
    setItemId: mockSetItemId,
    setSceneId: mockSetSceneId,
    setNewCharacterOwnerId: mockSetNewCharacterOwnerId,
    setNewState: mockSetNewState,
    setExtraNotes: mockSetExtraNotes,
  }));
  mockUseFormAssociations.mockReturnValue({
    availableTags: [],
    selectedTagIds: [],
    setSelectedTagIds: mockSetSelectedTagIds,
    allNotes: [],
    itemJourneyNoteRelations: [],
    pendingNoteRelations: [],
    persistTagRelations: jest.fn(),
    saveNoteRelation: jest.fn(),
    deleteNoteRelation: jest.fn(),
    persistNoteRelations: jest.fn(),
  });
  mockUseFormActions.mockImplementation(() => ({
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
  const view = await render(<ItemJourneyFormScreen />);

  expect(view.getByTestId('screen-loading')).toBeTruthy();
});

it('renders the creation form and wires the hooks', async () => {
  mockRouteParams = { itemId: 'item-1' };
  const view = await render(<ItemJourneyFormScreen />);

  expect(view.getByTestId('form-title').props.children).toBe('vocabulary_create_entity');
  expect(view.getByTestId('form-description').props.children).toBe('item_journey_form_description');
  expect(view.queryByTestId('btn-vocabulary_delete_entity')).toBeNull();

  expect(mockUseFormResources).toHaveBeenCalledWith('story-1');
  expect(mockUseFormState).toHaveBeenCalledWith(
    expect.objectContaining({
      initialItemJourneyId: undefined,
      prefilledItemId: 'item-1',
      storyId: 'story-1',
    }),
  );
  expect(mockUseFormAssociations).toHaveBeenCalledWith(null);
  expect(mockUseFormActions).toHaveBeenCalledWith(
    expect.objectContaining({ storyId: 'story-1', userId: 'user-1' }),
  );

  await fireEvent.press(view.getByTestId('btn-vocabulary_save_entity'));
  expect(mockHandleSave).toHaveBeenCalled();
});

it('renders the edit form with delete and disabled states', async () => {
  mockRouteParams = { itemJourneyId: 'journey-1' };
  mockFormState = { ...freshFormState(), currentItemJourneyId: 'journey-1', isEditing: true };
  mockDeleting = true;
  const view = await render(<ItemJourneyFormScreen />);

  expect(view.getByTestId('form-title').props.children).toBe('vocabulary_edit_entity');
  expect(view.getByTestId('btn-vocabulary_save_entity').props.children).toBe(
    'vocabulary_save_entity (disabled)',
  );
  expect(mockUseFormAssociations).toHaveBeenCalledWith('journey-1');

  await fireEvent.press(view.getByTestId('btn-vocabulary_delete_entity'));
  expect(mockHandleDelete).toHaveBeenCalled();
});

it('wires entity pickers and skips deleted options', async () => {
  const view = await render(<ItemJourneyFormScreen />);

  expect(view.getByTestId('single-Select item-options').props.children).toBe('["item-1"]');
  await fireEvent.press(view.getByTestId('single-Select item-item-1'));
  expect(mockSetItemId).toHaveBeenCalledWith('item-1');

  await fireEvent.press(view.getByTestId('single-Select scene-scene-1'));
  expect(mockSetSceneId).toHaveBeenCalledWith('scene-1');

  await fireEvent.press(view.getByTestId('single-select_item_journey_new_character_owner-char-1'));
  expect(mockSetNewCharacterOwnerId).toHaveBeenCalledWith('char-1');
});

it('wires state and notes inputs', async () => {
  const view = await render(<ItemJourneyFormScreen />);

  await fireEvent.changeText(view.getByTestId('suggest-new_state_placeholder'), 'Broken');
  expect(mockSetNewState).toHaveBeenCalledWith('Broken');
  await fireEvent.changeText(view.getByTestId('input-extra_notes_placeholder'), 'fell');
  expect(mockSetExtraNotes).toHaveBeenCalledWith('fell');
});

it('wires tags, notes and see-also with a story', async () => {
  const view = await render(<ItemJourneyFormScreen />);

  expect(view.getByTestId('section-tags_title')).toBeTruthy();
  expect(view.getByTestId('section-notes_title')).toBeTruthy();
  await fireEvent.press(view.getByTestId('tag-pill'));
  expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-1']);
  expect(view.getByTestId('note-manager')).toBeTruthy();
  expect(view.getByTestId('seealso-manager')).toBeTruthy();
});

it('hides secondary sections without a story', async () => {
  mockStory = null;
  const view = await render(<ItemJourneyFormScreen />);

  expect(view.queryByTestId('tag-pill')).toBeNull();
  expect(view.queryByTestId('note-manager')).toBeNull();
  expect(view.queryByTestId('seealso-manager')).toBeNull();
});

it('tolerates missing route params', async () => {
  mockRouteParams = undefined;
  const view = await render(<ItemJourneyFormScreen />);

  expect(view.getByTestId('form-title').props.children).toBe('vocabulary_create_entity');
});
