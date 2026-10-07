import {
  buildFinding,
  type AnalysisSong,
  type StoryAnalysisFinding,
  type StoryAnalysisInput,
} from './types';

/**
 * The music of the scenes: what a link points at, and whether it is still there.
 *
 * Both are integrity - a reference that points at nothing, a link that says two things at once - so
 * they are on whatever the story is for. They are anchored on the scene, which the writer can open,
 * rather than on the link, which has no screen of its own. Cheap by construction: they read the links
 * and one flag each, which the service resolves from the ids it already holds.
 *
 * A link that names sections of a song is also held to the song: what it names must still be there.
 * When only some are gone the rest are printed; when all are, the whole song is - the writer is told
 * either way, because a quiet change in what the book prints is the worse failure.
 */
export function checkSceneMusic(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const sceneById = new Map(input.scenes.map((scene) => [scene.id, scene]));
  const songById = new Map((input.songs ?? []).map((song) => [song.id, song]));

  for (const music of input.sceneMusic ?? []) {
    const scene = sceneById.get(music.sceneId);
    // A link of a scene that is not there is the scene's own problem, and the link goes with it.
    if (!scene) continue;
    const ref = { id: scene.id, name: scene.name };
    const found =
      music.songId && music.galleryId
        ? buildFinding('music', 'error', 'Scene', ref, 'analysis_music_two_targets')
        : !music.targetAlive
          ? buildFinding('music', 'warning', 'Scene', ref, 'analysis_music_target_gone')
          : sectionsGone(music.songId, music.sections, songById, ref);
    // One finding per link: a scene with two broken ones lists both, under keys that do not collide.
    if (found) findings.push({ ...found, id: `${found.id}:${music.id}` });
  }
  return findings;
}

function sectionsGone(
  songId: string | null,
  named: string[] | null | undefined,
  songById: Map<string, AnalysisSong>,
  scene: { id: string; name: string },
): StoryAnalysisFinding | null {
  const song = songId ? songById.get(songId) : undefined;
  // Labels not read means no scene names a section of this song: nothing to hold it to.
  if (!song?.sectionLabels || !named || named.length === 0) return null;
  const labels = new Set(song.sectionLabels);
  const gone = named.filter((label) => !labels.has(label));
  if (gone.length === 0) return null;
  return gone.length === named.length
    ? buildFinding('music', 'warning', 'Scene', scene, 'analysis_music_sections_all_gone', {
        song: song.title,
      })
    : buildFinding('music', 'warning', 'Scene', scene, 'analysis_music_sections_gone', {
        song: song.title,
        sections: gone.join(', '),
      });
}

/** The labels of a list, once each, in the order first met. */
const distinct = (labels: readonly string[]) => [...new Set(labels)];

/**
 * What is wrong inside a song, as far as the scenes and the book are concerned. Anchored on the song.
 *
 * - A label written twice that a scene names: the scene cannot say which part it sings.
 * - A translation whose sections do not match the lyrics: where one has no counterpart, the sung
 *   words are printed in its place, which is not what asking for the translation meant.
 */
export function checkSongs(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const namedBy = new Map<string, Set<string>>();
  for (const music of input.sceneMusic ?? []) {
    if (!music.songId || !music.sections) continue;
    const named = namedBy.get(music.songId) ?? new Set<string>();
    for (const label of music.sections) named.add(label);
    namedBy.set(music.songId, named);
  }

  for (const song of input.songs ?? []) {
    const labels = song.sectionLabels;
    if (!labels) continue;

    const named = namedBy.get(song.id);
    if (named) {
      const seen = new Set<string>();
      const repeated = new Set<string>();
      for (const label of labels) {
        if (seen.has(label)) repeated.add(label);
        seen.add(label);
      }
      const ambiguous = [...repeated].filter((label) => named.has(label));
      if (ambiguous.length > 0) {
        findings.push(
          buildFinding(
            'music',
            'warning',
            'Song',
            { id: song.id, name: song.title },
            'analysis_song_duplicate_sections',
            {
              sections: ambiguous.join(', '),
            },
          ),
        );
      }
    }

    if (song.translationLabels) {
      const lyrics = new Set(labels);
      const translation = new Set(song.translationLabels);
      const apart = [
        ...distinct(labels).filter((label) => !translation.has(label)),
        ...distinct(song.translationLabels).filter((label) => !lyrics.has(label)),
      ];
      if (apart.length > 0) {
        findings.push(
          buildFinding(
            'music',
            'warning',
            'Song',
            { id: song.id, name: song.title },
            'analysis_song_translation_mismatch',
            {
              sections: apart.join(', '),
            },
          ),
        );
      }
    }
  }
  return findings;
}

/** A song no scene sings. Completeness: a song may be written ahead of the scene that will use it. */
export function checkUnusedSongs(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const sung = new Set(
    (input.sceneMusic ?? []).flatMap((music) => (music.songId ? [music.songId] : [])),
  );
  return (input.songs ?? [])
    .filter((song) => !sung.has(song.id))
    .map((song) =>
      buildFinding(
        'music',
        'warning',
        'Song',
        { id: song.id, name: song.title },
        'analysis_song_unused',
      ),
    );
}
