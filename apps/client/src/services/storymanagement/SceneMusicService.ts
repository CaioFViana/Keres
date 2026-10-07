import type { SceneMusicRole } from '@keres/shared';
import { compareRanked, rankBetween } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { SceneMusicInsert, SceneMusicSelect } from '../../db/schema';
import { sceneMusic, scenes } from '../../db/schema';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/** What a link points at: a Song of the story, or a medium of its Gallery (an audio file, a link). */
export type SceneMusicTarget = { songId: string } | { galleryId: string };

export interface SceneMusicService {
  /** A scene's live music, in the order of its ranks. */
  getMusicForScene(sceneId: string): Promise<SceneMusicSelect[]>;
  /** Every live link of the story's live scenes, each scene's in order. */
  getMusicForStory(storyId: string): Promise<SceneMusicSelect[]>;
  getById(musicId: string): Promise<SceneMusicSelect | undefined>;
  /**
   * Adds music at the end of the scene's (or at `position`, counted from 0). The role is `in-world`
   * for a song and `score` for a medium of the Gallery unless said.
   */
  addMusic(
    currentUserId: string,
    data: {
      storyId: string;
      sceneId: string;
      target: SceneMusicTarget;
      role?: SceneMusicRole;
      cue?: string | null;
      sections?: string[] | null;
      position?: number;
    },
  ): Promise<SceneMusicSelect>;
  updateMusic(
    currentUserId: string,
    musicId: string,
    changes: Partial<{ role: SceneMusicRole; cue: string | null; sections: string[] | null }>,
  ): Promise<SceneMusicSelect>;
  /**
   * Points the link at something else (also the way out of "removed"). The sections named the old
   * song's labels, so they go with it.
   */
  retarget(
    currentUserId: string,
    musicId: string,
    target: SceneMusicTarget,
  ): Promise<SceneMusicSelect>;
  /** Moves a link to a place among its scene's music (counted from 0); only its own rank changes. */
  moveMusic(currentUserId: string, musicId: string, toPosition: number): Promise<SceneMusicSelect>;
  deleteMusic(currentUserId: string, musicId: string): Promise<void>;
}

function targetColumns(target: SceneMusicTarget) {
  return 'songId' in target
    ? { songId: target.songId, galleryId: null }
    : { songId: null, galleryId: target.galleryId };
}

