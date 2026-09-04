import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a relation between two Characters. */
export const characterRelationEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.CharacterRelation,
  conflictLabelKey: 'character_relation',
  isConflictRelation: true,
  help: {
    source: 'character-relationships',
    fields: ['relatedCharacter', 'relationType'],
  },
  referenceFields: {
    character1Id: OperationLogEntityType.Character,
    character2Id: OperationLogEntityType.Character,
  },
  advancedSearch: [
    searchField('relationType', 'field_relationType', 'string', {
      isSuggestion: true,
      suggestionsSource: 'characterRelation_type',
    }),
  ],
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.CharacterRelation, entityId);
    if (!row) return { name: undefined, type: context.translate('character_relation') };
    const [first, second] = await Promise.all([
      context.read(
        OperationLogEntityType.Character,
        typeof row.character1Id === 'string' ? row.character1Id : '',
      ),
      context.read(
        OperationLogEntityType.Character,
        typeof row.character2Id === 'string' ? row.character2Id : '',
      ),
    ]);
    return {
      name: `${nameOf(first) ?? context.translate('unknown_character')} - ${nameOf(second) ?? context.translate('unknown_character')} ${context.translate('relation')}`,
      type: context.translate('character_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await characterRelationEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
