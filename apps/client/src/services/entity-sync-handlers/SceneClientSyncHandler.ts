import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Scene operations received from the server to the local table. */
export class SceneClientSyncHandler extends TableClientSyncHandler<typeof schema.scenes> {
  readonly entityName = 'Scene';
  protected readonly table = schema.scenes;
}
