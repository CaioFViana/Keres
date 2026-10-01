import type { Plot } from '@keres/shared/entities/Plot';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient, PlotInsert } from '../../db';
import { plots } from '../../db';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export type SavePlot = Pick<Plot, 'storyId' | 'name' | 'details'> & { id?: string };

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
      const plotId = value.id;
      if (plotId) {
        const original = await db.query.plots.findFirst({ where: eq(plots.id, plotId) });
        if (!original || original.isDeleted) throw new Error('Plot not found.');
        const changes = getChangedFields(original, { ...original, ...value });
        delete changes.updatedAt;
        delete changes.version;
        if (Object.keys(changes).length === 0) return original;
        const logUserId = await getUserIdForOperation(db, serverService, original.storyId, userId);
        const updated = await runLocalWrite(db, original.storyId, () => {
          const row = db
            .update(plots)
            .set({
              name: value.name.trim(),
              details: value.details,
              updatedAt: new Date(),
              version: sql`${plots.version} + 1`,
            })
            .where(eq(plots.id, plotId))
            .returning()
            .get();
          if (!row) throw new Error('Unable to update plot.');
          recordLocalOperationSync(
            db,
            row.storyId,
            logUserId,
            'update',
            'Plot',
            row.id,
            getChangedFields(original, row),
          );
          return row;
        });
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
      const logUserId = await getUserIdForOperation(db, serverService, newPlot.storyId, userId);
      const created = await runLocalWrite(db, newPlot.storyId, () => {
        const row = db.insert(plots).values(newPlot).returning().get();
        if (!row) throw new Error('Unable to create plot.');
        recordLocalOperationSync(db, row.storyId, logUserId, 'create', 'Plot', row.id, row);
        return row;
      });
      entityEventEmitter.emit('plot_changed', created.storyId, created.id);
      return created;
    },
    async delete(userId: string, id: string): Promise<void> {
      const original = await db.query.plots.findFirst({ where: eq(plots.id, id) });
      if (!original || original.isDeleted) return;
      await assertStoryIsWritable(db, original.storyId);
      const logUserId = await getUserIdForOperation(db, serverService, original.storyId, userId);
      const deleted = await runLocalWrite(db, original.storyId, () => {
        const row = db
          .update(plots)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${plots.version} + 1`,
          })
          .where(eq(plots.id, id))
          .returning()
          .get();
        if (!row) return undefined;
        recordLocalOperationSync(db, row.storyId, logUserId, 'delete', 'Plot', id, {
          id,
          isDeleted: true,
          version: row.version,
        });
        return row;
      });
      if (!deleted) return;
      entityEventEmitter.emit('plot_changed', deleted.storyId, id);
    },
  };
};
