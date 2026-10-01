// The hook lists `t` in its effect deps, so the mock must return a stable function like
// the real i18n does; a fresh closure per render re-triggers hydration forever.
const mockTranslate = jest.fn((key: string) => key);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useTagFormState } from '../../../src/screens/tags/useTagFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { TagService } from '../../../src/services/storymanagement/TagService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const createTagServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as TagService,
});

const renderState = async (options: {
  tagId?: string;
  tag?: object | null;
  serviceRef?: { current: TagService | null };
}) => {
  const tagServiceRef = options.serviceRef ?? createTagServiceRef();
  if (options.tag !== undefined && tagServiceRef.current) {
    (tagServiceRef.current.getById as jest.Mock).mockResolvedValue(options.tag);
  }
  const view = await renderHook(() =>
    useTagFormState({ tagId: options.tagId, storyId: 'story-1', tagServiceRef }),
  );
  return { tagServiceRef, view };
};

const persistedTag = {
  name: 'Urgente',
  color: '#f00',
  isFavorite: false,
  extraNotes: null,
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

it('starts a creation form empty and ready', async () => {
  const { tagServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.name).toBe('');
  expect(view.result.current.loadError).toBeNull();
  expect(tagServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates the tag being edited', async () => {
  const { tagServiceRef, view } = await renderState({
    tagId: 'tag-1',
    tag: { name: 'Urgent', color: '#f00', isFavorite: true, extraNotes: 'side' },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(tagServiceRef.current!.getById).toHaveBeenCalledWith('tag-1');
  expect(view.result.current.name).toBe('Urgent');
  expect(view.result.current.color).toBe('#f00');
  expect(view.result.current.isFavorite).toBe(true);
  expect(view.result.current.loadError).toBeNull();
});

it('treats a missing color as an empty draft', async () => {
  const { view } = await renderState({
    tagId: 'tag-1',
    tag: { name: 'Plain', color: null, isFavorite: false, extraNotes: null },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.color).toBe('');
});

it('reports a missing-entity error instead of an empty editing form', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ tagId: 'missing', tag: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.loadError).toBe('tag_data_missing');
  expect(warn).toHaveBeenCalledWith('Tag not found:', 'missing');
  warn.mockRestore();
});

it('reports a missing-entity error when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const tagServiceRef = createTagServiceRef();
  (tagServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() => useTagFormState({ tagId: 'tag-1', tagServiceRef }));

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.loadError).toBe('tag_data_missing');
  expect(error).toHaveBeenCalledWith('Failed to load tag:', expect.any(Error));
  error.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({ tagId: 'tag-1', serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));
});

describe('useTagFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Herói');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Herói');
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
    const { view: first } = await renderState({ tagId: 'tag-1', tag: persistedTag });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('Urgente');

    await act(async () => {
      first.result.current.setName('Urgente, revisto');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ tagId: 'tag-1', tag: persistedTag });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Urgente, revisto');
    expect(second.result.current.color).toBe('#f00');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Herói');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('');
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
      second.result.current.setName('Vilão');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('Vilão');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({ tagId: 'tag-1', tag: persistedTag });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
      first.result.current.setColor('#0f0');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('Urgente');
    expect(first.result.current.color).toBe('#f00');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ tagId: 'tag-1', tag: persistedTag });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Urgente');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({ tagId: 'tag-1', tag: persistedTag });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerTag = {
      ...persistedTag,
      name: 'Urgente refeita',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({ tagId: 'tag-1', tag: newerTag });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Urgente refeita');
  });
});
