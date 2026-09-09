const mockAlert = jest.fn();

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AttributeType } from '@keres/shared';
import { act, renderHook } from '@testing-library/react-native';
import { useStorySchemaFieldFormActions } from '../../../src/screens/storyschema/useStorySchemaFieldFormActions';
import type { StorySchemaFieldFormState } from '../../../src/screens/storyschema/useStorySchemaFieldFormState';
import type { StorySchemaFieldService } from '../../../src/services/storymanagement/StorySchemaFieldService';

const createState = (
  overrides: Partial<StorySchemaFieldFormState> = {},
): StorySchemaFieldFormState =>
  ({
    name: 'Power Level',
    key: 'power_level',
    description: null,
    setDescription: jest.fn(),
    type: AttributeType.TEXT,
    setType: jest.fn(),
    targetEntityType: null,
    setTargetEntityType: jest.fn(),
    isRequired: false,
    setIsRequired: jest.fn(),
    defaultValue: null,
    setDefaultValue: jest.fn(),
    loading: false,
    isEditing: false,
    handleNameChange: jest.fn(),
    handleKeyChange: jest.fn(),
    ...overrides,
  }) as StorySchemaFieldFormState;

const storySchemaFieldService = {
  createField: jest.fn(),
  updateField: jest.fn(),
} as unknown as StorySchemaFieldService;

const navigation = {
  goBack: jest.fn(),
};

const renderActions = (state = createState(), overrides: Record<string, unknown> = {}) =>
  renderHook(() =>
    useStorySchemaFieldFormActions({
      state,
      storySchemaFieldServiceRef: { current: storySchemaFieldService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      entityType: 'Character',
      existingFieldCount: 2,
      ...overrides,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  (storySchemaFieldService.createField as jest.Mock).mockResolvedValue({ id: 'field-1' });
  (storySchemaFieldService.updateField as jest.Mock).mockResolvedValue(undefined);
});

it('rejects a blank display name before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => {
    await view.result.current.handleSave();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'display_name_required');
  expect(storySchemaFieldService.createField).not.toHaveBeenCalled();
});

it('rejects an invalid attribute key before persistence', async () => {
  const view = await renderActions(createState({ key: 'Bad Key!' }));

  await act(async () => {
    await view.result.current.handleSave();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'invalid_attribute_key');
  expect(storySchemaFieldService.createField).not.toHaveBeenCalled();
});

it('requires a target entity type for ENTITY attributes', async () => {
  const view = await renderActions(
    createState({ type: AttributeType.ENTITY, targetEntityType: null }),
  );

  await act(async () => {
    await view.result.current.handleSave();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'attribute_target_entity_type_required');
  expect(storySchemaFieldService.createField).not.toHaveBeenCalled();
});

it('creates a field and navigates back', async () => {
  const view = await renderActions(createState({ description: '  strong  ', defaultValue: ' 1 ' }));

  await act(async () => {
    await view.result.current.handleSave();
  });

  expect(storySchemaFieldService.createField).toHaveBeenCalledWith('user-1', {
    storyId: 'story-1',
    entityType: 'Character',
    name: 'Power Level',
    key: 'power_level',
    description: 'strong',
    type: AttributeType.TEXT,
    targetEntityType: null,
    isRequired: false,
    defaultValue: '1',
    order: 2,
  });
  expect(navigation.goBack).toHaveBeenCalled();
});

it('updates an existing field without rewriting key or type', async () => {
  const view = await renderActions(
    createState({
      isEditing: true,
      name: 'Updated',
      description: 'note',
      isRequired: true,
      defaultValue: 'x',
    }),
    { initialFieldId: 'field-1' },
  );

  await act(async () => {
    await view.result.current.handleSave();
  });

  expect(storySchemaFieldService.updateField).toHaveBeenCalledWith('user-1', 'field-1', {
    name: 'Updated',
    description: 'note',
    isRequired: true,
    defaultValue: 'x',
  });
  expect(storySchemaFieldService.createField).not.toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalled();
});

it('clears default value when saving an ENTITY attribute', async () => {
  const view = await renderActions(
    createState({
      isEditing: true,
      type: AttributeType.ENTITY,
      targetEntityType: 'Location',
      defaultValue: 'should-clear',
    }),
    { initialFieldId: 'field-1' },
  );

  await act(async () => {
    await view.result.current.handleSave();
  });

  expect(storySchemaFieldService.updateField).toHaveBeenCalledWith('user-1', 'field-1', {
    name: 'Power Level',
    description: null,
    isRequired: false,
    defaultValue: null,
  });
});

it('surfaces persistence failures without navigating back', async () => {
  (storySchemaFieldService.createField as jest.Mock).mockRejectedValue(new Error('duplicate key'));
  const view = await renderActions();

  await act(async () => {
    await view.result.current.handleSave();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'duplicate key');
  expect(navigation.goBack).not.toHaveBeenCalled();
});
