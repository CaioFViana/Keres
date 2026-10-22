import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies CharacterScene operations received from the server to the local table. */
export class CharacterSceneClientSyncHandler extends TableClientSyncHandler<
  typeof schema.characterScenes
> {
  readonly entityName = 'CharacterScene';
  protected readonly table = schema.characterScenes;
}
