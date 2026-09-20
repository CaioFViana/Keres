/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useWorldRuleFormState } from '../../../src/screens/worldrules/useWorldRuleFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { WorldRuleService } from '../../../src/services/storymanagement/WorldRuleService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const createWorldRuleServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as WorldRuleService,
});

const renderState = async (options: {
  initialWorldRuleId?: string;
  storyId?: string;
  worldRule?: object | null;
  customFields?: StorySchemaField[];
  serviceRef?: { current: WorldRuleService | null };
}) => {
  const worldRuleServiceRef = options.serviceRef ?? createWorldRuleServiceRef();
  if (options.worldRule !== undefined && worldRuleServiceRef.current) {
    (worldRuleServiceRef.current.getById as jest.Mock).mockResolvedValue(options.worldRule);
  }
  const view = await renderHook(() =>
    useWorldRuleFormState({
      initialWorldRuleId: options.initialWorldRuleId,
      storyId: options.storyId ?? 'story-1',
      drizzleDb: database.db,
      worldRuleServiceRef,
      customFields: options.customFields ?? [],
    }),
  );
  return { worldRuleServiceRef, view };
};

const persistedWorldRule = {
  title: 'Dízimo de ferro',
  description: 'Toda forja paga',
  section: 'location',
  type: 'Lei',
  category: 'Economia',
  behavior: 'Aplicada',
  usability: 'Comum',
  danger: 'Baixo',
  isFavorite: false,
  extraNotes: null,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
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

it('starts a creation form in the rule section with custom defaults', async () => {
  const customFields = [{ id: 'field-1', defaultValue: 'fallback' }] as StorySchemaField[];
  const { worldRuleServiceRef, view } = await renderState({ customFields });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.section).toBe('rule');
  expect(view.result.current.customValues).toEqual({ 'field-1': 'fallback' });
  expect(worldRuleServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('retains a newly persisted world-rule id without refetching', async () => {
  const { worldRuleServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => {
    view.result.current.setTitle('Draft');
    view.result.current.retainPersistedWorldRuleId('rule-created');
  });

  expect(view.result.current.title).toBe('Draft');
  expect(view.result.current.currentWorldRuleId).toBe('rule-created');
  expect(view.result.current.isEditing).toBe(true);
  expect(worldRuleServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates every world-rule field and its stored custom values', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field-1', value: 'stored' }]);
  const { worldRuleServiceRef, view } = await renderState({
    initialWorldRuleId: 'rule-1',
    worldRule: {
      title: 'Iron tithe',
      description: 'Every forge pays',
      section: 'location',
      type: 'Law',
      category: 'Economy',
      behavior: 'Enforced',
      usability: 'Common',
      danger: 'Low',
      isFavorite: true,
      extraNotes: 'side',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(worldRuleServiceRef.current!.getById).toHaveBeenCalledWith('rule-1');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('rule-1');
  expect(view.result.current.title).toBe('Iron tithe');
  expect(view.result.current.section).toBe('location');
  expect(view.result.current.type).toBe('Law');
  expect(view.result.current.category).toBe('Economy');
  expect(view.result.current.behavior).toBe('Enforced');
  expect(view.result.current.usability).toBe('Common');
  expect(view.result.current.danger).toBe('Low');
  expect(view.result.current.customValues).toEqual({ 'field-1': 'stored' });
});

it('warns and finishes loading when the world rule is missing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ initialWorldRuleId: 'missing', worldRule: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(warn).toHaveBeenCalledWith('World rule not found:', 'missing');
  expect(view.result.current.title).toBe('');
  warn.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({ serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
});

it('logs and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const worldRuleServiceRef = createWorldRuleServiceRef();
  (worldRuleServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    useWorldRuleFormState({
      initialWorldRuleId: 'rule-1',
      storyId: 'story-1',
      drizzleDb: database.db,
      worldRuleServiceRef,
      customFields: [],
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load world rule:', expect.any(Error));
  error.mockRestore();
});

describe('useWorldRuleFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setTitle('Lei do bronze');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.title).toBe('Lei do bronze');
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
    expect(second.result.current.title).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState({
      initialWorldRuleId: 'rule-1',
      worldRule: persistedWorldRule,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.title).toBe('Dízimo de ferro');

    await act(async () => {
      first.result.current.setTitle('Dízimo de ferro, revisto');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialWorldRuleId: 'rule-1',
      worldRule: persistedWorldRule,
    });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.title).toBe('Dízimo de ferro, revisto');
    expect(second.result.current.description).toBe('Toda forja paga');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setTitle('Lei do bronze');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.title).toBe('');
    expect(first.result.current.section).toBe('rule');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.title).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setTitle('Lei da prata');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.title).toBe('Lei da prata');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({
      initialWorldRuleId: 'rule-1',
      worldRule: persistedWorldRule,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setTitle('Rascunho');
      first.result.current.setSection('rule');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.title).toBe('Dízimo de ferro');
    expect(first.result.current.section).toBe('location');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({
      initialWorldRuleId: 'rule-1',
      worldRule: persistedWorldRule,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.title).toBe('Dízimo de ferro');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({
      initialWorldRuleId: 'rule-1',
      worldRule: persistedWorldRule,
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setTitle('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerWorldRule = {
      ...persistedWorldRule,
      title: 'Dízimo refeito',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({
      initialWorldRuleId: 'rule-1',
      worldRule: newerWorldRule,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.title).toBe('Dízimo refeito');
  });
});
