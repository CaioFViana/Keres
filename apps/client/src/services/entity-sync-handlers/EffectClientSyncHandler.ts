import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Effect operations received from the server to the local table. */
export class EffectClientSyncHandler extends TableClientSyncHandler<typeof schema.effects> {
  readonly entityName = 'Effect';
  protected readonly table = schema.effects;
}
