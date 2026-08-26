import type { Plot } from '@keres/shared/entities/Plot';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient, PlotInsert } from '../../db';
import { plots } from '../../db';
import * as schema from '../../db/schema';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export type SavePlot = Pick<Plot, 'storyId' | 'name' | 'details'> & { id?: string };

const assertLinearStory = async (db: AppDrizzleClient, storyId: string) => {
  const story = await db.query.stories.findFirst({ where: eq(schema.stories.id, storyId) });
  if (!story || story.isDeleted) throw new Error('Story not found.');
  if (story.type !== 'linear') throw new Error('Plots are only available for linear stories.');
};

export const createPlotService = (db: AppDrizzleClient) => {
  const serverService = createServerService(db);
  return {
    async getById(id: string): Promise<Plot | undefined> {
      return db.query.plots.findFirst({ where: and(eq(plots.id, id), eq(plots.isDeleted, false)) });
    },
    async getAllByStoryId(storyId: string): Promise<Plot[]> {
      return db.query.plots.findMany({
        where: and(eq(plots.storyId, storyId), eq(plots.isDeleted, false)),
        orderBy: [asc(plots.name), asc(plots.createdAt)],
      });
    },
    async save(userId: string, value: SavePlot): Promise<Plot> {
      await assertStoryIsWritable(db, value.storyId);
      await assertLinearStory(db, value.storyId);
      if (value.id) {
        const original = await db.query.plots.findFirst({ where: eq(plots.id, value.id) });
        if (!original || original.isDeleted) throw new Error('Plot not found.');
        const changes = getChangedFields(original, { ...original, ...value });
        delete changes.updatedAt;
        delete changes.version;
        if (Object.keys(changes).length === 0) return original;
        const [updated] = await db
          .update(plots)
          .set({
            name: value.name.trim(),
            details: value.details,
            updatedAt: new Date(),
            version: sql`${plots.version} + 1`,
          })
          .where(eq(plots.id, value.id))
          .returning();
        if (!updated) throw new Error('Unable to update plot.');
        const logUserId = await getUserIdForOperation(db, serverService, updated.storyId, userId);
        await recordLocalOperation(
          db,
          updated.storyId,
          logUserId,
          'update',
          'Plot',
          updated.id,
          getChangedFields(original, updated),
        );
        entityEventEmitter.emit('plot_changed', updated.storyId, updated.id);
        return updated;
      }
      const now = new Date();
      const newPlot: PlotInsert = {
        id: createULID(),
        storyId: value.storyId,
        name: value.name.trim(),
        details: value.details,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };
      const [created] = await db.insert(plots).values(newPlot).returning();
      if (!created) throw new Error('Unable to create plot.');
      const logUserId = await getUserIdForOperation(db, serverService, created.storyId, userId);
      await recordLocalOperation(
        db,
        created.storyId,
        logUserId,
        'create',
        'Plot',
        created.id,
        created,
      );
      entityEventEmitter.emit('plot_changed', created.storyId, created.id);
      return created;
    },
    async delete(userId: string, id: string): Promise<void> {
      const original = await db.query.plots.findFirst({ where: eq(plots.id, id) });
      if (!original || original.isDeleted) return;
      await assertStoryIsWritable(db, original.storyId);
      await assertLinearStory(db, original.storyId);
      const [deleted] = await db
        .update(plots)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${plots.version} + 1`,
        })
        .where(eq(plots.id, id))
        .returning();
      if (!deleted) return;
      const logUserId = await getUserIdForOperation(db, serverService, deleted.storyId, userId);
      await recordLocalOperation(db, deleted.storyId, logUserId, 'delete', 'Plot', id, {
        id,
        isDeleted: true,
        version: deleted.version,
      });
      entityEventEmitter.emit('plot_changed', deleted.storyId, id);
    },
  };
};
