import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

/** Presentation metadata for an operation-log row referenced by another operation. */
export const operationLogEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.OperationLog,
  syncable: false,
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.OperationLog, entityId);
    const id = typeof row?.id === 'string' ? row.id : entityId;
    return {
      name: `${context.translate('operation_logs_title')} ${context.translate('id')}: ${id}`,
      type: context.translate('operation_log'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await operationLogEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