/** Sections as stored: trimmed, without repeats, and `null` when none is named (the whole song). */
export function normalizeSections(sections: readonly string[] | null | undefined): string[] | null {
  if (!sections) return null;
  const kept = [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  return kept.length > 0 ? kept : null;
}

export const createSceneMusicService = (db: AppDrizzleClient): SceneMusicService => {
  const serverService = createServerService(db);
  const userIdFor = (currentUserId: string, storyId: string) =>
    getUserIdForOperation(db, serverService, storyId, currentUserId);

  const liveMusicOfScene = (sceneId: string) =>
    db
      .select()
      .from(sceneMusic)
      .where(and(eq(sceneMusic.sceneId, sceneId), eq(sceneMusic.isDeleted, false)))
      .all()
      .sort(compareRanked);

  return {
    async getMusicForScene(sceneId) {
      return liveMusicOfScene(sceneId);
    },

    async getMusicForStory(storyId) {
      const liveScenes = db
        .select({ id: scenes.id })
        .from(scenes)
        .where(and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)))
        .all();
      if (liveScenes.length === 0) return [];
      const sceneIds = new Set(liveScenes.map((scene) => scene.id));
      return db
        .select()
        .from(sceneMusic)
        .where(and(eq(sceneMusic.storyId, storyId), eq(sceneMusic.isDeleted, false)))
        .all()
        .filter((music) => sceneIds.has(music.sceneId))
        .sort((a, b) =>
          a.sceneId === b.sceneId ? compareRanked(a, b) : a.sceneId < b.sceneId ? -1 : 1,
        );
    },

    async getById(musicId) {
      return db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, musicId) });
    },

    async addMusic(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const siblings = liveMusicOfScene(data.sceneId);
      const at = Math.min(Math.max(data.position ?? siblings.length, 0), siblings.length);
      const rank = rankBetween(siblings[at - 1]?.rank ?? null, siblings[at]?.rank ?? null);
      const row = prepareNewEntityData<SceneMusicInsert>({
        storyId: data.storyId,
        sceneId: data.sceneId,
        rank,
        ...targetColumns(data.target),
        role: data.role ?? ('songId' in data.target ? 'in-world' : 'score'),
        cue: data.cue?.trim() ? data.cue.trim() : null,
        sections: 'songId' in data.target ? normalizeSections(data.sections) : null,
      });
      const userIdToLog = await userIdFor(currentUserId, data.storyId);
      const created = await runLocalWrite(db, data.storyId, () => {
        const inserted = db.insert(sceneMusic).values(row).returning().get();
        recordLocalOperationSync(
          db,
          data.storyId,
          userIdToLog,
          'create',
          'SceneMusic',
          inserted.id,
          {
            ...inserted,
          },
        );
        return inserted;
      });
      entityEventEmitter.emit('scene_music_changed', data.storyId, created.id);
      return created;
    },

    async updateMusic(currentUserId, musicId, changes) {
      const original = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, musicId) });
      if (!original) throw new Error(`SceneMusic ${musicId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);
      const normalised = {
        ...(changes.cue !== undefined
          ? { cue: changes.cue?.trim() ? changes.cue.trim() : null }
          : {}),
        ...(changes.role !== undefined ? { role: changes.role } : {}),
        ...(changes.sections !== undefined
          ? { sections: normalizeSections(changes.sections) }
          : {}),
      };
      const changed = getChangedFields(original, { ...original, ...normalised });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;
      return writeChange(currentUserId, original, normalised);
    },

    async retarget(currentUserId, musicId, target) {
      const original = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, musicId) });
      if (!original) throw new Error(`SceneMusic ${musicId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);
      return writeChange(currentUserId, original, { ...targetColumns(target), sections: null });
    },

    async moveMusic(currentUserId, musicId, toPosition) {
      const original = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, musicId) });
      if (!original) throw new Error(`SceneMusic ${musicId} not found for move.`);
      await assertStoryIsWritable(db, original.storyId);
      const others = liveMusicOfScene(original.sceneId).filter((music) => music.id !== musicId);
      const at = Math.min(Math.max(toPosition, 0), others.length);
      const rank = rankBetween(others[at - 1]?.rank ?? null, others[at]?.rank ?? null);
      // Only this row is written: two devices moving different links never contest anything.
      return writeChange(currentUserId, original, { rank });
    },

    async deleteMusic(currentUserId, musicId) {
      const original = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, musicId) });
      if (!original) {
        console.warn(`Attempted to delete non-existent scene music ${musicId}.`);
        return;
      }
      await assertStoryIsWritable(db, original.storyId);
      const userIdToLog = await userIdFor(currentUserId, original.storyId);
      const deleted = await runLocalWrite(db, original.storyId, () => {
        const row = db
          .update(sceneMusic)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${sceneMusic.version} + 1`,
          })
          .where(eq(sceneMusic.id, musicId))
          .returning({
            id: sceneMusic.id,
            storyId: sceneMusic.storyId,
            isDeleted: sceneMusic.isDeleted,
            version: sceneMusic.version,
          })
          .get();
        if (!row) throw new Error(`Failed to delete scene music ${musicId}.`);
        recordLocalOperationSync(db, row.storyId, userIdToLog, 'delete', 'SceneMusic', musicId, {
          id: row.id,
          isDeleted: row.isDeleted,
          version: row.version,
        });
        return row;
      });
      entityEventEmitter.emit('scene_music_changed', deleted.storyId, musicId);
    },
  };

  async function writeChange(
    currentUserId: string,
    original: SceneMusicSelect,
    changes: Partial<
      Pick<SceneMusicSelect, 'rank' | 'role' | 'cue' | 'sections' | 'songId' | 'galleryId'>
    >,
  ): Promise<SceneMusicSelect> {
    const userIdToLog = await userIdFor(currentUserId, original.storyId);
    const updated = await runLocalWrite(db, original.storyId, () => {
      db.update(sceneMusic)
        .set({ ...changes, updatedAt: new Date(), version: sql`${sceneMusic.version} + 1` })
        .where(eq(sceneMusic.id, original.id))
        .run();
      const row = db.select().from(sceneMusic).where(eq(sceneMusic.id, original.id)).get();
      if (!row) throw new Error(`Failed to retrieve updated SceneMusic ${original.id}.`);
      const operationChanges = getChangedFields(original, row);
      recordLocalOperationSync(
        db,
        row.storyId,
        userIdToLog,
        'update',
        'SceneMusic',
        original.id,
        operationChanges,
      );
      return row;
    });
    entityEventEmitter.emit('scene_music_changed', updated.storyId, original.id);
    return updated;
  }
};

/** Music grouped by scene, each scene's in order: the shape a manuscript reads it in. */
export function groupMusicByScene(
  music: readonly SceneMusicSelect[],
): Map<string, SceneMusicSelect[]> {
  const grouped = new Map<string, SceneMusicSelect[]>();
  for (const item of [...music].sort(compareRanked)) {
    const list = grouped.get(item.sceneId) ?? [];
    list.push(item);
    grouped.set(item.sceneId, list);
  }
  return grouped;
}

/** Whether a link still has a target: both are null once its Song or medium is gone. */
export function musicHasTarget(music: Pick<SceneMusicSelect, 'songId' | 'galleryId'>): boolean {
  return music.songId !== null || music.galleryId !== null;
}
