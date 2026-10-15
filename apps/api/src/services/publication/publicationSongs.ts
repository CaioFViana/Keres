import {
  compareRanked,
  type CompileStoryReaderInput,
  type FullStoryExportType,
  type ManuscriptSceneMusic,
} from '@keres/shared';

/**
 * Gives the compile input the songs its scenes sing, when the publication prints songs.
 *
 * Only a song of the story that is sung *in* it reaches a publication, and only its words: the title,
 * the lyrics, their translation and the sections the scene names. A recording or a link of the Gallery
 * is the writer's own reference and is never published, nor is the score a scene has, nor the notes
 * about when a piece comes in - none of them is read here at all.
 */
export function withSceneSongs(
  input: CompileStoryReaderInput,
  storyExport: FullStoryExportType,
  options: { includeSongs?: boolean },
): CompileStoryReaderInput {
  if (!options.includeSongs) return input;
  const songs = new Map(
    (storyExport.songs ?? []).filter((song) => !song.isDeleted).map((song) => [song.id, song]),
  );
  if (songs.size === 0) return input;

  const bySceneId = new Map<string, ManuscriptSceneMusic[]>();
  const sung = (storyExport.sceneMusic ?? [])
    .filter((music) => !music.isDeleted && music.role === 'in-world' && music.songId)
    .sort(compareRanked);
  for (const music of sung) {
    const song = music.songId ? songs.get(music.songId) : undefined;
    if (!song) continue;
    const list = bySceneId.get(music.sceneId) ?? [];
    list.push({
      id: music.id,
      role: 'in-world',
      title: song.title,
      cue: null,
      song: {
        id: song.id,
        title: song.title,
        lyrics: song.lyrics,
        lyricsTranslation: song.lyricsTranslation,
        sections: music.sections,
      },
    });
    bySceneId.set(music.sceneId, list);
  }
  if (bySceneId.size === 0) return input;

  return {
    ...input,
    scenes: input.scenes.map((scene) => {
      const music = bySceneId.get(scene.id);
      return music ? { ...scene, music } : scene;
    }),
  };
}
