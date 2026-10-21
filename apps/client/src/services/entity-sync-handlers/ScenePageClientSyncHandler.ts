import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies ScenePage operations received from the server to the local table. */
export class ScenePageClientSyncHandler extends TableClientSyncHandler<typeof schema.scenePages> {
  readonly entityName = 'ScenePage';
  protected readonly table = schema.scenePages;
}
