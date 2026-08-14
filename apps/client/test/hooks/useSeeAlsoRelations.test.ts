/** @jest-environment node */
jest.mock('../../src/db', () => ({ useDrizzle: jest.fn() }));
jest.mock('../../src/state/userSettingsStore', () => ({ useUserSettingsStore: jest.fn() }));
jest.mock('../../src/services/storymanagement/SeeAlsoRelationService', () => ({
  createSeeAlsoRelationService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useSeeAlsoRelations } from '../../src/hooks/useSeeAlsoRelations';
import { createSeeAlsoRelationService } from '../../src/services/storymanagement/SeeAlsoRelationService';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';

const service = {
  getRelationsForEntity: jest.fn(),
  setSeeAlsoTargets: jest.fn(),
  removeSeeAlsoLink: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({});
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: 'user' });
  (createSeeAlsoRelationService as jest.Mock).mockReturnValue(service);
  service.getRelationsForEntity.mockResolvedValue([
    {
      id: 'link',
      entityAType: 'Character',
      entityAId: 'a',
      entityBType: 'Location',
      entityBId: 'b',
    },
  ]);
});

it('maps a stored relation to its other endpoint', async () => {
  const { result } = await renderHook(() => useSeeAlsoRelations('story', 'Character', 'a'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.relations).toEqual([
    { relationId: 'link', otherType: 'Location', otherId: 'b' },
  ]);
});

it('saves and removes links using the open user', async () => {
  const { result } = await renderHook(() => useSeeAlsoRelations('story', 'Character', 'a'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.save([{ entityType: 'Location', entityId: 'b' }] as never));
  await act(async () => result.current.remove('link'));
  expect(service.setSeeAlsoTargets).toHaveBeenCalledWith('user', 'story', 'Character', 'a', [
    { entityType: 'Location', entityId: 'b' },
  ]);
  expect(service.removeSeeAlsoLink).toHaveBeenCalledWith('user', 'link');
});
