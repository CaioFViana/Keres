import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockAlert = jest.fn();
const mockDeleteField = jest.fn();
const mockReorderFields = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
let mockStoryId: string | undefined = 'story-1';
let mockUserId: string | null = 'user-1';
let mockCanEdit = true;
let mockFields: { id: string; name: string; key: string; type: string; isRequired: boolean }[] = [];

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@expo/vector-icons', () => ({
  __esModule: true,
  Ionicons: ({ name }: { name: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `icon-${name}` }, name);
  },
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock(
  '../../../src/components/features/storyschema/StorySchemaFieldReorderModal/StorySchemaFieldReorderModal',
  () => ({
    __esModule: true,
    StorySchemaFieldReorderModal: (props: {
      isVisible: boolean;
      onClose: () => void;
      onReorderConfirm: (order: { id: string; order: number }[]) => void;
    }) => {
      const react = jest.requireActual('react') as typeof import('react');
      const native = jest.requireActual('react-native') as typeof import('react-native');
      if (!props.isVisible) return null;
      return react.createElement(
        native.View,
        { testID: 'reorder-modal' },
        react.createElement(
          native.Text,
          {
            testID: 'reorder-confirm',
            onPress: () => props.onReorderConfirm([{ id: 'f-2', order: 0 }]),
          },
          'confirm',
        ),
        react.createElement(
          native.Text,
          { testID: 'reorder-close', onPress: props.onClose },
          'close',
        ),
      );
    },
  }),
);
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/hooks/useStorySchemaFields', () => ({
  __esModule: true,
  useStorySchemaFields: () => mockFields,
}));
jest.mock('../../../src/services/storymanagement/StorySchemaFieldService', () => ({
  __esModule: true,
  createStorySchemaFieldService: () => ({
    deleteField: mockDeleteField,
    reorderFields: mockReorderFields,
  }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStoryId ? { id: mockStoryId } : null }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#eee',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import StorySchemaListScreen from '../../../src/screens/storyschema/StorySchemaListScreen';

function headerActions() {
  const header = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    title: string;
    actions: { label: string; visible: boolean; onPress: () => void }[];
  };
  return header;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoryId = 'story-1';
  mockUserId = 'user-1';
  mockCanEdit = true;
  mockFields = [];
  mockDeleteField.mockResolvedValue(undefined);
  mockReorderFields.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

it('asks for a story when none is selected', async () => {
  mockStoryId = undefined;
  const view = await render(<StorySchemaListScreen />);

  expect(view.getByText('no_story_selected')).toBeTruthy();
});

it('renders entity tabs and switches between them', async () => {
  const view = await render(<StorySchemaListScreen />);

  expect(view.getByText('story_schema_management_title')).toBeTruthy();
  expect(view.getByText('Characters')).toBeTruthy();
  expect(view.getByText('world_rules_title')).toBeTruthy();
  expect(view.getByText('no_custom_attributes')).toBeTruthy();

  await fireEvent.press(view.getByText('Locations'));
  expect(view.getByText('Locations')).toBeTruthy();

  const header = headerActions();
  expect(header.title).toBe('story_schema_management_title');
});

it('lists fields with required markers and opens the form', async () => {
  mockFields = [
    { id: 'f-1', name: 'Nickname', key: 'nickname', type: 'text', isRequired: true },
    { id: 'f-2', name: 'Age', key: 'age', type: 'number', isRequired: false },
  ];
  const view = await render(<StorySchemaListScreen />);

  await waitFor(() => expect(view.getByText(/Nickname/)).toBeTruthy());
  expect(view.getByText(/attribute_type_text/)).toBeTruthy();

  await fireEvent.press(view.getAllByTestId('icon-pencil-outline')[0]!);
  expect(mockNavigate).toHaveBeenCalledWith('StorySchemaFieldForm', {
    entityType: 'Character',
    fieldId: 'f-1',
  });
});

it('registers create and reorder header actions', async () => {
  mockFields = [
    { id: 'f-1', name: 'Nickname', key: 'nickname', type: 'text', isRequired: false },
    { id: 'f-2', name: 'Age', key: 'age', type: 'number', isRequired: false },
  ];
  const view = await render(<StorySchemaListScreen />);

  await waitFor(() => expect(view.getByText(/Nickname/)).toBeTruthy());
  const header = headerActions();
  expect(header.actions[0]!.visible).toBe(true);
  expect(header.actions[1]!.visible).toBe(true);

  header.actions[1]!.onPress();
  expect(mockNavigate).toHaveBeenCalledWith('StorySchemaFieldForm', {
    entityType: 'Character',
  });

  await act(async () => {
    header.actions[0]!.onPress();
  });
  expect(view.getByTestId('reorder-modal')).toBeTruthy();
  await fireEvent.press(view.getByTestId('reorder-confirm'));
  await waitFor(() =>
    expect(mockReorderFields).toHaveBeenCalledWith('user-1', 'story-1', 'Character', [
      { id: 'f-2', order: 0 },
    ]),
  );
  await waitFor(() => expect(view.queryByTestId('reorder-modal')).toBeNull());
});

it('closes the reorder modal and reports reorder failures', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFields = [
    { id: 'f-1', name: 'Nickname', key: 'nickname', type: 'text', isRequired: false },
    { id: 'f-2', name: 'Age', key: 'age', type: 'number', isRequired: false },
  ];
  mockReorderFields.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<StorySchemaListScreen />);

  await waitFor(() => expect(view.getByText(/Nickname/)).toBeTruthy());
  await act(async () => {
    headerActions().actions[0]!.onPress();
  });
  await fireEvent.press(view.getByTestId('reorder-close'));
  expect(view.queryByTestId('reorder-modal')).toBeNull();

  await act(async () => {
    headerActions().actions[0]!.onPress();
  });
  await fireEvent.press(view.getByTestId('reorder-confirm'));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_attribute'));
  consoleSpy.mockRestore();
});

it('deletes a field after confirmation', async () => {
  mockFields = [{ id: 'f-1', name: 'Nickname', key: 'nickname', type: 'text', isRequired: false }];
  const view = await render(<StorySchemaListScreen />);

  await waitFor(() => expect(view.getByText(/Nickname/)).toBeTruthy());
  await fireEvent.press(view.getByTestId('icon-trash-outline'));
  expect(mockAlert).toHaveBeenCalled();

  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await buttons.find((button) => button.text === 'delete')!.onPress!();
  expect(mockDeleteField).toHaveBeenCalledWith('user-1', 'f-1');
});

it('reports deletion failures and hides actions when read-only', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFields = [
    { id: 'f-1', name: 'Nickname', key: 'nickname', type: 'text', isRequired: false },
    { id: 'f-2', name: 'Age', key: 'age', type: 'number', isRequired: false },
  ];
  mockDeleteField.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<StorySchemaListScreen />);

  await waitFor(() => expect(view.getByText(/Nickname/)).toBeTruthy());
  await fireEvent.press(view.getAllByTestId('icon-trash-outline')[0]!);
  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await buttons.find((button) => button.text === 'delete')!.onPress!();
  await waitFor(() =>
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_attribute'),
  );

  mockCanEdit = false;
  const readonly = await render(<StorySchemaListScreen />);
  await waitFor(() => expect(readonly.getByText(/Nickname/)).toBeTruthy());
  expect(readonly.queryByTestId('icon-trash-outline')).toBeNull();
  expect(readonly.queryByTestId('icon-pencil-outline')).toBeNull();
  const header = headerActions();
  expect(header.actions[0]!.visible).toBe(false);
  expect(header.actions[1]!.visible).toBe(false);
  consoleSpy.mockRestore();
});
