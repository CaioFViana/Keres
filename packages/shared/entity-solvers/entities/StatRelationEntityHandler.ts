import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveCompactEntityLabel } from '../compactEntityName';
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
  exportCollection: 'statRelations',
  exportReferences: [
    { field: 'characterId', targetEntityType: OperationLogEntityType.Character, required: true },
    { field: 'statId', targetEntityType: OperationLogEntityType.Stat, required: true },
    { field: 'modeId', targetEntityType: OperationLogEntityType.Mode, required: false },
  ],
  conflictLabelKey: 'stat_relation',
  isConflictRelation: true,
  help: { source: 'stats', fields: ['value'] },
  referenceFields: {
    statId: OperationLogEntityType.Stat,
    characterId: OperationLogEntityType.Character,
    modeId: OperationLogEntityType.Mode,
  },
  summarizeConflictRelation(row, context) {
    const character = context.nameOf(OperationLogEntityType.Character, row.characterId);
    const owner = row.modeId
      ? `${character} · ${context.nameOf(OperationLogEntityType.Mode, row.modeId)}`
      : character;
    const value = row.value ?? context.unknown;
    return {
      title: context.translate('stat_relation'),
      detail: `${owner} - ${context.nameOf(OperationLogEntityType.Stat, row.statId)}: ${value}`,
    };
  },
  async resolveCompactName(context, entityId) {
    const row = await context.read(OperationLogEntityType.StatRelation, entityId);
    if (!row) return undefined;
    const [character, stat] = await Promise.all([
      resolveCompactEntityLabel(
        context,
        OperationLogEntityType.Character,
        stringValue(row, 'characterId') ?? '',
      ),
      resolveCompactEntityLabel(
        context,
        OperationLogEntityType.Stat,
        stringValue(row, 'statId') ?? '',
      ),
    ]);
    const modeId = stringValue(row, 'modeId');
    const mode = modeId ? await context.read(OperationLogEntityType.Mode, modeId) : undefined;
    const owner = modeId
      ? `${character} · ${stringValue(mode, 'name') ?? modeId.slice(0, 8)}`
      : character;
    return `${owner} · ${stat} = ${numberValue(row, 'value') ?? '?'}`;
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
