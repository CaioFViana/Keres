import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Scene and the story entities its editable fields refer to. */
export const sceneEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Scene,
  help: {
    source: 'scenes',
    fields: [
      'name',
      'summary',
      'chapterId',
      'locationId',
      'isStart',
      'isFinish',
      'gap',
      'duration',
      'isFavorite',
      'extraNotes',
    ],
  },
  referenceFields: {
    chapterId: OperationLogEntityType.Chapter,
    locationId: OperationLogEntityType.Location,
    calendarDateOverrideCalendarId: OperationLogEntityType.StoryCalendar,
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
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Scene, entityId);
    return {
      name: nameOf(row),
      type: await context.noun(OperationLogEntityType.Scene),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await sceneEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
