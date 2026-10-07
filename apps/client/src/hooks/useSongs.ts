import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SongSelect } from '@/src/db/schema';
import { createSceneMusicService } from '@/src/services/storymanagement/SceneMusicService';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import { createSongService } from '@/src/services/storymanagement/SongService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

/** The songs of a story, by title. Reloads when a song is made, changed or deleted. */
export function useSongs(storyId: string | undefined) {
  const db = useDrizzle();
  const [songs, setSongs] = useState<SongSelect[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storyId) {
      setSongs([]);
      setLoading(false);
      return;
    }
    try {
      setSongs(await createSongService(db).getSongsForStory(storyId));
    } catch (error) {
      console.log('useSongs: failed to load the songs.', error);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, [db, storyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no story is given; everything else waits for `await`.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('song_changed', onChange);
    return () => entityEventEmitter.off('song_changed', onChange);
  }, [reload, storyId]);

  return { songs, loading, reload };
}

/**
 * One song by id: `undefined` while it loads, `null` when there is none or it was deleted. Reloads when
 * it changes, on this device or another.
 */
export function useSong(songId: string | undefined) {
  const db = useDrizzle();
  const [song, setSong] = useState<SongSelect | null | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!songId) {
      setSong(null);
      return;
    }
    try {
      const row = await createSongService(db).getById(songId);
      setSong(row && !row.isDeleted ? row : null);
    } catch (error) {
      console.log('useSong: failed to load the song.', error);
      setSong(null);
    }
  }, [db, songId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no song is given; everything else waits for `await`.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (_storyId: string, changedId?: string) => {
      if (!changedId || changedId === songId) void reload();
    };
    entityEventEmitter.on('song_changed', onChange);
    return () => entityEventEmitter.off('song_changed', onChange);
  }, [reload, songId]);

  return song;
}

/** A scene that sings a song, with the link that says how. */
export interface SongUse {
  sceneId: string;
  sceneName: string;
}

/** The scenes that sing a song: each once, by name. Reloads when the music of a scene changes. */
export function useSongUses(songId: string | undefined, storyId: string | undefined) {
  const db = useDrizzle();
  const [uses, setUses] = useState<SongUse[]>([]);

  const reload = useCallback(async () => {
    if (!songId) {
      setUses([]);
      return;
    }
    try {
      const links = await createSceneMusicService(db).getMusicForSong(songId);
      const sceneService = createSceneService(db);
      const sceneIds = [...new Set(links.map((link) => link.sceneId))];
      const rows = await Promise.all(sceneIds.map((id) => sceneService.getById(id)));
      setUses(
        rows.flatMap((scene) =>
          scene && !scene.isDeleted ? [{ sceneId: scene.id, sceneName: scene.name }] : [],
        ),
      );
    } catch (error) {
      console.log('useSongUses: failed to load the scenes.', error);
      setUses([]);
    }
  }, [db, songId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no song is given; everything else waits for `await`.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('scene_music_changed', onChange);
    entityEventEmitter.on('scene_changed', onChange);
    return () => {
      entityEventEmitter.off('scene_music_changed', onChange);
      entityEventEmitter.off('scene_changed', onChange);
    };
  }, [reload, storyId]);

  return uses;
}
