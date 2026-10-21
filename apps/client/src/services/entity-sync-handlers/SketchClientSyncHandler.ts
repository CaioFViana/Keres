import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/**
 * Sketches arriving from a server. `content` travels as an object and is stored as one.
 */
export class SketchClientSyncHandler extends TableClientSyncHandler<typeof schema.sketches> {
  readonly entityName = 'Sketch';
  protected readonly table = schema.sketches;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
    updateOnlyHeldRows: true,
  };
}
