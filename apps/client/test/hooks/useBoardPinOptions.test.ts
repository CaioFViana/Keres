/** @jest-environment node */
jest.mock('../../src/db', () => ({
  __esModule: true,
  useDrizzle: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/utils/entityOptions', () => ({
  __esModule: true,
  loadEntityOptions: jest.fn(),
}));
jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ term: (entityType: string) => entityType }),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import type { MultiSelectGroup } from '../../src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../../src/db';
import {
  decodeBoardPinValue,
  encodeBoardPinValue,
  useBoardPinOptions,
} from '../../src/hooks/useBoardPinOptions';
import { loadEntityOptions } from '../../src/utils/entityOptions';

const selectReturning = (...results: unknown[][]) => {
  const all = jest.fn();
  for (const rows of results) all.mockResolvedValueOnce(rows);
  return jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ all })) })) }));
};

beforeEach(() => {
  jest.clearAllMocks();
  const all = jest
    .fn()
    .mockResolvedValueOnce([
      { id: 'rule-1', name: 'Magic has a cost', section: 'rule' },
      { id: 'fauna-1', name: 'Sky whale', section: 'fauna' },
    ])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  (useDrizzle as jest.Mock).mockReturnValue({
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: jest.fn(() => ({ all })) })),
    })),
  });
  (loadEntityOptions as jest.Mock).mockResolvedValue([]);
});

it('separates World Pieces into their sections in the board picker', async () => {
  const { result } = await renderHook(() => useBoardPinOptions('story-1'));

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(loadEntityOptions).not.toHaveBeenCalledWith(expect.anything(), 'story-1', 'WorldRule');
  expect(result.current.groupedOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'worldrule:rule',
        label: 'world_piece_section_rule',
        options: [
          expect.objectContaining({ label: 'Magic has a cost', value: 'WorldRule:rule-1' }),
        ],
      }),
      expect.objectContaining({
        key: 'worldrule:fauna',
        label: 'world_piece_section_fauna',
        options: [expect.objectContaining({ label: 'Sky whale', value: 'WorldRule:fauna-1' })],
      }),
    ]),
  );
  expect(
    result.current.groupedOptions.some((group: MultiSelectGroup) => group.key === 'worldrule'),
  ).toBe(false);
});

it('round-trips pin values and rejects values without a separator', () => {
  expect(encodeBoardPinValue('Scene', 'scene-1')).toBe('Scene:scene-1');
  expect(decodeBoardPinValue('Scene:scene-1')).toEqual({
    entityType: 'Scene',
    entityId: 'scene-1',
  });
  expect(decodeBoardPinValue('no-separator')).toBeNull();
});

it('returns no options without a story and clears options when loading fails', async () => {
  const empty = await renderHook(() => useBoardPinOptions(undefined));
  expect(empty.result.current).toMatchObject({ options: [], loading: false });

  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  (loadEntityOptions as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const failing = await renderHook(() => useBoardPinOptions('story-1'));
  await waitFor(() =>
    expect(console.log).toHaveBeenCalledWith(
      'useBoardPinOptions: failed to load pin candidates.',
      expect.any(Error),
    ),
  );
  await waitFor(() => expect(failing.result.current.loading).toBe(false));
  expect(failing.result.current.options).toEqual([]);
});

it('lists every pinnable entity, splits events, and excludes the current board', async () => {
  (loadEntityOptions as jest.Mock).mockImplementation(
    async (_db: unknown, _story: string, entityType: string) => [
      { id: `${entityType}-1`, name: `${entityType} one` },
    ],
  );
  (useDrizzle as jest.Mock).mockReturnValue({
    select: selectReturning(
      [],
      [
        { id: 'gallery-1', title: null, fileName: 'scan.png' },
        { id: 'gallery-2', title: 'Map', fileName: 'map.png' },
      ],
      [
        { id: 'chapter-1', name: 'Opening', type: 'chapter' },
        { id: 'event-1', name: 'Festival', type: 'event' },
      ],
      [
        { id: 'board-0', name: 'Current' },
        { id: 'board-1', name: 'Other' },
      ],
    ),
  });
  const { result } = await renderHook(() => useBoardPinOptions('story-1', 'board-0'));

  await waitFor(() => expect(result.current.options.length).toBeGreaterThan(0));
  await waitFor(() => expect(result.current.loading).toBe(false));

  const byKey = Object.fromEntries(
    result.current.groupedOptions.map((group) => [group.key, group.options]),
  );
  expect(byKey.character).toEqual([{ label: 'Character one', value: 'Character:Character-1' }]);
  expect(byKey.location).toEqual([{ label: 'Location one', value: 'Location:Location-1' }]);
  expect(byKey.note).toEqual([{ label: 'Note one', value: 'Note:Note-1' }]);
  expect(byKey.scene).toEqual([{ label: 'Scene one', value: 'Scene:Scene-1' }]);
  expect(byKey.item).toEqual([{ label: 'Item one', value: 'Item:Item-1' }]);
  expect(byKey.gallery).toEqual([
    { label: 'scan.png', value: 'Gallery:gallery-1' },
    { label: 'Map', value: 'Gallery:gallery-2' },
  ]);
  expect(byKey.chapter).toEqual([{ label: 'Opening', value: 'Chapter:chapter-1' }]);
  expect(byKey.event).toEqual([{ label: 'Festival', value: 'Chapter:event-1' }]);
  expect(byKey.board).toEqual([{ label: 'Other', value: 'Board:board-1' }]);
});
