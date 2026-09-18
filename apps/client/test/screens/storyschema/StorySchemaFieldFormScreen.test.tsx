import { AttributeType } from '@keres/shared';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockGoBack = jest.fn();
const mockNavigation = { goBack: mockGoBack, navigate: jest.fn() };
const mockSetDescription = jest.fn();
const mockSetType = jest.fn();
const mockSetTargetEntityType = jest.fn();
const mockSetIsRequired = jest.fn();
const mockSetDefaultValue = jest.fn();
const mockHandleNameChange = jest.fn();
const mockHandleKeyChange = jest.fn();
const mockHandleSave = jest.fn();
const mockUseFieldFormState = jest.fn();
const mockUseFieldFormActions = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockServiceRef = { current: null };
const mockDb = {};
const mockT = (key: string) => key;
let mockRouteParams: { entityType: string; fieldId?: string } = { entityType: 'Character' };
let mockStory: { id: string } | null = { id: 'story-1' };
let mockUserId: string | null = 'user-1';
let mockFormState = {
  name: '',
  key: '',
  description: null as string | null,
  type: AttributeType.TEXT,
  targetEntityType: null as string | null,
  isRequired: false,
  defaultValue: null as string | null,
  loading: false,
  isEditing: false,
};
let mockSaving = false;

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
      { testID: `btn-${children}`, onPress: disabled ? undefined : onPress },
      children,
    );
  },
}));
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenLoading: ({ message }: { message: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-loading' }, message);
  },
}));
jest.mock('@/src/components/common/forms/EntityFormContainer/EntityFormContainer', () => ({
  __esModule: true,
  default: ({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'form-container' }, actions, children);
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
    editable?: boolean;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.TextInput, {
      testID: `input-${props.placeholder}`,
      value: props.value,
      onChangeText: props.onChangeText,
      editable: props.editable,
    });
  },
}));
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => ({
  __esModule: true,
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
        { testID: `single-${props.placeholder}-value` },
        props.value ?? 'none',
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
      react.createElement(
        native.Text,
        {
          testID: `single-${props.placeholder}-clear`,
          onPress: () => props.onValueChange(null),
        },
        'clear',
      ),
    );
  },
}));
jest.mock('@/src/components/common/forms/CustomAttributeFields/AttributeValueInput', () => ({
  __esModule: true,
  default: (props: { type: string; value: string; onChange: (v: string) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'default-input' },
      react.createElement(native.Text, { testID: 'default-type' }, props.type),
      react.createElement(
        native.Text,
        { testID: 'default-change', onPress: () => props.onChange('next') },
        props.value,
      ),
    );
  },
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useStorySchemaFields', () => ({
  __esModule: true,
  useStorySchemaFields: () => [{ id: 'f-0' }, { id: 'f-1' }],
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
  useTheme: () => ({ colors: {} }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));
jest.mock('../../../src/screens/storyschema/useStorySchemaFieldFormResources', () => ({
  __esModule: true,
  useStorySchemaFieldFormResources: () => ({ storySchemaFieldServiceRef: mockServiceRef }),
}));
jest.mock('../../../src/screens/storyschema/useStorySchemaFieldFormState', () => ({
  __esModule: true,
  useStorySchemaFieldFormState: (...args: unknown[]) => mockUseFieldFormState(...args),
}));
jest.mock('../../../src/screens/storyschema/useStorySchemaFieldFormActions', () => ({
  __esModule: true,
  useStorySchemaFieldFormActions: (...args: unknown[]) => mockUseFieldFormActions(...args),
}));

import StorySchemaFieldFormScreen from '../../../src/screens/storyschema/StorySchemaFieldFormScreen';

const freshFormState = () => ({
  name: '',
  key: '',
  description: null as string | null,
  type: AttributeType.TEXT,
  targetEntityType: null as string | null,
  isRequired: false,
  defaultValue: null as string | null,
  loading: false,
  isEditing: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = { entityType: 'Character' };
  mockStory = { id: 'story-1' };
  mockUserId = 'user-1';
  mockFormState = freshFormState();
  mockSaving = false;
  mockUseFieldFormState.mockImplementation(() => ({
    ...mockFormState,
    setDescription: mockSetDescription,
    setType: mockSetType,
    setTargetEntityType: mockSetTargetEntityType,
    setIsRequired: mockSetIsRequired,
    setDefaultValue: mockSetDefaultValue,
    handleNameChange: mockHandleNameChange,
    handleKeyChange: mockHandleKeyChange,
  }));
  mockUseFieldFormActions.mockImplementation(() => ({
    handleSave: mockHandleSave,
    saving: mockSaving,
  }));
});

afterEach(() => {
  cleanup();
});

it('shows the loading state', async () => {
  mockFormState = { ...freshFormState(), loading: true };
  const view = await render(<StorySchemaFieldFormScreen />);

  expect(view.getByTestId('screen-loading').props.children).toBe('loading');
});

it('renders the creation form and wires the hooks', async () => {
  const view = await render(<StorySchemaFieldFormScreen />);

  expect(view.getByTestId('btn-save')).toBeTruthy();
  expect(view.getByTestId('field-attribute_display_name')).toBeTruthy();
  expect(view.getByTestId('field-attribute_internal_key')).toBeTruthy();
  expect(view.getByTestId('input-attribute_internal_key_placeholder').props.editable).toBe(true);

  expect(mockUseFieldFormState).toHaveBeenCalledWith(
    expect.objectContaining({
      initialFieldId: undefined,
      storySchemaFieldServiceRef: mockServiceRef,
    }),
  );
  expect(mockUseFieldFormActions).toHaveBeenCalledWith(
    expect.objectContaining({
      storyId: 'story-1',
      userId: 'user-1',
      entityType: 'Character',
      existingFieldCount: 2,
    }),
  );

  await fireEvent.press(view.getByTestId('btn-save'));
  expect(mockHandleSave).toHaveBeenCalled();
});

it('renders the edit form with locked key and saving state', async () => {
  mockRouteParams = { entityType: 'Character', fieldId: 'f-1' };
  mockFormState = { ...freshFormState(), isEditing: true };
  mockSaving = true;
  const view = await render(<StorySchemaFieldFormScreen />);

  expect(view.getByTestId('btn-saving')).toBeTruthy();
  expect(view.getByTestId('input-attribute_internal_key_placeholder').props.editable).toBe(false);
  expect(mockUseFieldFormState).toHaveBeenCalledWith(
    expect.objectContaining({ initialFieldId: 'f-1' }),
  );
});

it('wires inputs, type and required switch', async () => {
  const view = await render(<StorySchemaFieldFormScreen />);

  await fireEvent.changeText(
    view.getByTestId('input-attribute_display_name_placeholder'),
    'Nickname',
  );
  expect(mockHandleNameChange).toHaveBeenCalledWith('Nickname');
  await fireEvent.changeText(view.getByTestId('input-attribute_internal_key_placeholder'), 'nick');
  expect(mockHandleKeyChange).toHaveBeenCalledWith('nick');
  await fireEvent.changeText(view.getByTestId('input-attribute_description_placeholder'), 'd');
  expect(mockSetDescription).toHaveBeenCalledWith('d');

  await fireEvent.press(view.getByTestId(`single-attribute_type_label-${AttributeType.NUMBER}`));
  expect(mockSetType).toHaveBeenCalledWith(AttributeType.NUMBER);

  await fireEvent.press(view.getByTestId('single-attribute_type_label-clear'));
  expect(mockSetType).toHaveBeenCalledWith(AttributeType.TEXT);

  await fireEvent.press(view.getByTestId('switch-attribute_required'));
  expect(mockSetIsRequired).toHaveBeenCalledWith(true);

  await fireEvent.press(view.getByTestId('default-change'));
  expect(mockSetDefaultValue).toHaveBeenCalledWith('next');
});

it('shows the target entity picker for entity types', async () => {
  mockFormState = { ...freshFormState(), type: AttributeType.ENTITY };
  const view = await render(<StorySchemaFieldFormScreen />);

  expect(view.getByTestId('field-attribute_target_entity_type')).toBeTruthy();
  expect(view.queryByTestId('default-input')).toBeNull();

  await fireEvent.press(view.getByTestId('single-attribute_target_entity_type-Scene'));
  expect(mockSetTargetEntityType).toHaveBeenCalledWith('Scene');

  await fireEvent.press(view.getByTestId('single-attribute_target_entity_type-clear'));
  expect(mockSetTargetEntityType).toHaveBeenCalledWith(null);
});

it('goes back when the field is missing', async () => {
  await render(<StorySchemaFieldFormScreen />);

  const onFieldMissing = mockUseFieldFormState.mock.calls[0][0] as {
    onFieldMissing: () => void;
  };
  onFieldMissing.onFieldMissing();
  expect(mockGoBack).toHaveBeenCalled();
});
