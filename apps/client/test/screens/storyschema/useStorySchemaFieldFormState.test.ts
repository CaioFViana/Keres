const mockAlert = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AttributeType, deriveAttributeKey } from '@keres/shared';
import { useStorySchemaFieldFormState } from '../../../src/screens/storyschema/useStorySchemaFieldFormState';
import type { StorySchemaFieldService } from '../../../src/services/storymanagement/StorySchemaFieldService';

const createServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as StorySchemaFieldService,
});

const renderState = async (options: {
  initialFieldId?: string;
  field?: object | null;
  serviceRef?: { current: StorySchemaFieldService | null };
  onFieldMissing?: () => void;
}) => {
  const storySchemaFieldServiceRef = options.serviceRef ?? createServiceRef();
  if (options.field !== undefined && storySchemaFieldServiceRef.current) {
    (storySchemaFieldServiceRef.current.getById as jest.Mock).mockResolvedValue(options.field);
  }
  const onFieldMissing = options.onFieldMissing ?? jest.fn();
  const view = await renderHook(() =>
    useStorySchemaFieldFormState({
      initialFieldId: options.initialFieldId,
      storySchemaFieldServiceRef,
      onFieldMissing,
    }),
  );
  return { storySchemaFieldServiceRef, onFieldMissing, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('starts a creation form as optional text', async () => {
  const { view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.type).toBe(AttributeType.TEXT);
  expect(view.result.current.key).toBe('');
  expect(view.result.current.isRequired).toBe(false);
});

it('derives the key from the name until the key is edited by hand', async () => {
  const { view } = await renderState({});
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  await act(async () => {
    view.result.current.handleNameChange('Mood Color');
  });
  expect(view.result.current.key).toBe(deriveAttributeKey('Mood Color'));

  await act(async () => {
    view.result.current.handleKeyChange('Custom_Key');
  });
  expect(view.result.current.key).toBe('custom_key');

  await act(async () => {
    view.result.current.handleNameChange('Something else');
  });
  expect(view.result.current.key).toBe('custom_key');
});

it('hydrates the field being edited and locks its derived key', async () => {
  const { storySchemaFieldServiceRef, view } = await renderState({
    initialFieldId: 'field-1',
    field: {
      name: 'Mood',
      key: 'mood',
      description: 'Scene mood',
      type: AttributeType.NUMBER,
      targetEntityType: null,
      isRequired: true,
      defaultValue: '3',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(storySchemaFieldServiceRef.current!.getById).toHaveBeenCalledWith('field-1');
  expect(view.result.current.type).toBe(AttributeType.NUMBER);
  expect(view.result.current.isRequired).toBe(true);
  expect(view.result.current.defaultValue).toBe('3');

  await act(async () => {
    view.result.current.handleNameChange('Renamed');
  });
  expect(view.result.current.key).toBe('mood');
});

it('alerts and bails out when the field is gone', async () => {
  const onFieldMissing = jest.fn();
  const { view } = await renderState({
    initialFieldId: 'missing',
    field: null,
    onFieldMissing,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(mockAlert).toHaveBeenCalledWith('error', 'attribute_not_found');
  expect(onFieldMissing).toHaveBeenCalled();
});

it('alerts when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const storySchemaFieldServiceRef = createServiceRef();
  (storySchemaFieldServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    useStorySchemaFieldFormState({
      initialFieldId: 'field-1',
      storySchemaFieldServiceRef,
      onFieldMissing: jest.fn(),
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load attribute field:', expect.any(Error));
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_attribute');
  error.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({
    initialFieldId: 'field-1',
    serviceRef: { current: null },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));
});
