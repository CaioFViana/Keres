import { sectionLabels } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SceneMusicSelect } from '@/src/db/schema';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { createSceneMusicService } from '@/src/services/storymanagement/SceneMusicService';
import { createSongService } from '@/src/services/storymanagement/SongService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

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
    };
  }
  return {
    music,
    targetKind: null,
    targetName: null,
    targetGone: true,
    songSections: [],
    missingSections: [],
  };
}

/**
 * A scene's music, in order, each with what it points at. Reloads when the music, the songs or the
 * Gallery change, so music whose file was deleted on another device turns into "removed".
 */
export function useSceneMusic(sceneId: string | undefined, storyId: string | undefined) {
  const db = useDrizzle();
  const [views, setViews] = useState<SceneMusicView[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!sceneId) {
      setViews([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await createSceneMusicService(db).getMusicForScene(sceneId);
      setViews(await Promise.all(rows.map((row) => sceneMusicViewOf(db, row))));
    } catch (error) {
      console.log('useSceneMusic: failed to load the music.', error);
      setViews([]);
    } finally {
      setLoading(false);
    }
  }, [db, sceneId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no scene is given; everything else waits for `await`.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    const events = ['scene_music_changed', 'gallery_changed', 'song_changed'] as const;
    for (const event of events) entityEventEmitter.on(event, onChange);
    return () => {
      for (const event of events) entityEventEmitter.off(event, onChange);
    };
  }, [reload, storyId]);

  return { views, loading, reload };
}

/**
 * How many pieces of music a scene has, and nothing else: the scene's own screen asks this much of
 * them, so it never reads a song or a Gallery row to say "3 pieces".
 */
export function useSceneMusicCount(sceneId: string | undefined, storyId: string | undefined) {
  const db = useDrizzle();
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    if (!sceneId) {
      setCount(0);
      return;
    }
    try {
      setCount((await createSceneMusicService(db).getMusicForScene(sceneId)).length);
    } catch (error) {
      console.log('useSceneMusicCount: failed to count the music.', error);
      setCount(0);
    }
  }, [db, sceneId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no scene is given; everything else waits for `await`.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('scene_music_changed', onChange);
    return () => entityEventEmitter.off('scene_music_changed', onChange);
  }, [reload, storyId]);

  return count;
}
