import { inspectContiguousOneBasedIndexes } from '@keres/shared';
import { buildFinding, type StoryAnalysisFinding, type StoryAnalysisInput } from './types';

/**
 * A stretch that ends before it begins.
 *
 * The cycle detection this replaced existed because interval *relations* could contradict each other
 * in a loop. Anchors cannot: a stretch is two points on one axis, and the only way it can be wrong
 * is by running backwards - which a writer does by picking the two scenes in the wrong order, and
 * which nothing else in the app would notice.
 *
 * It is an integrity finding rather than an opinion: no arrangement of the story satisfies it.
 */
export function checkAnchorsRunForwards(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const anchors = input.chapterAnchors ?? [];
  if (anchors.length === 0) return [];

  /*
   * Narrative order, which is the only order the analysis has. Two scenes are compared by their
   * container's position and then their own - the same ordering the timeline draws.
   */
  const chapterIndex = new Map(input.chapters.map((chapter) => [chapter.id, chapter.index]));
  const positionOf = new Map(
    input.scenes.map((scene) => [
      scene.id,
      [
        scene.chapterId ? (chapterIndex.get(scene.chapterId) ?? 0) : Number.MAX_SAFE_INTEGER,
        scene.index,
      ] as const,
    ]),
  );
  const fraction: Record<string, number> = { start: 0, middle: 0.5, end: 1 };

  const findings: StoryAnalysisFinding[] = [];
  for (const anchor of anchors) {
    // An open stretch has no end to run backwards of: it is measured from the container's contents.
    if (!anchor.endSceneId || !anchor.endPosition) continue;
    const from = positionOf.get(anchor.startSceneId);
    const to = positionOf.get(anchor.endSceneId);
    // A scene the analysis was not given is not this check's business to report.
    if (!from || !to) continue;

    const backwards =
      to[0] < from[0] ||
      (to[0] === from[0] && to[1] < from[1]) ||
      (to[0] === from[0] &&
        to[1] === from[1] &&
        (fraction[anchor.endPosition] ?? 0) < (fraction[anchor.startPosition] ?? 0));
    if (!backwards) continue;

    const container = input.chapters.find((chapter) => chapter.id === anchor.chapterId);
    if (!container) continue;
    findings.push(
      buildFinding('scenes', 'warning', 'Chapter', container, 'analysis_anchor_backwards', {
        name: container.name,
      }),
    );
  }
  return findings;
}

/**
 * The numbering of chapters (1..N in the story) and of scenes (1..M within the chapter).
 *
 * It is not fussiness: the API refuses a reorder whose indices do not form a contiguous 1..N, so a
 * crooked numbering becomes a synchronization conflict the first time the person drags a scene
 * somewhere else. A repeat is worse than a hole - two scenes with the same number leave the story's
 * order undefined in the Reader, in the Matrix and in the conversion to branching.
 *
 * Linear stories only: that is where the indices' order is the reading order.
 */
export function checkNarrativeIndexes(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];

  /**
   * Only the spine is checked for being the story's 1..N.
   *
   * Events sit in the same collection with a numbering of their own, so measuring the two together
   * hands this `[1, 2, 3, 1, 2]` and accuses every story containing an event of corrupted
   * numbering - an integrity finding, which the gentler mode does not silence.
   */
  const spine = input.chapters.filter((chapter) => (chapter.type ?? 'chapter') === 'chapter');
  const chapterProblem = inspectContiguousOneBasedIndexes(spine.map((chapter) => chapter.index));
  if (chapterProblem && spine.length > 0) {
    findings.push(
      buildFinding(
        'scenes',
        'warning',
        'Chapter',
        spine[0]!,
        `analysis_chapter_index_${chapterProblem}`,
      ),
    );
  }

  /**
   * Scenes are checked inside **every** container, events included. How a war began, the war and
   * its aftermath are three scenes in an order that matters exactly as much as any chapter's - and
   * the API refuses a crooked reorder there for the same reason.
   */
  for (const chapter of input.chapters) {
    const chapterScenes = input.scenes.filter((scene) => scene.chapterId === chapter.id);
    if (chapterScenes.length === 0) continue;
    const sceneProblem = inspectContiguousOneBasedIndexes(
      chapterScenes.map((scene) => scene.index),
    );
    if (!sceneProblem) continue;
    findings.push(
      buildFinding(
        'scenes',
        'warning',
        'Chapter',
        chapter,
        `analysis_scene_index_${sceneProblem}`,
        {
          chapterName: chapter.name,
        },
      ),
    );
  }

  return findings;
}
