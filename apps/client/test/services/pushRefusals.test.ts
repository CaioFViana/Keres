/**
 * @jest-environment node
 */
import type { SyncConflict } from '@keres/shared';
import type { OperationLogSelect } from '@/src/db/schema';
import {
  createStillOnItsWay,
  inSettlingOrder,
  onlyMissingReference,
  waitingOperationIds,
} from '@/src/services/sync/pushRefusals';

const refusal = (reason: string, clientOperationId?: string): SyncConflict =>
  ({ reason, clientOperationId }) as unknown as SyncConflict;

describe('the order refusals settle in', () => {
  it('knows a group that waits only on references the server lacks', () => {
    expect(onlyMissingReference([refusal('referenced_entity_deleted')])).toBe(true);
    expect(
      onlyMissingReference([refusal('referenced_entity_deleted'), refusal('version_conflict')]),
    ).toBe(false);
  });

  it('puts the ordinary refusals before the ones waiting on a missing reference', () => {
    const missing = { group: [refusal('referenced_entity_deleted')], name: 'missing' };
    const ordinary = { group: [refusal('version_conflict')], name: 'ordinary' };

    expect(inSettlingOrder([missing, ordinary]).map((entry) => entry.name)).toEqual([
      'ordinary',
      'missing',
    ]);
  });
});

describe('the operations that wait', () => {
  it('lists the ones refused for a missing reference, skipping a refusal with no operation id', () => {
    const waiting = waitingOperationIds([
      refusal('referenced_entity_deleted', 'op-1'),
      refusal('referenced_entity_deleted'),
      refusal('version_conflict', 'op-2'),
    ]);

    expect([...waiting]).toEqual(['op-1']);
  });
});

describe('a create that may still be on its way', () => {
  const operation = (over: Partial<OperationLogSelect>): OperationLogSelect =>
    ({
      id: 'op',
      operationType: 'create',
      entityType: 'Chapter',
      entityId: 'c1',
      ...over,
    }) as never;

  it('is none when the push sent no other create: nothing is looked up', async () => {
    const db = { select: jest.fn() } as never;

    await expect(
      createStillOnItsWay(
        db,
        [
          operation({ id: 'update', operationType: 'update' }),
          operation({ id: 'same', entityId: 'c1' }),
          operation({ id: 'waiting', entityId: 'c2' }),
        ],
        'Chapter',
        'c1',
        new Set(['waiting']),
      ),
    ).resolves.toBe(false);
    expect((db as unknown as { select: jest.Mock }).select).not.toHaveBeenCalled();
  });
});
