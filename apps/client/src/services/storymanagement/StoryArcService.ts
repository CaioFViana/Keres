import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StoryArcInsert, StoryArcSelect } from '../../db/schema';
import { chapters, characterScenes, itemJourneys, scenes, storyArcs } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export type ArcMembershipKind = 'character' | 'location' | 'item';

export interface StoryArcService {
  getArcsForStory(storyId: string): Promise<StoryArcSelect[]>;
  getById(arcId: string): Promise<StoryArcSelect | undefined>;
  getDefault(storyId: string): Promise<StoryArcSelect | undefined>;
  ensureDefaultArc(currentUserId: string, storyId: string): Promise<StoryArcSelect>;
  createArc(currentUserId: string, data: Create<StoryArcInsert>): Promise<StoryArcSelect>;
  updateArc(
    currentUserId: string,
    arcId: string,
    changes: Partial<
      Pick<
        StoryArcInsert,
        'title' | 'description' | 'sortOrder' | 'color' | 'icon' | 'themeOverride'
      >
    >,
  ): Promise<StoryArcSelect>;
  deleteArc(currentUserId: string, arcId: string): Promise<void>;
  listArcsForCharacter(storyId: string, characterId: string): Promise<StoryArcSelect[]>;
  listArcsForLocation(storyId: string, locationId: string): Promise<StoryArcSelect[]>;
  listArcsForItem(storyId: string, itemId: string): Promise<StoryArcSelect[]>;
  /**
   * Arc ids per linked entity of one kind, in a single query. Entities without a
   * chaptered link are absent: list screens keep them visible under any arc.
   */
  listEntityArcIds(storyId: string, kind: ArcMembershipKind): Promise<Map<string, string[]>>;
}

function groupArcRows(rows: { entityId: string | null; arcId: string }[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.entityId) continue;
    const list = grouped.get(row.entityId) ?? [];
    list.push(row.arcId);
    grouped.set(row.entityId, list);
  }
  return grouped;
}

