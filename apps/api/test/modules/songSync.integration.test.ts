import { rankAtPosition } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { galleries, galleryRelations, sceneMusic, scenes, songs } from '../../src/db/schema';
import { SongSyncHandler } from '../../src/services/entity-sync-handlers/SongSyncHandler';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let user: TestUser;
let storyId: string;

const push = (updates: unknown[]) =>
  request('POST', `/sync/${storyId}`, { token: user.token, body: updates });

const songData = (overrides: Record<string, unknown> = {}) => ({
  title: 'Tavern song',
  notes: 'Sung by the bard',
  lyrics: '{sov: Verse 1}\n[G]Night de[Em]scends\n{eov}',
  lyricsTranslation: null,
  melody: null,
  key: 'G',
  tempo: 90,
  meter: '3/4',
  ...overrides,
});

const create = (id: string, data: Record<string, unknown>) => ({
  type: 'create' as const,
  entity: 'Song',
  id,
  version: 0,
  clientOperationId: `create-${id}`,
  data,
});

const update = (
  id: string,
  version: number,
  changes: Record<string, unknown>,
  operation: string,
) => ({
  type: 'update' as const,
  entity: 'Song',
  id,
  version,
  clientOperationId: operation,
  changes: { version, ...changes },
});

describe('songs through the sync endpoint', () => {
  beforeEach(async () => {
    await truncateAll();
    user = await registerUser('song-user');
    storyId = (await uploadTestStory(user.token, 'Songs')).id;
  });

  it('registers the Song protocol entity', () => {
    expect(new SongSyncHandler().entityName).toBe('Song');
  });

  it('accepts a song and keeps every field', async () => {
    const id = newId();
    const response = await push([create(id, songData({ lyricsTranslation: 'Night falls' }))]);

    expect(response.status).toBe(200);
    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.songs.findFirst({ where: eq(songs.id, id) });
    expect(row).toMatchObject({
      storyId,
      title: 'Tavern song',
      notes: 'Sung by the bard',
      lyrics: '{sov: Verse 1}\n[G]Night de[Em]scends\n{eov}',
      lyricsTranslation: 'Night falls',
      key: 'G',
      tempo: 90,
      meter: '3/4',
      version: 1,
    });
  });

  it('retries a create without a conflict', async () => {
    const id = newId();

    expect((await push([create(id, songData())])).data.conflicts).toEqual([]);
    const retried = await push([create(id, songData())]);

    expect(retried.status).toBe(200);
    expect(retried.data.conflicts).toEqual([]);
  });

  it('refuses a song with no title, a tempo out of range and a key that is not one', async () => {
    const noTitle = await push([create(newId(), songData({ title: '' }))]);
    const slow = await push([create(newId(), songData({ tempo: 5 }))]);
    const badKey = await push([create(newId(), songData({ key: 'H' }))]);

    for (const response of [noTitle, slow, badKey]) {
      expect(response.data.applied ?? []).toEqual([]);
    }
    expect(await db.select().from(songs)).toHaveLength(0);
  });

  it('refuses lyrics past the limit', async () => {
    const response = await push([create(newId(), songData({ lyrics: 'x'.repeat(16_001) }))]);

    expect(response.data.applied ?? []).toEqual([]);
    expect(await db.select().from(songs)).toHaveLength(0);
  });

  it('edits the lyrics and the melody as separate changes that touch only their field', async () => {
    const id = newId();
    await push([create(id, songData())]);

    const lyrics = await push([update(id, 1, { lyrics: '[C]New words' }, 'edit-lyrics')]);
    expect(lyrics.data.conflicts).toEqual([]);
    const melody = await push([update(id, 2, { melody: 'G4:1 A4:1' }, 'edit-melody')]);
    expect(melody.data.conflicts).toEqual([]);

    const row = await db.query.songs.findFirst({ where: eq(songs.id, id) });
    expect(row).toMatchObject({
      lyrics: '[C]New words',
      melody: 'G4:1 A4:1',
      title: 'Tavern song',
      version: 3,
    });
  });

  it('clears the translation and the facts back to nothing', async () => {
    const id = newId();
    await push([create(id, songData({ lyricsTranslation: 'x' }))]);

    const response = await push([
      update(id, 1, { lyricsTranslation: null, key: null, tempo: null, meter: null }, 'clear'),
    ]);

    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.songs.findFirst({ where: eq(songs.id, id) });
    expect(row).toMatchObject({ lyricsTranslation: null, key: null, tempo: null, meter: null });
  });

  it('refuses an edit that breaks a limit', async () => {
    const id = newId();
    await push([create(id, songData())]);

    const response = await push([update(id, 1, { tempo: 999 }, 'too-fast')]);

    expect(response.data.applied ?? []).toEqual([]);
    expect((await db.query.songs.findFirst({ where: eq(songs.id, id) }))?.tempo).toBe(90);
  });

  it('deletes a song', async () => {
    const id = newId();
    await push([create(id, songData())]);

    const deleted = await push([
      {
        type: 'delete',
        entity: 'Song',
        id,
        version: 1,
        clientOperationId: 'delete-song',
        changes: { version: 1 },
      },
    ]);

    expect(deleted.data.conflicts).toEqual([]);
    expect((await db.query.songs.findFirst({ where: eq(songs.id, id) }))?.isDeleted).toBe(true);
  });

  it('lets a song own a Gallery medium, as a character does', async () => {
    const songId = newId();
    const galleryId = newId();
    await push([create(songId, songData())]);
    await db.insert(galleries).values({
      id: galleryId,
      storyId,
      mediaType: 'audio',
      mimeType: 'audio/mpeg',
      fileName: 'reference.mp3',
      hash: 'h-reference',
      sizeBytes: 1,
    } as never);

    const response = await push([
      {
        type: 'create',
        entity: 'GalleryRelation',
        id: newId(),
        version: 0,
        clientOperationId: 'relate',
        data: { galleryId, ownerId: songId, ownerType: 'Song' },
      },
    ]);

    expect(response.data.conflicts).toEqual([]);
    expect(await db.select().from(galleryRelations)).toHaveLength(1);
  });

  it('refuses a Gallery link to a song that is not there', async () => {
    const galleryId = newId();
    await db.insert(galleries).values({
      id: galleryId,
      storyId,
      mediaType: 'audio',
      mimeType: 'audio/mpeg',
      fileName: 'reference.mp3',
      hash: 'h-reference-2',
      sizeBytes: 1,
    } as never);

    const response = await push([
      {
        type: 'create',
        entity: 'GalleryRelation',
        id: newId(),
        version: 0,
        clientOperationId: 'relate-gone',
        data: { galleryId, ownerId: newId(), ownerType: 'Song' },
      },
    ]);

    expect(response.data.applied ?? []).toEqual([]);
    expect(await db.select().from(galleryRelations)).toHaveLength(0);
  });

  it('exports and imports a story with its songs, following a scene to the song it sings', async () => {
    const songId = newId();
    const sceneId = newId();
    await db.insert(scenes).values({ id: sceneId, storyId, name: 'Tavern', index: 1 });
    await push([
      create(songId, songData({ title: 'Kept song' })),
      {
        type: 'create',
        entity: 'SceneMusic',
        id: newId(),
        version: 0,
        clientOperationId: 'sings',
        data: {
          sceneId,
          rank: rankAtPosition(0),
          songId,
          galleryId: null,
          role: 'in-world',
          cue: null,
          sections: ['Verse 1'],
        },
      },
    ]);

    const exported = await request('GET', `/stories/${storyId}/export`, { token: user.token });
    expect(exported.status).toBe(200);
    expect(exported.data.songs).toHaveLength(1);
    expect(exported.data.songs[0]).toMatchObject({ title: 'Kept song', tempo: 90 });

    const imported = await request('POST', '/stories/import', {
      token: user.token,
      body: exported.data,
    });
    expect(imported.status).toBeLessThan(300);
    const newStoryId = imported.data.id ?? imported.data.storyId;
    const copiedSongs = await db.select().from(songs).where(eq(songs.storyId, newStoryId));
    const copiedMusic = await db
      .select()
      .from(sceneMusic)
      .where(eq(sceneMusic.storyId, newStoryId));
    expect(copiedSongs).toHaveLength(1);
    expect(copiedSongs[0].id).not.toBe(songId);
    expect(copiedMusic).toHaveLength(1);
    // The link follows the copy of the song, not the original.
    expect(copiedMusic[0]).toMatchObject({ songId: copiedSongs[0].id, sections: ['Verse 1'] });
  });
});
