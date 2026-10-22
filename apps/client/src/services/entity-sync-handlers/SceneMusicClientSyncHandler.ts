import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies SceneMusic operations received from the server to the local table. */
export class SceneMusicClientSyncHandler extends TableClientSyncHandler<typeof schema.sceneMusic> {
  readonly entityName = 'SceneMusic';
  protected readonly table = schema.sceneMusic;
}
