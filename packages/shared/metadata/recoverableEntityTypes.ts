import { OperationLogEntityType } from './OperationLogEntityType';

/**
 * Entity types that soft-delete via sync handlers and can be restored from the admin
 * recovery panel. Excludes `User` / `OperationLog`, which appear in the operation-log
 * enum but are not tombstoned through SyncService handlers.
 *
 * Keep in sync with `apps/api` entity-sync-handlers `entityName` values.
 */
const NON_RECOVERABLE = new Set<string>([
  OperationLogEntityType.User,
  OperationLogEntityType.OperationLog,
]);

export const RECOVERABLE_ENTITY_TYPES: readonly string[] = (
  Object.values(OperationLogEntityType) as string[]
)
  .filter((entityType) => !NON_RECOVERABLE.has(entityType))
  .sort();
