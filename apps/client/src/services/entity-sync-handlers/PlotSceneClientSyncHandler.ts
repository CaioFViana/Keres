import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies PlotScene operations received from the server to the local table. */
export class PlotSceneClientSyncHandler extends TableClientSyncHandler<typeof schema.plotScenes> {
  readonly entityName = 'PlotScene';
  protected readonly table = schema.plotScenes;
}
