import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const boardEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Board,
  exportCollection: 'storyBoards',
  conflictLabelKey: 'board',
  displayField: 'name',
  previewDetailsFields: ['description'],
  help: { source: 'boards', fields: ['name', 'description'] },
  advancedSearch: [
    searchField('name', 'field_name'),
    searchField('description', 'field_description'),
  ],
});
