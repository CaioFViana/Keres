/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StatSelect } from '../../../src/db/schema';
import { useStatFormState } from '../../../src/screens/stats/useStatFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const stats = [
  { id: 'stat-1', name: 'Strength', isPrimary: false },
  { id: 'stat-2', name: 'Wit', isPrimary: true },
] as StatSelect[];

const draftStats = [
  {
    id: 'stat-1',
    name: 'Força',
    isPrimary: false,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
] as StatSelect[];

const renderState = (options: { statId?: string; rows?: StatSelect[] }) =>
  renderHook(() =>
    useStatFormState({
      statId: options.statId,
      storyId: 'story-1',
      stats: options.rows ?? draftStats,
    }),
  );

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

it('starts a creation form as a primary stat', async () => {
  const view = await renderHook(() => useStatFormState({ stats }));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.loading).toBe(false);
  expect(view.result.current.name).toBe('');
  expect(view.result.current.isPrimary).toBe(true);
});

it('hydrates the stat being edited', async () => {
  const view = await renderHook(() => useStatFormState({ statId: 'stat-1', stats }));

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(true);
  expect(view.result.current.name).toBe('Strength');
  expect(view.result.current.isPrimary).toBe(false);
});

it('hydrates once the stats list arrives', async () => {
  const view = await renderHook(
    ({ rows }: { rows: StatSelect[] }) => useStatFormState({ statId: 'stat-2', stats: rows }),
    {
      initialProps: { rows: [] as StatSelect[] },
    },
  );

  expect(view.result.current.loading).toBe(true);

  view.rerender({ rows: stats });
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.name).toBe('Wit');
  expect(view.result.current.isPrimary).toBe(true);
});

it('keeps waiting while the edited stat is absent from the list', async () => {
  const view = await renderHook(() => useStatFormState({ statId: 'missing', stats }));

  await act(async () => {});

  expect(view.result.current.name).toBe('');
  expect(view.result.current.loading).toBe(true);
});

describe('useStatFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const first = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Agilidade');
    });
    await act(async () => {
      first.unmount();
    });

    const second = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Agilidade');
  });

  it('writes no draft when nothing was typed', async () => {
    const first = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      first.unmount();
    });

    const second = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const first = await renderState({ statId: 'stat-1' });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('Força');

    await act(async () => {
      first.result.current.setName('Força bruta');
    });
    await act(async () => {
      first.unmount();
    });

    const second = await renderState({ statId: 'stat-1' });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Força bruta');
    expect(second.result.current.isPrimary).toBe(false);
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const first = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Agilidade');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('');
    expect(first.result.current.isPrimary).toBe(true);
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const second = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setName('Sabedoria');
    });
    await act(async () => {
      second.unmount();
    });
    const third = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('Sabedoria');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const first = await renderState({ statId: 'stat-1' });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
      first.result.current.setIsPrimary(true);
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('Força');
    expect(first.result.current.isPrimary).toBe(false);
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const second = await renderState({ statId: 'stat-1' });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Força');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const first = await renderState({ statId: 'stat-1' });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerStats = [
      {
        id: 'stat-1',
        name: 'Força refeita',
        isPrimary: false,
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ] as StatSelect[];
    const second = await renderState({ statId: 'stat-1', rows: newerStats });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Força refeita');
  });
});
