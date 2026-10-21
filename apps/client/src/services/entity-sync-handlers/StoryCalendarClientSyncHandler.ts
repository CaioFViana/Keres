import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/**
 * Calendars arriving from a server.
 *
 * The definition travels as an object and is stored as one - the column is `mode: 'json'` for
 * exactly this reason, so nothing here has to serialise it by hand and risk double-encoding it.
 */
export class StoryCalendarClientSyncHandler extends TableClientSyncHandler<
  typeof schema.storyCalendars
> {
  readonly entityName = 'StoryCalendar';
  protected readonly table = schema.storyCalendars;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
    updateOnlyHeldRows: true,
  };
}
