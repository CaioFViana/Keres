import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';
export const storyEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.Story,
  conflictLabelKey: 'story',
  displayField: 'title',
  help: {
    source: 'create-story',
    fields: [
      'title',
      'type',
      'description',
      'genre',
      'author',
      'language',
      'isFavorite',
      'extraNotes',
      'theme',
    ],
  },
});
