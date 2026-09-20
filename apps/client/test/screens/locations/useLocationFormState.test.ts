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
import { useLocationFormState } from '../../../src/screens/locations/useLocationFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { LocationService } from '../../../src/services/storymanagement/LocationService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const customFields: StorySchemaField[] = [];

function locationServiceRefReturning(location: object | null) {
  return {
    current: {
      getById: jest.fn().mockResolvedValue(location),
    } as unknown as LocationService,
  };
}

function renderForm(initialLocationId?: string, location?: object | null) {
  // Stable across renders: a fresh ref identity per render would retrigger the load effect.
  const locationServiceRef = locationServiceRefReturning(location ?? null);
  return renderHook(() =>
    useLocationFormState({
      initialLocationId,
      storyId: 'story-1',
      drizzleDb: database.db,
      locationServiceRef,
      customFields,
    }),
  );
}

const persistedLocation = {
  name: 'Rivendell',
  description: 'Vale elfico',
  climate: null,
  culture: null,
  politics: null,
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

describe('useLocationFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const first = await renderForm();
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Minas Tirith');
    });
    await act(async () => {
      first.unmount();
    });

    const second = await renderForm();
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Minas Tirith');
  });

  it('writes no draft when nothing was typed', async () => {
    const first = await renderForm();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      first.unmount();
    });

    const second = await renderForm();
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const first = await renderForm('loc-1', persistedLocation);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('Rivendell');

    await act(async () => {
      first.result.current.setName('Rivendell em chamas');
    });
    await act(async () => {
      first.unmount();
    });

    const second = await renderForm('loc-1', persistedLocation);
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Rivendell em chamas');
    expect(second.result.current.description).toBe('Vale elfico');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const first = await renderForm('loc-1', persistedLocation);
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerLocation = {
      ...persistedLocation,
      name: 'Rivendell renovada',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const second = await renderForm('loc-1', newerLocation);
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Rivendell renovada');
  });
});
