import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const numberValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'number' ? value : undefined;
};

/** Presentation metadata for a value tier on a Stat ladder. */
export const statStrengthEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.StatStrength,
  conflictLabelKey: 'stat_strength',
  displayName: displayField('label'),
  help: { source: 'stats', fields: ['label', 'minValue'] },
  referenceFields: { statId: OperationLogEntityType.Stat },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.StatStrength, entityId);
    if (!row) return { name: undefined, type: context.translate('stat_strength') };
    const statId = stringValue(row, 'statId');
    const stat = statId ? await context.read(OperationLogEntityType.Stat, statId) : undefined;
    const ladder = statId
      ? context.translate('stat_ladder_of_stat', {
          statname: stringValue(stat, 'name') ?? context.translate('unknown_stat'),
        })
      : context.translate('stat_ladder_story_default');
    return {
      name: `${ladder} - ${stringValue(row, 'label') ?? ''} (${numberValue(row, 'minValue') ?? ''})`,
      type: context.translate('stat_strength'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await statStrengthEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
