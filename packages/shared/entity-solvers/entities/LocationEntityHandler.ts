import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const locationEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Location,
  exportCollection: 'locations',
  conflictLabelKey: 'location',
  displayField: 'name',
  previewDetailsFields: ['description'],
  help: {
    source: 'locations',
    fields: ['name', 'description', 'climate', 'culture', 'politics', 'isFavorite', 'extraNotes'],
  },
  advancedSearch: [
    searchField('name', 'field_name'),
    searchField('description', 'field_description'),
    searchField('climate', 'field_climate'),
    searchField('culture', 'field_culture'),
    searchField('politics', 'field_politics'),
    searchField('isFavorite', 'field_isFavorite', 'boolean'),
    searchField('extraNotes', 'field_extraNotes'),
  ],
});
