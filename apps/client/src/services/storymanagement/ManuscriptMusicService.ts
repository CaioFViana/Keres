import type { ManuscriptSceneMusic } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import { createGalleryService } from './GalleryService';
import { createSceneMusicService } from './SceneMusicService';
import { createSongService } from './SongService';

export interface ManuscriptMusicOptions {
  /** Only the scenes in this set. */
  sceneIds?: ReadonlySet<string>;
  /**
   * Carry the words of the songs a scene sings in the story, for an export that prints them. Without it a
   * song is named and nothing more: no lyrics are read.
   */
  withSongs?: boolean;
}

/**
 * The music of a story's scenes, ready for a manuscript: each piece named by what it points at (the
 * title of the song or of the medium, or its file name), and `null` where that is gone.
 */
export async function loadManuscriptMusic(
  db: AppDrizzleClient,
  storyId: string,
  options: ManuscriptMusicOptions = {},
): Promise<Map<string, ManuscriptSceneMusic[]>> {
  const { sceneIds, withSongs = false } = options;
  const rows = (await createSceneMusicService(db).getMusicForStory(storyId)).filter(
    (music) => !sceneIds || sceneIds.has(music.sceneId),
  );
  const galleryService = createGalleryService(db);
  const songService = createSongService(db);
  const galleryTitles = new Map<string, string | null>();
  const titleOfMedium = async (galleryId: string): Promise<string | null> => {
    if (!galleryTitles.has(galleryId)) {
      const row = await galleryService.getById(galleryId).catch(() => undefined);
      galleryTitles.set(galleryId, row && !row.isDeleted ? (row.title ?? row.fileName) : null);
    }
    return galleryTitles.get(galleryId) ?? null;
  };
  const songs = new Map<string, Awaited<ReturnType<typeof songService.getById>>>();
  const songOf = async (songId: string) => {
    if (!songs.has(songId)) {
      const row = await songService.getById(songId).catch(() => undefined);
      songs.set(songId, row && !row.isDeleted ? row : undefined);
    }
    return songs.get(songId);
  };

  const byScene = new Map<string, ManuscriptSceneMusic[]>();
  for (const music of rows) {
    const song = music.songId ? await songOf(music.songId) : undefined;
    const item: ManuscriptSceneMusic = {
      id: music.id,
      role: music.role,
      title: music.galleryId ? await titleOfMedium(music.galleryId) : (song?.title ?? null),
      cue: music.cue,
    };
    if (withSongs && song && music.role === 'in-world') {
      item.song = {
        id: song.id,
        title: song.title,
        lyrics: song.lyrics,
        lyricsTranslation: song.lyricsTranslation,
        sections: music.sections,
      };
    }
    const list = byScene.get(music.sceneId) ?? [];
    list.push(item);
    byScene.set(music.sceneId, list);
  }
  return byScene;
}

/** The scenes with their music attached; a scene with none comes back as it was. */
export function withManuscriptMusic<T extends { id: string }>(
  scenes: readonly T[],
  music: ReadonlyMap<string, ManuscriptSceneMusic[]> | null,
): T[] {
  if (!music) return [...scenes];
  return scenes.map((scene) => {
    const list = music.get(scene.id);
    return list ? { ...scene, music: list } : scene;
  });
}

/** What the music of a story offers an export: whether there is any, and whether a song is sung in it. */
export async function storyMusicFacts(
  db: AppDrizzleClient,
  storyId: string,
): Promise<{ hasMusic: boolean; hasSungSongs: boolean }> {
  const links = await createSceneMusicService(db).getMusicForStory(storyId);
  return {
    hasMusic: links.length > 0,
    hasSungSongs: links.some((link) => link.songId !== null && link.role === 'in-world'),
  };
}

/** Whether any scene of the story has music: what decides whether an export has anything to offer. */
export async function storyHasMusic(db: AppDrizzleClient, storyId: string): Promise<boolean> {
  return (await storyMusicFacts(db, storyId)).hasMusic;
}
