/** @jest-environment node */
const mockAlert = jest.fn();

// The hook lists `t` in its effect deps, so the mock must return a stable function like
// the real i18n does; a fresh closure per render re-triggers hydration forever.
const mockTranslate = jest.fn((key: string) => key);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AttributeType, deriveAttributeKey } from '@keres/shared';
import { useStorySchemaFieldFormState } from '../../../src/screens/storyschema/useStorySchemaFieldFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { StorySchemaFieldService } from '../../../src/services/storymanagement/StorySchemaFieldService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

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
      storyId: 'story-1',
      storySchemaFieldServiceRef,
      onFieldMissing,
    }),
  );
  return { storySchemaFieldServiceRef, onFieldMissing, view };
};

const persistedField = {
  name: 'Humor',
  key: 'humor',
  description: 'Humor da cena',
  type: AttributeType.NUMBER,
  targetEntityType: null,
  isRequired: true,
  defaultValue: '3',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  database = await createTestDatabase();
  setEditorDraftDb(database.db);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetEditorDraftDbForTests();
  database.close();
  jest.restoreAllMocks();
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

describe('useStorySchemaFieldFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.handleNameChange('Nível de Poder');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Nível de Poder');
    expect(second.result.current.key).toBe(deriveAttributeKey('Nível de Poder'));
  });

  it('writes no draft when nothing was typed', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState({
      initialFieldId: 'field-1',
      field: persistedField,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('Humor');

    await act(async () => {
      first.result.current.handleNameChange('Humor revisado');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialFieldId: 'field-1',
      field: persistedField,
    });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Humor revisado');
    expect(second.result.current.key).toBe('humor');
    expect(second.result.current.defaultValue).toBe('3');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.handleNameChange('Nível de Poder');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('');
    expect(first.result.current.key).toBe('');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.handleNameChange('Cor do Humor');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('Cor do Humor');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({
      initialFieldId: 'field-1',
      field: persistedField,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.handleNameChange('Rascunho');
      first.result.current.setIsRequired(false);
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('Humor');
    expect(first.result.current.key).toBe('humor');
    expect(first.result.current.isRequired).toBe(true);
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialFieldId: 'field-1',
      field: persistedField,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Humor');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({
      initialFieldId: 'field-1',
      field: persistedField,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.handleNameChange('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerField = {
      ...persistedField,
      name: 'Humor refeito',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({
      initialFieldId: 'field-1',
      field: newerField,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Humor refeito');
  });

  it('keeps a hand-edited key safe from the auto-slug across a round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.handleNameChange('Mood Color');
      first.result.current.handleKeyChange('custom_key');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));
    expect(second.result.current.key).toBe('custom_key');

    // The manual flag survived the restore: typing a name must not re-slug the key.
    await act(async () => {
      second.result.current.handleNameChange('Something else');
    });
    expect(second.result.current.key).toBe('custom_key');
  });
});
