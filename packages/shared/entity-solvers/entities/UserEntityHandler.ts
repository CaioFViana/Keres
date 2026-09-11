import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';

/** Presentation metadata for the actor recorded in an operation log. */
export const userEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.User,
  syncable: false,
  displayField: 'displayName',
});
