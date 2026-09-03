/** @jest-environment node */
jest.mock('../../src/db', () => ({
  __esModule: true,
  useDrizzle: jest.fn(),
  worldRules: jest.requireActual('../../src/db/schema').worldRules,
}));
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});
jest.mock('../../src/utils/entityOptions', () => ({
  __esModule: true,
  loadEntityOptions: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import {
  decodeSeeAlsoValue,
  encodeSeeAlsoValue,
  useSeeAlsoEntityOptions,
} from '../../src/hooks/useSeeAlsoEntityOptions';
import { loadEntityOptions } from '../../src/utils/entityOptions';

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ all: jest.fn(() => []) })),
      })),
    })),
  });
  (loadEntityOptions as jest.Mock).mockImplementation(
    async (_db: unknown, _storyId: string, type: string) =>
      type === 'Character'
        ? [{ id: 'character-1', name: 'Ariane' }]
        : [{ id: `${type}-1`, name: null }],
  );
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('round-trips valid picker values and rejects incomplete or unsupported values', () => {
  expect(encodeSeeAlsoValue('Character', 'character:1')).toBe('Character:character:1');
  expect(decodeSeeAlsoValue('Character:character:1')).toEqual({
    entityType: 'Character',
    entityId: 'character:1',
  });
  expect(decodeSeeAlsoValue('Unknown:1')).toBeNull();
  expect(decodeSeeAlsoValue('Character:')).toBeNull();
});

it('loads every supported type, excludes the current entity, and groups the result', async () => {
  const { result } = await renderHook(() =>
    useSeeAlsoEntityOptions('story-1', 'Character', 'character-1'),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(
    result.current.options.find((option) => option.value === 'Character:character-1'),
  ).toBeUndefined();
  expect(result.current.options).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: 'location: unnamed', value: 'Location:Location-1' }),
    ]),
  );
  expect(result.current.optionsByValue.size).toBe(result.current.options.length);
  expect(result.current.groupedOptions).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: 'Character', options: [] })]),
  );
});

it('skips loading with no story and resets empty options after a failed reload', async () => {
  const missing = await renderHook(() =>
    useSeeAlsoEntityOptions(undefined, 'Character', undefined),
  );
  expect(missing.result.current.options).toEqual([]);
  expect(loadEntityOptions).not.toHaveBeenCalled();

  const loaded = await renderHook(() => useSeeAlsoEntityOptions('story-1', 'Character', undefined));
  await waitFor(() => expect(loaded.result.current.loading).toBe(false));
  (loadEntityOptions as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await act(async () => loaded.result.current.reload());
  expect(loaded.result.current.options).toEqual([]);
});
