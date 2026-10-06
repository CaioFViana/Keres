import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';

/** One page (or frame) of a scene: an image and the text that goes with it. */
export const scenePageEntityHandler = createSimpleEntityHandler({
  entityType: OperationLogEntityType.ScenePage,
  exportCollection: 'scenePages',
  conflictLabelKey: 'scene_page',
  displayField: 'text',
  previewDetailsFields: ['text'],
  help: { source: 'scene-pages', fields: ['text', 'fit'] },
  exportReferences: [
    { field: 'sceneId', targetEntityType: OperationLogEntityType.Scene, required: true },
    // The image may be gone while the page and its text stay: the references are optional.
    { field: 'sketchId', targetEntityType: OperationLogEntityType.Sketch, required: false },
    { field: 'galleryId', targetEntityType: OperationLogEntityType.Gallery, required: false },
  ],
});
