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
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const service = {
  getRelationsForEntity: jest.fn(),
  setSeeAlsoTargets: jest.fn(),
  addSeeAlsoLink: jest.fn(),
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

it('stays empty when there is nothing to load, and clears on a load failure', async () => {
  const { result } = await renderHook(() => useSeeAlsoRelations('story', 'Character', undefined));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.relations).toEqual([]);

  jest.spyOn(console, 'error').mockImplementation(() => {});
  service.getRelationsForEntity.mockRejectedValueOnce(new Error('boom'));
  const { result: failed } = await renderHook(() => useSeeAlsoRelations('story', 'Character', 'a'));
  await waitFor(() => expect(failed.current.loading).toBe(false));
  expect(failed.current.relations).toEqual([]);
  expect(console.error).toHaveBeenCalledWith(
    'Failed to load See Also relations for Character a:',
    expect.any(Error),
  );
  (console.error as jest.Mock).mockRestore();
});

it('reloads when either side of a link changes, and ignores other stories', async () => {
  const { result } = await renderHook(() => useSeeAlsoRelations('story', 'Character', 'a'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  const calls = service.getRelationsForEntity.mock.calls.length;

  await act(async () => {
    entityEventEmitter.emit('see_also_relation_changed', 'story', 'a');
  });
  await act(async () => {
    entityEventEmitter.emit('see_also_relation_changed', 'other-story', 'a');
  });

  expect(service.getRelationsForEntity.mock.calls.length).toBe(calls + 1);
});

it('reconciles only its own subset, leaving the other manager links alone', async () => {
  service.getRelationsForEntity.mockResolvedValue([
    {
      id: 'link-location',
      entityAType: 'Character',
      entityAId: 'a',
      entityBType: 'Location',
      entityBId: 'old',
    },
    {
      id: 'link-item',
      entityAType: 'Character',
      entityAId: 'a',
      entityBType: 'Item',
      entityBId: 'kept',
    },
  ]);
  const { result } = await renderHook(() =>
    useSeeAlsoRelations('story', 'Character', 'a', ['Location']),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  // The item link belongs to another manager: filtered from what this one shows.
  expect(result.current.relations).toEqual([
    { relationId: 'link-location', otherType: 'Location', otherId: 'old' },
  ]);

  await act(async () =>
    result.current.save([
      { entityType: 'Location', entityId: 'new' },
      { entityType: 'Item', entityId: 'intruder' },
    ] as never),
  );

  // The intruder is filtered before the write; the old location link is removed, the new one
  // added, and the item link is never touched.
  expect(service.addSeeAlsoLink).toHaveBeenCalledWith(
    'user',
    'story',
    { entityType: 'Character', entityId: 'a' },
    { entityType: 'Location', entityId: 'new' },
  );
  expect(service.removeSeeAlsoLink).toHaveBeenCalledWith('user', 'link-location');
  expect(service.setSeeAlsoTargets).not.toHaveBeenCalled();
});

it('holds the chosen targets until the entity exists, then persists them', async () => {
  const { result } = await renderHook(() => useSeeAlsoRelations('story', 'Character', undefined));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () =>
    result.current.save([
      { entityType: 'Location', entityId: 'b' },
      { entityType: 'Location', entityId: 'c' },
    ] as never),
  );
  expect(result.current.relations).toEqual([
    { relationId: 'pending:Location:b', otherType: 'Location', otherId: 'b' },
    { relationId: 'pending:Location:c', otherType: 'Location', otherId: 'c' },
  ]);
  expect(service.setSeeAlsoTargets).not.toHaveBeenCalled();

  await act(async () => result.current.remove('pending:Location:b'));
  expect(result.current.relations).toEqual([
    { relationId: 'pending:Location:c', otherType: 'Location', otherId: 'c' },
  ]);

  await act(async () => result.current.persistSeeAlsoRelations('real-id'));
  expect(service.setSeeAlsoTargets).toHaveBeenCalledWith('user', 'story', 'Character', 'real-id', [
    { entityType: 'Location', entityId: 'c' },
  ]);
  // Persisting twice writes once: the pending set is consumed.
  await act(async () => result.current.persistSeeAlsoRelations('real-id'));
  expect(service.setSeeAlsoTargets).toHaveBeenCalledTimes(1);
});

it('persists a scoped pending set through the subset reconciliation', async () => {
  service.getRelationsForEntity.mockResolvedValue([]);
  const { result } = await renderHook(() =>
    useSeeAlsoRelations('story', 'Character', undefined, ['Location']),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => result.current.save([{ entityType: 'Location', entityId: 'b' }] as never));
  await act(async () => result.current.persistSeeAlsoRelations('real-id'));

  expect(service.addSeeAlsoLink).toHaveBeenCalledWith(
    'user',
    'story',
    { entityType: 'Character', entityId: 'real-id' },
    { entityType: 'Location', entityId: 'b' },
  );
});
