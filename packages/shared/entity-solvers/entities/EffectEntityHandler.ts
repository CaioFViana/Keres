import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const effectTypeLabelKeys: Readonly<Record<string, string>> = {
  itemGrant: 'effect_item_grant',
  itemTake: 'effect_item_take',
  triggerSet: 'effect_trigger_set',
  triggerUnset: 'effect_trigger_unset',
};

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for an effect applied by a choice. */
export const effectEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Effect,
  referenceFields: { itemId: OperationLogEntityType.Item },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Effect, entityId);
    if (!row) return { name: undefined, type: context.translate('effect') };
    const effectType = stringValue(row, 'effectType') ?? '';
    const item = await context.read(OperationLogEntityType.Item, stringValue(row, 'itemId') ?? '');
    const target =
      effectType === 'itemGrant' || effectType === 'itemTake'
        ? (stringValue(item, 'name') ?? context.translate('unknown_item'))
        : (stringValue(row, 'triggerName') ?? context.translate('unknown_trigger'));
    return {
      name: `${context.translate(effectTypeLabelKeys[effectType] ?? effectType)}: ${target}`,
      type: context.translate('effect'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await effectEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
