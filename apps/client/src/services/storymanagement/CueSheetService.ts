import { type CueSheetRow, type SyllableLanguage, songSeconds, sungWords } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { chapters, scenes } from '../../db/schema';
import { sortScenesNarratively } from '../../utils/narrativeSceneOrder';
import { createGalleryService } from './GalleryService';
import { createSceneMusicService } from './SceneMusicService';
import { createSongService } from './SongService';

/**
 * The cue sheet of a story: one row for each piece of music of each scene, in the order the story is
 * read. A song's length comes from its tune when it has one and from its chords otherwise; its words
 * are those the scene sings. Built when asked for and never kept: the sheet is a document made for
 * one person to hand to another.
 */
export async function loadCueSheet(
  db: AppDrizzleClient,
  storyId: string,
  language: SyllableLanguage,
): Promise<CueSheetRow[]> {
  const links = await createSceneMusicService(db).getMusicForStory(storyId);
  if (links.length === 0) return [];

  const sceneRows = db
    .select()
    .from(scenes)
    .where(and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)))
    .all();
  const chapterRows = db
    .select()
    .from(chapters)
    .where(and(eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)))
    .all();
  const chapterName = new Map(chapterRows.map((chapter) => [chapter.id, chapter.name]));
  const ordered = sortScenesNarratively(sceneRows, chapterRows);
  const byScene = new Map<string, typeof links>();
  for (const link of links) {
    const list = byScene.get(link.sceneId) ?? [];
    list.push(link);
    byScene.set(link.sceneId, list);
  }

  const songService = createSongService(db);
  const galleryService = createGalleryService(db);
  const rows: CueSheetRow[] = [];

  for (const scene of ordered) {
    for (const link of byScene.get(scene.id) ?? []) {
      const base = {
        scene: scene.name,
        chapter: scene.chapterId ? (chapterName.get(scene.chapterId) ?? null) : null,
        cue: link.cue,
        role: link.role,
        sections: link.sections,
      };
      if (link.galleryId) {
        const medium = await galleryService.getById(link.galleryId).catch(() => undefined);
        const alive = medium && !medium.isDeleted ? medium : undefined;
        rows.push({
          ...base,
          music: alive ? (alive.title ?? alive.fileName) : null,
          kind: 'medium',
          reference: alive ? (alive.sourceUrl ?? alive.fileName) : null,
          key: null,
          tempo: null,
          meter: null,
          seconds: null,
          sections: null,
          lyrics: null,
        });
        continue;
      }
      const song = link.songId
        ? await songService.getById(link.songId).catch(() => undefined)
        : undefined;
      const alive = song && !song.isDeleted ? song : undefined;
      rows.push({
        ...base,
        music: alive?.title ?? null,
        kind: 'song',
        reference: null,
        key: alive?.key ?? null,
        tempo: alive?.tempo ?? null,
        meter: alive?.meter ?? null,
        seconds: alive ? songSeconds(alive, link.sections, language).seconds : null,
        // A soundtrack is not sung: its words are never part of what a scene says.
        lyrics: alive && link.role === 'in-world' ? sungWords(alive.lyrics, link.sections) : null,
      });
    }
  }
  return rows;
}
