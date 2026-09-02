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
import { useBoardPinOptions } from '../../src/hooks/useBoardPinOptions';
import { loadEntityOptions } from '../../src/utils/entityOptions';

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
