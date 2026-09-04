import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const locationMapEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.LocationMap,
  displayField: 'name',
});
