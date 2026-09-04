import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const tagEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Tag,
  displayField: 'name',
  previewDetailsFields: ['extraNotes'],
  help: { source: 'tags', fields: ['name', 'color', 'extraNotes', 'isFavorite'] },
  advancedSearch: [
    searchField('name', 'field_name'),
    searchField('color', 'field_color', 'color'),
    searchField('extraNotes', 'field_extraNotes'),
    searchField('isFavorite', 'field_isFavorite', 'boolean'),
  ],
});
