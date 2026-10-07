import type { ManuscriptSceneMusic } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import { createGalleryService } from './GalleryService';
import { createSceneMusicService } from './SceneMusicService';

/**
 * The music of a story's scenes, ready for a manuscript: each piece named by what it points at (the
 * title of the medium, or its file name), and `null` where that is gone. Only the scenes in
 * `sceneIds` when given.
 */
export async function loadManuscriptMusic(
  db: AppDrizzleClient,
  storyId: string,
  sceneIds?: ReadonlySet<string>,
): Promise<Map<string, ManuscriptSceneMusic[]>> {
  const rows = (await createSceneMusicService(db).getMusicForStory(storyId)).filter(
    (music) => !sceneIds || sceneIds.has(music.sceneId),
  );
  const galleryService = createGalleryService(db);
  const titles = new Map<string, string | null>();
  const titleOf = async (galleryId: string): Promise<string | null> => {
    if (!titles.has(galleryId)) {
      const row = await galleryService.getById(galleryId).catch(() => undefined);
      titles.set(galleryId, row && !row.isDeleted ? (row.title ?? row.fileName) : null);
    }
    return titles.get(galleryId) ?? null;
  };

  const byScene = new Map<string, ManuscriptSceneMusic[]>();
  for (const music of rows) {
    const list = byScene.get(music.sceneId) ?? [];
    list.push({
      id: music.id,
      role: music.role,
      title: music.galleryId ? await titleOf(music.galleryId) : null,
      cue: music.cue,
    });
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

/** Whether any scene of the story has music: what decides whether an export has anything to offer. */
export async function storyHasMusic(db: AppDrizzleClient, storyId: string): Promise<boolean> {
  return (await createSceneMusicService(db).getMusicForStory(storyId)).length > 0;
}
