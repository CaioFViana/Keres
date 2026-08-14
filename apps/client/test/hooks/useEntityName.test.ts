/** @jest-environment node */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});
jest.mock('../../src/services/EntityService', () => ({
  __esModule: true,
  EntityService: { getEntityName: jest.fn() },
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { OperationLogEntityType } from '@keres/shared';
import { useDrizzle } from '../../src/db';
import { useEntityName } from '../../src/hooks/useEntityName';
import { EntityService } from '../../src/services/EntityService';

const db = { marker: 'db' };
const getEntityName = EntityService.getEntityName as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue(db);
  getEntityName.mockResolvedValue('Ariane');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('resolves the visible name through EntityService and ends loading', async () => {
  const { result } = await renderHook(() =>
    useEntityName(OperationLogEntityType.Character, 'character-1', 'story-1'),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.entityName).toBe('Ariane');
  expect(getEntityName).toHaveBeenCalledWith(
    db,
    OperationLogEntityType.Character,
    'character-1',
    'story-1',
    expect.any(Function),
  );
});

it('does not query an entity that has not been saved into a story yet', async () => {
  const { result } = await renderHook(() =>
    useEntityName(OperationLogEntityType.Character, '', 'story-1'),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.entityName).toBeUndefined();
  expect(getEntityName).not.toHaveBeenCalled();
});

it('keeps the operation log safe when the lookup fails', async () => {
  getEntityName.mockRejectedValueOnce(new Error('database unavailable'));
  const { result } = await renderHook(() =>
    useEntityName(OperationLogEntityType.Character, 'character-1', 'story-1'),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.entityName).toBeUndefined();
});
