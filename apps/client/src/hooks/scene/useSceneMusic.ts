import { sectionLabels } from '@keres/shared';
import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type { SceneMusicSelect } from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { createGalleryService } from '@/src/services/storymanagement/media-music/GalleryService';
import { createSceneMusicService } from '@/src/services/storymanagement/media-music/SceneMusicService';
import { createSongService } from '@/src/services/storymanagement/media-music/SongService';

/** What a piece of music points at: a song of the story, an audio file or a link of the Gallery. */
export type SceneMusicTargetKind = 'song' | 'audio' | 'link';

/** A piece of music with what it points at: its name and kind, and whether the target is gone. */
export interface SceneMusicView {
  music: SceneMusicSelect;
  targetKind: SceneMusicTargetKind | null;
  targetName: string | null;
  /** The Song or medium it pointed at is gone (or never resolved): the link keeps only its note. */
  targetGone: boolean;
  /** For a song: the labels of its sections, as its lyrics give them; empty for anything else. */
  songSections: string[];
  /** For a song: the sections this scene names that the lyrics no longer have. */
  missingSections: string[];
  /** For a song: `G · 90 · 3/4`, the facts it states; `null` when it states none. */
  songFacts: string | null;
}

export async function sceneMusicViewOf(
  db: ReturnType<typeof useDrizzle>,
  music: SceneMusicSelect,
): Promise<SceneMusicView> {
  if (music.galleryId) {
    const row = await createGalleryService(db).getById(music.galleryId);
    const alive = !!row && !row.isDeleted;
    return {
      music,
      targetKind: alive ? (row.mediaType === 'link' ? 'link' : 'audio') : null,
      targetName: alive ? (row.title ?? row.fileName) : null,
      targetGone: !alive,
      songSections: [],
      missingSections: [],
      songFacts: null,
    };
  }
  if (music.songId) {
    const song = await createSongService(db).getById(music.songId);
    const alive = !!song && !song.isDeleted;
    // The lyrics are read for their section labels only when someone is looking at this link.
    const labels = alive ? sectionLabels(song.lyrics) : [];
    return {
      music,
      targetKind: alive ? 'song' : null,
      targetName: alive ? song.title : null,
      targetGone: !alive,
      songSections: labels,
      missingSections: alive
        ? (music.sections ?? []).filter((label) => !labels.includes(label))
        : [],
      songFacts: alive
        ? [song.key, song.tempo ? String(song.tempo) : null, song.meter]
            .filter(Boolean)
            .join(' · ') || null
        : null,
    };
  }
  return {
    music,
    targetKind: null,
    targetName: null,
    targetGone: true,
    songSections: [],
    missingSections: [],
    songFacts: null,
  };
}

const NO_VIEWS: SceneMusicView[] = [];
const MUSIC_EVENTS = ['scene_music_changed', 'gallery_changed', 'song_changed'] as const;
const MUSIC_COUNT_EVENTS = ['scene_music_changed'] as const;

/**
 * A scene's music, in order, each with what it points at. Reloads when the music, the songs or the
 * Gallery change, so music whose file was deleted on another device turns into "removed".
 */
export function useSceneMusic(sceneId: string | undefined, storyId: string | undefined) {
  const db = useDrizzle();
  const load = useMemo(
    () =>
      sceneId
        ? async () => {
            const rows = await createSceneMusicService(db).getMusicForScene(sceneId);
            return Promise.all(rows.map((row) => sceneMusicViewOf(db, row)));
          }
        : null,
    [db, sceneId],
  );
  const {
    data: views,
    loading,
    reload,
  } = useLoadedResource({
    load,
    initial: NO_VIEWS,
    events: MUSIC_EVENTS,
    storyId,
    label: 'the music',
  });

  return { views, loading, reload };
}

/**
 * How many pieces of music a scene has, and nothing else: the scene's own screen asks this much of
 * them, so it never reads a song or a Gallery row to say "3 pieces".
 */
export function useSceneMusicCount(sceneId: string | undefined, storyId: string | undefined) {
  const db = useDrizzle();
  const load = useMemo(
    () =>
      sceneId
        ? async () => (await createSceneMusicService(db).getMusicForScene(sceneId)).length
        : null,
    [db, sceneId],
  );
  return useLoadedResource({
    load,
    initial: 0,
    events: MUSIC_COUNT_EVENTS,
    storyId,
    label: 'the music count',
  }).data;
}
