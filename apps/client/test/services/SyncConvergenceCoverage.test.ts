/** @jest-environment node */
import { OperationLogEntityType } from '@keres/shared';
import { MODELLED_ENTITY_TYPES } from '@/test/helpers/syncDevices';

/**
 * The convergence fuzz only vouches for the kinds of row it makes. A new synced type that nobody
 * added to it (songs, sketches, pages and music went unfuzzed for a while) is the one place a sync
 * bug can sit unseen - so adding a type to the app means adding it to the fuzz, or saying here why not.
 */

/** Rows the sync never carries as an entity of a story: the account, and the log itself. */
const NOT_SYNCED_AS_ROWS = new Set<string>([
  OperationLogEntityType.User,
  OperationLogEntityType.OperationLog,
  // The story row itself is modelled apart from the others (`Story` is the fuzz's own subject).
  OperationLogEntityType.Story,
]);

describe('the convergence fuzz covers every synced entity type', () => {
  it('models each type the operation log can carry', () => {
    const synced = Object.values(OperationLogEntityType)
      .filter((type) => !NOT_SYNCED_AS_ROWS.has(type))
      .sort();

    expect([...MODELLED_ENTITY_TYPES].sort()).toEqual(synced);
  });
});
