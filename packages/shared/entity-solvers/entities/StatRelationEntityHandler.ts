import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const numberValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'number' ? value : undefined;
};

/** Presentation metadata for a character's current value of a Stat. */
export const statRelationEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.StatRelation,
  help: { source: 'stats', fields: ['value'] },
  referenceFields: {
    statId: OperationLogEntityType.Stat,
    characterId: OperationLogEntityType.Character,
    modeId: OperationLogEntityType.Mode,
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.StatRelation, entityId);
    if (!row) return { name: undefined, type: context.translate('stat_relation') };
    const [stat, owner, mode] = await Promise.all([
      context.read(OperationLogEntityType.Stat, stringValue(row, 'statId') ?? ''),
      context.read(OperationLogEntityType.Character, stringValue(row, 'characterId') ?? ''),
      stringValue(row, 'modeId')
        ? context.read(OperationLogEntityType.Mode, stringValue(row, 'modeId')!)
        : undefined,
    ]);
    const ownerName = stringValue(mode, 'name')
      ? `${stringValue(owner, 'name') ?? context.translate('unknown_character')} · ${stringValue(mode, 'name')}`
      : (stringValue(owner, 'name') ?? context.translate('unknown_character'));
    return {
      name: `${context.translate('stat_value_of_entity', {
        statname: stringValue(stat, 'name') ?? context.translate('unknown_stat'),
        entityname: ownerName,
      })}: ${numberValue(row, 'value') ?? ''}`,
      type: context.translate('stat_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await statRelationEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
