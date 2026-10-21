import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies ChoiceCheck operations received from the server to the local table. */
export class ChoiceCheckClientSyncHandler extends TableClientSyncHandler<
  typeof schema.choiceChecks
> {
  readonly entityName = 'ChoiceCheck';
  protected readonly table = schema.choiceChecks;
}
