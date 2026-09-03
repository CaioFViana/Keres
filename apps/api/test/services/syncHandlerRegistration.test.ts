import { describe, expect, it } from 'vitest';
import { OperationLogEntityType } from '@keres/shared';
import { SyncService } from '../../src/services/SyncService';

/**
 * A new client entity is dangerous when it reaches the server before a handler is registered:
 * the operation is silently represented as a sync conflict instead of being applied. Keep the
 * protocol vocabulary and the server's handler registry in lockstep.
 */
describe('SyncService handler registry', () => {
  it('registers a handler for every story-synchronized operation-log entity', () => {
    const expected = Object.values(OperationLogEntityType)
      .filter(
        (entity) =>
          entity !== OperationLogEntityType.User && entity !== OperationLogEntityType.OperationLog,
      )
      .sort();
    const registered = [...new SyncService().getEntityHandlers().keys()].sort();

    expect(registered).toEqual(expected);
  });
});
