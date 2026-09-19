import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockShowNotification = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockReadSecondaryDraft = jest.fn();
const mockPersistSecondaryDraft = jest.fn();
const mockClearSecondaryDraft = jest.fn();
const mockHandleSave = jest.fn();
const mockHandleDelete = jest.fn();

let mockRouteParams: { locationId?: string } = {};
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
    persistSecondaryDraft: mockPersistSecondaryDraft,
    clearSecondaryDraft: mockClearSecondaryDraft,
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
    createTitle: 'Create location',
    editTitle: 'Edit location',
    formDescription: 'Location fields',
    saveLabel: 'Save',
    deleteLabel: 'Delete',
  }),
}));
jest.mock('../../../src/screens/locations/useLocationFormResources', () => ({
  __esModule: true,
  useLocationFormResources: () => ({
    drizzleDb: {},
    locationServiceRef: { current: {} },
    locationRelationServiceRef: { current: {} },
  }),
}));
jest.mock('../../../src/screens/locations/useLocationFormState', () => ({
  __esModule: true,
  useLocationFormState: () => mockFormState,
}));
jest.mock('../../../src/screens/locations/useLocationFormAssociations', () => ({
  __esModule: true,
  useLocationFormAssociations: () => ({
    availableTags: [{ id: 'tag-1', name: 'City' }],
    selectedTagIds: ['tag-1'],
    allNotes: [],
    locationNoteRelations: [],
    pendingNoteRelations: [],
    persistTagRelations: jest.fn(),
    saveNoteRelation: jest.fn(),
    deleteNoteRelation: jest.fn(),
    persistNoteRelations: jest.fn(),
    handleTagSelectionChange: jest.fn(),
    allLocations: [],
    allLocationRelations: [],
    pendingLocationRelations: [],
    handleSetParent: jest.fn(),
    handleAddChild: jest.fn(),
    handleAddConnection: jest.fn(),
    handleRemoveLocationRelation: jest.fn(),
    persistPendingLocationRelations: jest.fn(),
  }),
}));
jest.mock('../../../src/screens/locations/useLocationFormActions', () => ({
  __esModule: true,
  useLocationFormActions: () => ({
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
jest.mock('../../../src/screens/locations/LocationFormContent', () => ({
  __esModule: true,
  LocationFormContent: (props: {
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

import LocationFormScreen from '../../../src/screens/locations/LocationFormScreen';

function freshFormState(overrides: Record<string, unknown> = {}) {
  const noop = jest.fn();
  return {
    currentLocationId: 'loc-1',
    name: 'Keep',
    setName: noop,
    description: null,
    setDescription: noop,
    climate: null,
    setClimate: noop,
    culture: null,
    setCulture: noop,
    politics: null,
    setPolitics: noop,
    isFavorite: false,
    setIsFavorite: noop,
    extraNotes: null,
    setExtraNotes: noop,
    customValues: {},
    setCustomValues: noop,
    loading: false,
    isEditing: true,
    ...overrides,
  };
}

function jsonOf(view: { getByTestId: (id: string) => { props: { children?: unknown } } }) {
  return JSON.parse(view.getByTestId('form-marker').props.children as string);
}

describe('LocationFormScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    mockFormState = freshFormState({ currentLocationId: undefined, isEditing: false });
    mockSaving = false;
    mockDeleting = false;
    mockReadSecondaryDraft.mockResolvedValue(null);
  });

  it('shows the loading state while the form state loads', async () => {
    mockFormState = freshFormState({ loading: true });
    const view = await render(<LocationFormScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
  });

  it('renders the create form without an initial location id', async () => {
    const view = await render(<LocationFormScreen />);
    expect(jsonOf(view)).toMatchObject({
      title: 'Create location',
      description: 'Location fields',
      name: 'Keep',
      editing: false,
      tags: ['tag-1'],
    });
    await fireEvent.press(view.getByTestId('form-save'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('form-delete'));
    expect(mockHandleDelete).toHaveBeenCalledTimes(1);
    expect(mockUseScreenHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Create location' }),
    );
  });

  it('renders the edit form with an initial location id', async () => {
    mockRouteParams = { locationId: 'loc-1' };
    mockFormState = freshFormState();
    const view = await render(<LocationFormScreen />);
    expect(jsonOf(view)).toMatchObject({ title: 'Edit location', editing: true });
    expect(mockUseScreenHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Edit location' }),
    );
    await waitFor(() =>
      expect(mockReadSecondaryDraft).toHaveBeenCalledWith('story-1', 'Location', 'loc-1'),
    );
  });

  it('notifies when a secondary draft was restored', async () => {
    mockRouteParams = { locationId: 'loc-1' };
    mockFormState = freshFormState();
    mockReadSecondaryDraft.mockResolvedValue({
      selectedTagIds: ['tag-1'],
      pendingNoteRelations: [],
      pendingEntityRelations: [],
      customValues: {},
    });
    await render(<LocationFormScreen />);
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith('entity_secondary_draft_restored', 'info'),
    );
  });

  it('stays silent without a restorable draft', async () => {
    mockRouteParams = { locationId: 'loc-1' };
    mockFormState = freshFormState();
    mockReadSecondaryDraft.mockResolvedValue({
      selectedTagIds: [],
      pendingNoteRelations: [],
      pendingEntityRelations: [],
      customValues: {},
    });
    await render(<LocationFormScreen />);
    await waitFor(() => expect(mockReadSecondaryDraft).toHaveBeenCalled());
    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});
