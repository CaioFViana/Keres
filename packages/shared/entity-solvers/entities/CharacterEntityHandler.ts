import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Character. */
export const characterEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Character,
  conflictLabelKey: 'character',
  displayName: displayField('name'),
  help: {
    source: 'characters',
    fields: [
      'name',
      'title',
      'description',
      'gender',
      'race',
      'subrace',
      'personality',
      'motivation',
      'qualities',
      'weaknesses',
      'biography',
      'plannedTimeline',
      'isFavorite',
      'extraNotes',
      'relationType',
    ],
  },
  advancedSearch: [
    searchField('name', 'field_name'),
    searchField('title', 'field_title'),
    searchField('gender', 'field_gender', 'string', {
      isSuggestion: true,
      suggestionsSource: 'character_gender',
    }),
    searchField('race', 'field_race', 'string', {
      isSuggestion: true,
      suggestionsSource: 'character_race',
    }),
    searchField('subrace', 'field_subrace', 'string', {
      isSuggestion: true,
      suggestionsSource: 'character_subrace',
    }),
    searchField('description', 'field_description'),
    searchField('personality', 'field_personality'),
    searchField('motivation', 'field_motivation'),
    searchField('qualities', 'field_qualities'),
    searchField('weaknesses', 'field_weaknesses'),
    searchField('biography', 'field_biography'),
    searchField('plannedTimeline', 'field_plannedTimeline'),
    searchField('isFavorite', 'field_isFavorite', 'boolean'),
    searchField('extraNotes', 'field_extraNotes'),
    searchField('relationType', 'field_relationType', 'string', {
      isSuggestion: true,
      suggestionsSource: 'characterRelation_type',
    }),
  ],
  summarizePreview(row) {
    return {
      title: nameOf(row) ?? '',
      primaryDetail: typeof row.description === 'string' ? row.description : null,
      secondaryDetail: null,
    };
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Character, entityId);
    return { name: nameOf(row), type: await context.noun(OperationLogEntityType.Character) };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await characterEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
