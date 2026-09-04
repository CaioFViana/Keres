import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { suggestionDisplayValue } from '../../metadata/entityDisplayName';
import type { EntityDomainHandler } from './contracts';

/** Presentation metadata for a reusable suggestion value. */
export const suggestionEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Suggestion,
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Suggestion, entityId);
    return {
      name: suggestionDisplayValue(row?.value) ?? undefined,
      type: context.translate('suggestion'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await suggestionEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