export const createStoryArcService = (db: AppDrizzleClient): StoryArcService => {
  const serverService = createServerService(db);

  const liveInStory = (storyId: string) =>
    and(eq(storyArcs.storyId, storyId), eq(storyArcs.isDeleted, false));

  const logOperation = async (
    currentUserId: string,
    storyId: string,
    type: 'create' | 'update' | 'delete',
    arcId: string,
    payload: Record<string, unknown>,
  ) => {
    const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
    await recordLocalOperation(db, storyId, userIdToLog, type, 'StoryArc', arcId, payload);
    entityEventEmitter.emit('story_arc_changed', storyId, arcId);
  };

  const service: StoryArcService = {
    async getArcsForStory(storyId) {
      return db
        .select()
        .from(storyArcs)
        .where(liveInStory(storyId))
        .orderBy(asc(storyArcs.sortOrder), asc(storyArcs.createdAt))
        .all();
    },

    async getById(arcId) {
      return db.query.storyArcs.findFirst({ where: eq(storyArcs.id, arcId) });
    },

    async getDefault(storyId) {
      const arcs = await service.getArcsForStory(storyId);
      return arcs.find((arc) => arc.isDefault) ?? arcs[0];
    },

    async ensureDefaultArc(currentUserId, storyId) {
      const existing = await service.getDefault(storyId);
      if (existing) return existing;
      return service.createArc(currentUserId, {
        storyId,
        title: 'Arc',
        description: null,
        sortOrder: 0,
        color: null,
        icon: null,
        themeOverride: null,
        isDefault: true,
      });
    },

    async createArc(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const existing = await service.getArcsForStory(data.storyId);
      const row = prepareNewEntityData<StoryArcInsert>({
        ...data,
        sortOrder: existing.length,
        isDefault: existing.length === 0,
      });
      const result = await db.insert(storyArcs).values(row).returning().get();
      await logOperation(currentUserId, data.storyId, 'create', result.id, { ...result });
      return result;
    },

    async updateArc(currentUserId, arcId, changes) {
      const current = await service.getById(arcId);
      if (!current || current.isDeleted) throw new Error(`StoryArc ${arcId} not found.`);
      await assertStoryIsWritable(db, current.storyId);
      const next = { ...current, ...changes };
      const diff = getChangedFields(current, next);
      delete diff.version;
      delete diff.updatedAt;
      if (Object.keys(diff).length === 0) return current;
      const result = await db
        .update(storyArcs)
        .set({ ...diff, updatedAt: new Date(), version: current.version + 1 })
        .where(eq(storyArcs.id, arcId))
        .returning()
        .get();
      // Log the post-bump row diff (includes `version`) so push can derive OCC baseVersion.
      await logOperation(
        currentUserId,
        current.storyId,
        'update',
        arcId,
        getChangedFields(current, result),
      );
      return result;
    },

    async deleteArc(currentUserId, arcId) {
      const current = await service.getById(arcId);
      if (!current || current.isDeleted) return;
      await assertStoryIsWritable(db, current.storyId);
      if (current.isDefault) {
        throw new Error('The default arc cannot be deleted.');
      }
      const fallback = await service.getDefault(current.storyId);
      if (fallback && fallback.id !== arcId) {
        await db
          .update(chapters)
          .set({ arcId: fallback.id, updatedAt: new Date() })
          .where(and(eq(chapters.storyId, current.storyId), eq(chapters.arcId, arcId)));
      }
      // Bump version and log the *resulting* version so push can derive the OCC base
      // (`version - 1`), matching Character/Plot/Board deletes. Without it the server
      // returns `validation` ("data is not valid") and the delete never syncs.
      const [deleted] = await db
        .update(storyArcs)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${storyArcs.version} + 1`,
        })
        .where(eq(storyArcs.id, arcId))
        .returning({
          id: storyArcs.id,
          storyId: storyArcs.storyId,
          isDeleted: storyArcs.isDeleted,
          version: storyArcs.version,
        });
      if (!deleted) return;
      await logOperation(currentUserId, deleted.storyId, 'delete', arcId, {
        id: deleted.id,
        isDeleted: deleted.isDeleted,
        version: deleted.version,
      });
    },

    async listArcsForCharacter(storyId, characterId) {
      const rows = await db
        .selectDistinct({ id: storyArcs.id })
        .from(characterScenes)
        .innerJoin(scenes, eq(scenes.id, characterScenes.sceneId))
        .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
        .innerJoin(storyArcs, eq(storyArcs.id, chapters.arcId))
        .where(
          and(
            eq(characterScenes.storyId, storyId),
            eq(characterScenes.characterId, characterId),
            eq(characterScenes.isDeleted, false),
            eq(scenes.isDeleted, false),
            eq(chapters.isDeleted, false),
            eq(storyArcs.isDeleted, false),
          ),
        )
        .all();
      return hydrateArcs(
        storyId,
        rows.map((row) => row.id),
      );
    },

    async listArcsForLocation(storyId, locationId) {
      const rows = await db
        .selectDistinct({ id: storyArcs.id })
        .from(scenes)
        .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
        .innerJoin(storyArcs, eq(storyArcs.id, chapters.arcId))
        .where(
          and(
            eq(scenes.storyId, storyId),
            eq(scenes.locationId, locationId),
            eq(scenes.isDeleted, false),
            eq(chapters.isDeleted, false),
            eq(storyArcs.isDeleted, false),
          ),
        )
        .all();
      return hydrateArcs(
        storyId,
        rows.map((row) => row.id),
      );
    },

    async listArcsForItem(storyId, itemId) {
      const rows = await db
        .selectDistinct({ id: storyArcs.id })
        .from(itemJourneys)
        .innerJoin(scenes, eq(scenes.id, itemJourneys.sceneId))
        .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
        .innerJoin(storyArcs, eq(storyArcs.id, chapters.arcId))
        .where(
          and(
            eq(itemJourneys.storyId, storyId),
            eq(itemJourneys.itemId, itemId),
            eq(itemJourneys.isDeleted, false),
            eq(scenes.isDeleted, false),
            eq(chapters.isDeleted, false),
            eq(storyArcs.isDeleted, false),
          ),
        )
        .all();
      return hydrateArcs(
        storyId,
        rows.map((row) => row.id),
      );
    },

    async listEntityArcIds(storyId, kind) {
      // Same joins and tombstone guards as the per-entity walks above, without the
      // entity filter: one round trip groups every linked entity of the kind.
      if (kind === 'character') {
        const rows = await db
          .selectDistinct({ entityId: characterScenes.characterId, arcId: storyArcs.id })
          .from(characterScenes)
          .innerJoin(scenes, eq(scenes.id, characterScenes.sceneId))
          .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
          .innerJoin(storyArcs, eq(storyArcs.id, chapters.arcId))
          .where(
            and(
              eq(characterScenes.storyId, storyId),
              eq(characterScenes.isDeleted, false),
              eq(scenes.isDeleted, false),
              eq(chapters.isDeleted, false),
              eq(storyArcs.isDeleted, false),
            ),
          )
          .all();
        return groupArcRows(rows);
      }
      if (kind === 'location') {
        const rows = await db
          .selectDistinct({ entityId: scenes.locationId, arcId: storyArcs.id })
          .from(scenes)
          .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
          .innerJoin(storyArcs, eq(storyArcs.id, chapters.arcId))
          .where(
            and(
              eq(scenes.storyId, storyId),
              isNotNull(scenes.locationId),
              eq(scenes.isDeleted, false),
              eq(chapters.isDeleted, false),
              eq(storyArcs.isDeleted, false),
            ),
          )
          .all();
        return groupArcRows(rows);
      }
      const rows = await db
        .selectDistinct({ entityId: itemJourneys.itemId, arcId: storyArcs.id })
        .from(itemJourneys)
        .innerJoin(scenes, eq(scenes.id, itemJourneys.sceneId))
        .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
        .innerJoin(storyArcs, eq(storyArcs.id, chapters.arcId))
        .where(
          and(
            eq(itemJourneys.storyId, storyId),
            eq(itemJourneys.isDeleted, false),
            eq(scenes.isDeleted, false),
            eq(chapters.isDeleted, false),
            eq(storyArcs.isDeleted, false),
          ),
        )
        .all();
      return groupArcRows(rows);
    },
  };

  async function hydrateArcs(storyId: string, ids: string[]): Promise<StoryArcSelect[]> {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    return (await service.getArcsForStory(storyId)).filter((arc) => wanted.has(arc.id));
  }

  return service;
};
