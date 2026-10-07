import { buildFinding, type StoryAnalysisFinding, type StoryAnalysisInput } from './types';

/**
 * The music of the scenes: what a link points at, and whether it is still there.
 *
 * Both are integrity - a reference that points at nothing, a link that says two things at once - so
 * they are on whatever the story is for. They are anchored on the scene, which the writer can open,
 * rather than on the link, which has no screen of its own. Cheap by construction: they read the links
 * and one flag each, which the service resolves from the ids it already holds.
 */
export function checkSceneMusic(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const sceneById = new Map(input.scenes.map((scene) => [scene.id, scene]));

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
          : null;
    // One finding per link: a scene with two broken ones lists both, under keys that do not collide.
    if (found) findings.push({ ...found, id: `${found.id}:${music.id}` });
  }
  return findings;
}
