import { PartialSongSchema } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { SongInsert, SongSelect } from '../../db/schema';
import { songs } from '../../db/schema';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/** What a person can write of a song; every field is optional on a change. */
export interface SongFields {
  title: string;
  notes: string | null;
  lyrics: string;
  lyricsTranslation: string | null;
  melody: string | null;
  key: string | null;
  tempo: number | null;
  meter: string | null;
}

export interface SongService {
  /** The live songs of a story, by title. */
  getSongsForStory(storyId: string): Promise<SongSelect[]>;
  getById(songId: string): Promise<SongSelect | undefined>;
  createSong(
    currentUserId: string,
    data: { storyId: string } & Pick<SongFields, 'title'> & Partial<Omit<SongFields, 'title'>>,
  ): Promise<SongSelect>;
  /** Changes only the fields named; a change that changes nothing writes nothing. */
  updateSong(
    currentUserId: string,
    songId: string,
    changes: Partial<SongFields>,
  ): Promise<SongSelect>;
  deleteSong(currentUserId: string, songId: string): Promise<void>;
}

const orNull = (value: string | null | undefined): string | null =>
  value && value.trim() !== '' ? value : null;

/** One text as stored: lines end in `\n` and a text that says nothing is not stored. */
const text = (value: string | null | undefined): string | null =>
  orNull(value?.replace(/\r\n?/g, '\n').replace(/\s+$/, ''));

/**
 * The fields as the database holds them: the title trimmed (and never empty), the lyrics with plain
 * line endings, and every optional text `null` rather than empty. Each is checked against the
 * shared limits, so a song the server would refuse is never written here.
 */
export function normalizeSongFields(changes: Partial<SongFields>): Partial<SongFields> {
  const normalized: Partial<SongFields> = {};
  if (changes.title !== undefined) normalized.title = changes.title.trim();
  if (changes.notes !== undefined) normalized.notes = text(changes.notes);
  if (changes.lyrics !== undefined) {
    normalized.lyrics = changes.lyrics.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  }
  if (changes.lyricsTranslation !== undefined) {
    normalized.lyricsTranslation = text(changes.lyricsTranslation);
  }
  if (changes.melody !== undefined) normalized.melody = text(changes.melody);
  if (changes.key !== undefined) normalized.key = orNull(changes.key?.trim());
  if (changes.tempo !== undefined) normalized.tempo = changes.tempo;
  if (changes.meter !== undefined) normalized.meter = orNull(changes.meter?.trim());
  if (normalized.title === '') throw new Error('A song needs a title.');
  PartialSongSchema.parse(normalized);
  return normalized;
}

export const createSongService = (db: AppDrizzleClient): SongService => {
  const serverService = createServerService(db);
  const userIdFor = (currentUserId: string, storyId: string) =>
    getUserIdForOperation(db, serverService, storyId, currentUserId);

  return {
    async getSongsForStory(storyId) {
      return db
        .select()
        .from(songs)
        .where(and(eq(songs.storyId, storyId), eq(songs.isDeleted, false)))
        .all()
        .sort((a, b) => a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1));
    },

    async getById(songId) {
      return db.query.songs.findFirst({ where: eq(songs.id, songId) });
    },

    async createSong(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const { storyId, ...fields } = data;
      const normalized = normalizeSongFields(fields);
      const row = prepareNewEntityData<SongInsert>({
        storyId,
        title: normalized.title as string,
        notes: normalized.notes ?? null,
        lyrics: normalized.lyrics ?? '',
        lyricsTranslation: normalized.lyricsTranslation ?? null,
        melody: normalized.melody ?? null,
        key: normalized.key ?? null,
        tempo: normalized.tempo ?? null,
        meter: normalized.meter ?? null,
      });
      const userIdToLog = await userIdFor(currentUserId, storyId);
      const created = await runLocalWrite(db, storyId, () => {
        const inserted = db.insert(songs).values(row).returning().get();
        recordLocalOperationSync(db, storyId, userIdToLog, 'create', 'Song', inserted.id, {
          ...inserted,
        });
        return inserted;
      });
      entityEventEmitter.emit('song_changed', storyId, created.id);
      return created;
    },

    async updateSong(currentUserId, songId, changes) {
      const original = await db.query.songs.findFirst({ where: eq(songs.id, songId) });
      if (!original) throw new Error(`Song ${songId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);
      const normalized = normalizeSongFields(changes);
      const changed = getChangedFields(original, { ...original, ...normalized });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;

      const userIdToLog = await userIdFor(currentUserId, original.storyId);
      const updated = await runLocalWrite(db, original.storyId, () => {
        db.update(songs)
          .set({ ...normalized, updatedAt: new Date(), version: sql`${songs.version} + 1` })
          .where(eq(songs.id, songId))
          .run();
        const row = db.select().from(songs).where(eq(songs.id, songId)).get();
        if (!row) throw new Error(`Failed to retrieve updated Song ${songId}.`);
        recordLocalOperationSync(
          db,
          row.storyId,
          userIdToLog,
          'update',
          'Song',
          songId,
          getChangedFields(original, row),
        );
        return row;
      });
      entityEventEmitter.emit('song_changed', updated.storyId, songId);
      return updated;
    },

    async deleteSong(currentUserId, songId) {
      const original = await db.query.songs.findFirst({ where: eq(songs.id, songId) });
      if (!original) {
        console.warn(`Attempted to delete non-existent song ${songId}.`);
        return;
      }
      await assertStoryIsWritable(db, original.storyId);
      const userIdToLog = await userIdFor(currentUserId, original.storyId);
      const deleted = await runLocalWrite(db, original.storyId, () => {
        const row = db
          .update(songs)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${songs.version} + 1`,
          })
          .where(eq(songs.id, songId))
          .returning({
            id: songs.id,
            storyId: songs.storyId,
            isDeleted: songs.isDeleted,
            version: songs.version,
          })
          .get();
        if (!row) throw new Error(`Failed to delete song ${songId}.`);
        recordLocalOperationSync(db, row.storyId, userIdToLog, 'delete', 'Song', songId, {
          id: row.id,
          isDeleted: row.isDeleted,
          version: row.version,
        });
        return row;
      });
      entityEventEmitter.emit('song_changed', deleted.storyId, songId);
    },
  };
};
