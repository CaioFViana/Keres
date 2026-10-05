import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const sketchEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Sketch,
  exportCollection: 'storySketches',
  conflictLabelKey: 'sketch',
  displayField: 'name',
  previewDetailsFields: ['description'],
  help: { source: 'sketch', fields: ['name', 'description'] },
  advancedSearch: [
    searchField('name', 'field_name'),
    searchField('description', 'field_description'),
  ],
});
