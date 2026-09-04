import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const statEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Stat,
  displayField: 'name',
  help: { source: 'stats', fields: ['name', 'isPrimary'] },
});
