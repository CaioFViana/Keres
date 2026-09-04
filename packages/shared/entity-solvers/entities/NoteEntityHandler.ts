import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const noteEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Note,
  exportCollection: 'notes',
  conflictLabelKey: 'note',
  displayField: 'title',
  previewDetailsFields: ['body'],
  help: { source: 'notes', fields: ['title', 'body', 'isFavorite', 'extraNotes'] },
  advancedSearch: [
    searchField('title', 'field_title'),
    searchField('body', 'field_body'),
    searchField('extraNotes', 'field_extraNotes'),
    searchField('isFavorite', 'field_isFavorite', 'boolean'),
  ],
});
