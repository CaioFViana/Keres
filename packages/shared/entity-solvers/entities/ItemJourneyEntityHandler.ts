import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for an Item state change recorded at a Scene. */
export const itemJourneyEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.ItemJourney,
  conflictLabelKey: 'item_journey',
  isConflictRelation: true,
  help: {
    source: 'item-journeys',
    fields: ['itemId', 'sceneId', 'newCharacterOwnerId', 'newState', 'extraNotes'],
  },
  referenceFields: {
    itemId: OperationLogEntityType.Item,
    sceneId: OperationLogEntityType.Scene,
    newCharacterOwnerId: OperationLogEntityType.Character,
  },
  advancedSearch: [
    searchField('itemId', 'item', 'id'),
    searchField('sceneId', 'scene', 'id'),
    searchField('newCharacterOwnerId', 'new_character_owner', 'id'),
    searchField('newState', 'new_state', 'string', {
      isSuggestion: true,
      suggestionsSource: 'item_state',
    }),
    searchField('extraNotes', 'field_extraNotes'),
  ],
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.ItemJourney, entityId);
    if (!row) return { name: undefined, type: context.translate('item_journey') };
    const [item, scene] = await Promise.all([
      context.read(OperationLogEntityType.Item, typeof row.itemId === 'string' ? row.itemId : ''),
      context.read(
        OperationLogEntityType.Scene,
        typeof row.sceneId === 'string' ? row.sceneId : '',
      ),
    ]);
    return {
      name: `${nameOf(item) ?? (await context.unknownNoun(OperationLogEntityType.Item))} ${context.translate('showed_in_scene')} ${nameOf(scene) ?? (await context.unknownNoun(OperationLogEntityType.Scene))}`,
      type: context.translate('item_journey'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await itemJourneyEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
