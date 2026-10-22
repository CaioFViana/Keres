import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type { SongSelect } from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { createSceneMusicService } from '@/src/services/storymanagement/media-music/SceneMusicService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { createSongService } from '@/src/services/storymanagement/media-music/SongService';

const NO_SONGS: SongSelect[] = [];
const NO_USES: SongUse[] = [];
const SONG_EVENTS = ['song_changed'] as const;
const SONG_USE_EVENTS = ['scene_music_changed', 'scene_changed'] as const;

/** The songs of a story, by title. Reloads when a song is made, changed or deleted. */
export function useSongs(storyId: string | undefined) {
  const db = useDrizzle();
  const load = useMemo(
    () => (storyId ? () => createSongService(db).getSongsForStory(storyId) : null),
    [db, storyId],
  );
  const {
    data: songs,
    loading,
    reload,
  } = useLoadedResource({
    load,
    initial: NO_SONGS,
    events: SONG_EVENTS,
    storyId,
    label: 'the songs',
  });

  return { songs, loading, reload };
}

/**
 * One song by id: `undefined` while it loads, `null` when there is none or it was deleted. Reloads when
 * it changes, on this device or another.
 */
export function useSong(songId: string | undefined) {
  const db = useDrizzle();
  const load = useMemo(
    () =>
      songId
        ? async () => {
            const row = await createSongService(db).getById(songId);
            return row && !row.isDeleted ? row : null;
          }
        : null,
    [db, songId],
  );
  const { data, failed } = useLoadedResource<SongSelect | null | undefined>({
    load,
    initial: undefined,
    events: SONG_EVENTS,
    entityId: songId,
    label: 'the song',
  });

  return songId && !failed ? data : null;
}

/** A scene that sings a song, with the link that says how. */
export interface SongUse {
  sceneId: string;
  sceneName: string;
}

/** The scenes that sing a song: each once, by name. Reloads when the music of a scene changes. */
export function useSongUses(songId: string | undefined, storyId: string | undefined) {
  const db = useDrizzle();
  const load = useMemo(
    () =>
      songId
        ? async () => {
            const links = await createSceneMusicService(db).getMusicForSong(songId);
            const sceneService = createSceneService(db);
            const sceneIds = [...new Set(links.map((link) => link.sceneId))];
            const rows = await Promise.all(sceneIds.map((id) => sceneService.getById(id)));
            return rows.flatMap((scene) =>
              scene && !scene.isDeleted ? [{ sceneId: scene.id, sceneName: scene.name }] : [],
            );
          }
        : null,
    [db, songId],
  );
  return useLoadedResource({
    load,
    initial: NO_USES,
    events: SONG_USE_EVENTS,
    storyId,
    label: 'the scenes that sing the song',
  }).data;
}
