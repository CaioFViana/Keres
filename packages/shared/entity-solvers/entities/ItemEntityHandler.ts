import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for an Item and its optional character owner. */
export const itemEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Item,
  exportCollection: 'items',
  exportReferences: [
    {
      field: 'characterOwnerId',
      targetEntityType: OperationLogEntityType.Character,
      required: false,
    },
  ],
  conflictLabelKey: 'item',
  displayName: displayField('name'),
  help: {
    source: 'items',
    fields: [
      'name',
      'category',
      'description',
      'initialState',
      'characterOwnerId',
      'isFavorite',
      'extraNotes',
    ],
  },
  referenceFields: {
    characterOwnerId: OperationLogEntityType.Character,
  },
  advancedSearch: [
    searchField('name', 'item_name'),
    searchField('category', 'category', 'string', {
      isSuggestion: true,
      suggestionsSource: 'item_category',
    }),
    searchField('description', 'field_description'),
    searchField('initialState', 'initial_state', 'string', {
      isSuggestion: true,
      suggestionsSource: 'item_initial_state',
    }),
    searchField('isFavorite', 'field_isFavorite', 'boolean'),
    searchField('extraNotes', 'field_extraNotes'),
  ],
  summarizePreview(row) {
    return {
      title: nameOf(row) ?? '',
      primaryDetail: typeof row.description === 'string' ? row.description : null,
      secondaryDetail: null,
    };
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Item, entityId);
    return { name: nameOf(row), type: await context.noun(OperationLogEntityType.Item) };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await itemEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
