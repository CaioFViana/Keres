import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveCompactEntityLabel } from '../compactEntityName';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Character Mode. */
export const modeEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Mode,
  exportCollection: 'modes',
  exportReferences: [
    { field: 'characterId', targetEntityType: OperationLogEntityType.Character, required: true },
  ],
  conflictLabelKey: 'mode',
  displayName: displayField('name'),
  help: {
    source: 'character-modes',
    fields: ['name', 'modeChanges'],
  },
  referenceFields: {
    characterId: OperationLogEntityType.Character,
  },
  advancedSearch: [
    searchField('name', 'field_name'),
    searchField('modeChanges', 'field_modeChanges'),
  ],
  async resolveCompactName(context, entityId) {
    const row = await context.read(OperationLogEntityType.Mode, entityId);
    if (!row) return undefined;
    const character = await resolveCompactEntityLabel(
      context,
      OperationLogEntityType.Character,
      typeof row.characterId === 'string' ? row.characterId : '',
    );
    return nameOf(row) ? `${character} · ${nameOf(row)}` : character;
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Mode, entityId);
    if (!row) return { name: undefined, type: context.translate('mode') };
    const owner = await context.read(
      OperationLogEntityType.Character,
      typeof row.characterId === 'string' ? row.characterId : '',
    );
    return {
      name: context.translate('mode_of_character', {
        modename: nameOf(row) ?? '',
        charactername: nameOf(owner) ?? context.translate('unknown_character'),
      }),
      type: context.translate('mode'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await modeEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
