import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StoryCalendar,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * Calendars arriving from a server.
 *
 * The definition travels as an object and is stored as one - the column is `mode: 'json'` for
 * exactly this reason, so nothing here has to serialise it by hand and risk double-encoding it.
 */
export class StoryCalendarClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'StoryCalendar';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('StoryCalendarClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    const calendar = update.data as StoryCalendar;

    await this.db.insert(schema.storyCalendars).values({
      ...calendar,
      id: update.id,
      storyId,
      createdAt: new Date(calendar.createdAt),
      updatedAt: new Date(calendar.updatedAt),
      deletedAt: calendar.deletedAt ? new Date(calendar.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;

    const local = await this.db.query.storyCalendars.findFirst({
      where: eq(schema.storyCalendars.id, update.id),
    });
    if (!local) {
      console.warn(`StoryCalendar ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const changes = update.changes as Partial<StoryCalendar>;
    await this.db
      .update(schema.storyCalendars)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(update.operationTime || new Date()),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.storyCalendars.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;

    await this.db
      .update(schema.storyCalendars)
      .set({ storyId, isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.storyCalendars.id, update.id));
  }

  async getById(id: string): Promise<StoryCalendar | undefined> {
    return this.db.query.storyCalendars.findFirst({
      where: eq(schema.storyCalendars.id, id),
    }) as Promise<StoryCalendar | undefined>;
  }
}
