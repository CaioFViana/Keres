import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { nonSearchableField, searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';
export const worldRuleEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.WorldRule,
  conflictLabelKey: 'world_rule',
  displayName: displayField('title'),
  help: {
    source: 'world-rules',
    fields: [
      'title',
      'section',
      'type',
      'description',
      'category',
      'behavior',
      'usability',
      'danger',
      'isFavorite',
      'extraNotes',
    ],
  },
  advancedSearch: [
    searchField('title', 'field_title'),
    searchField('description', 'field_description'),
    nonSearchableField('section', 'world_piece_section'),
    searchField('type', 'world_piece_type'),
    searchField('category', 'category'),
    searchField('behavior', 'world_piece_behavior'),
    searchField('usability', 'world_piece_usability'),
    searchField('danger', 'world_piece_danger'),
    searchField('isFavorite', 'field_isFavorite', 'boolean'),
    searchField('extraNotes', 'field_extraNotes'),
  ],
  summarizePreview(row) {
    return {
      title: typeof row.title === 'string' ? row.title : '',
      primaryDetail: typeof row.description === 'string' ? row.description : null,
      secondaryDetail: null,
    };
  },
  async resolveReference(context, id) {
    const row = await context.read(OperationLogEntityType.WorldRule, id);
    const name = typeof row?.title === 'string' && row.title.trim() ? row.title : undefined;
    const section =
      typeof row?.section === 'string' && row.section.trim() ? row.section : undefined;
    return {
      name,
      type: section
        ? context.translate(`world_piece_section_${section}`)
        : await context.noun(OperationLogEntityType.WorldRule),
    };
  },
  async resolveOperationLogName(context, id) {
    const reference = await this.resolveReference!(context, id);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
