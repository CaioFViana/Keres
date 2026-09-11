import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

async function resolveChapterReference(
  context: Parameters<NonNullable<EntityDomainHandler['resolveReference']>>[0],
  entityId: string,
) {
  const row = await context.read(OperationLogEntityType.Chapter, entityId);
  const type =
    row?.type === 'event'
      ? await context.noun('Event')
      : await context.noun(OperationLogEntityType.Chapter);
  return { name: nameOf(row), type };
}

/** All presentation metadata that belongs specifically to a narrative Chapter. */
export const chapterEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Chapter,
  exportCollection: 'chapters',
  exportReferences: [
    { field: 'arcId', targetEntityType: OperationLogEntityType.StoryArc, required: false },
  ],
  conflictLabelKey: 'chapter',
  displayName: displayField('name'),
  help: {
    source: 'chapters',
    fields: ['name', 'summary', 'order', 'arcId', 'isFavorite', 'extraNotes'],
  },
  referenceFields: {
    arcId: OperationLogEntityType.StoryArc,
  },
  advancedSearch: [
    searchField('name', 'field_name'),
    searchField('summary', 'summary'),
    searchField('isFavorite', 'field_isFavorite', 'boolean'),
    searchField('extraNotes', 'field_extraNotes'),
  ],
  summarizePreview(row) {
    return {
      title: nameOf(row) ?? '',
      primaryDetail: typeof row.summary === 'string' ? row.summary : null,
      secondaryDetail: typeof row.extraNotes === 'string' ? row.extraNotes : null,
    };
  },
  resolveReference: resolveChapterReference,
  async resolveOperationLogName(context, entityId) {
    const reference = await resolveChapterReference(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
