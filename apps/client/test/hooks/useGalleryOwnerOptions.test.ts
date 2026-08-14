/** @jest-environment node */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import {
  decodeOwnerValue,
  encodeOwnerValue,
  useGalleryOwnerOptions,
} from '../../src/hooks/useGalleryOwnerOptions';

const rows = [
  [{ id: 'character-1', name: 'Ariane' }],
  [{ id: 'location-1', name: 'Farol' }],
  [{ id: 'note-1', name: null }],
  [{ id: 'scene-1', name: 'Prólogo' }],
  [{ id: 'item-1', name: 'Chave' }],
];

function queryFor(result: unknown) {
  return { from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve(result)) })) };
}

const db = { select: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue(db);
  db.select.mockImplementationOnce(() => queryFor(rows[0]));
  db.select.mockImplementationOnce(() => queryFor(rows[1]));
  db.select.mockImplementationOnce(() => queryFor(rows[2]));
  db.select.mockImplementationOnce(() => queryFor(rows[3]));
  db.select.mockImplementationOnce(() => queryFor(rows[4]));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('encodes only valid owner values and decodes them back to their typed identity', () => {
  expect(encodeOwnerValue('Character', 'character:1')).toBe('Character:character:1');
  expect(decodeOwnerValue('Character:character:1')).toEqual({
    ownerType: 'Character',
    ownerId: 'character:1',
  });
  expect(decodeOwnerValue('Unknown:1')).toBeNull();
  expect(decodeOwnerValue('Character:')).toBeNull();
});

it('loads every owner type and exposes both flat and grouped picker options', async () => {
  const { result } = await renderHook(() => useGalleryOwnerOptions('story-1'));

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.options).toEqual([
    expect.objectContaining({ label: 'character: Ariane', value: 'Character:character-1' }),
    expect.objectContaining({ label: 'location: Farol', value: 'Location:location-1' }),
    expect.objectContaining({ label: 'note: unnamed', value: 'Note:note-1' }),
    expect.objectContaining({ label: 'scene: Prólogo', value: 'Scene:scene-1' }),
    expect.objectContaining({ label: 'item: Chave', value: 'Item:item-1' }),
  ]);
  expect(result.current.optionsByValue.get('Note:note-1')?.name).toBe('unnamed');
  expect(result.current.groupedOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'Character',
        options: [{ label: 'Ariane', value: 'Character:character-1' }],
      }),
      expect.objectContaining({
        key: 'Note',
        options: [{ label: 'unnamed', value: 'Note:note-1' }],
      }),
    ]),
  );
});

it('does not query before a story is selected and can recover with reload after an error', async () => {
  const missing = await renderHook(() => useGalleryOwnerOptions(undefined));
  expect(missing.result.current.options).toEqual([]);
  expect(db.select).not.toHaveBeenCalled();

  db.select.mockReset();
  db.select.mockImplementation(() => ({
    from: jest.fn(() => ({ where: jest.fn(() => Promise.reject(new Error('offline'))) })),
  }));
  const failed = await renderHook(() => useGalleryOwnerOptions('story-1'));
  await waitFor(() => expect(failed.result.current.loading).toBe(false));
  expect(failed.result.current.options).toEqual([]);

  db.select.mockReset();
  for (const row of rows) db.select.mockImplementationOnce(() => queryFor(row));
  await act(async () => failed.result.current.reload());
  expect(failed.result.current.options).toHaveLength(5);
});
