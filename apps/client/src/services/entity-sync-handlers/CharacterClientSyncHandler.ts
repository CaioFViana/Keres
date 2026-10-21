import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Character operations received from the server to the local table. */
export class CharacterClientSyncHandler extends TableClientSyncHandler<typeof schema.characters> {
  readonly entityName = 'Character';
  protected readonly table = schema.characters;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
  };
}
