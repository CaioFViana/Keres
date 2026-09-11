/** @jest-environment node */
import { getEntityDomainHandler, OperationLogEntityType } from '@keres/shared';

/**
 * Sync accepts all declared operation types, so each one needs entity-owned presentation. This
 * executes the registry rather than coupling the safeguard to a particular file layout.
 */
describe('operation-log resolver coverage', () => {
  it('registers a presentation handler for every declared operation-log entity type', () => {
    for (const entityType of Object.values(OperationLogEntityType)) {
      const handler = getEntityDomainHandler(entityType);
      expect(handler).toBeDefined();
      expect(handler?.resolveReference).toBeDefined();
      expect(handler?.resolveOperationLogName).toBeDefined();
    }
  });
});
