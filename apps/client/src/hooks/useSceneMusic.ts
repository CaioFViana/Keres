import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SceneMusicSelect } from '@/src/db/schema';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { createSceneMusicService } from '@/src/services/storymanagement/SceneMusicService';
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
    };
  }
  return { music, targetKind: null, targetName: null, targetGone: true };
}

/**
 * A scene's music, in order, each with what it points at. Reloads when the music or the Gallery
 * change, so music whose file was deleted on another device turns into "removed".
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
    const events = ['scene_music_changed', 'gallery_changed'] as const;
    for (const event of events) entityEventEmitter.on(event, onChange);
    return () => {
      for (const event of events) entityEventEmitter.off(event, onChange);
    };
  }, [reload, storyId]);

  return { views, loading, reload };
}
