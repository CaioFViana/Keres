import type { GraphChapter, GraphChoice, GraphScene } from '@keres/shared/graphs/storyGraphLayout';
import { buildStoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';

/**
 * Sorts Item Journeys by the narrative position of each one's scene, not by `createdAt` (which is
 * only the instant the record was inserted, unrelated to the story's order).
 *
 * - Linear: `(chapter.index, scene.index)` - the same pair the rest of the app already treats as the
 *   canonical order (see `compareByStoryOrder` in `storyGraphLayout.ts`).
 * - Branching: the `layer` that `buildStoryGraphLayout` already computes for the Story Map screen
 *   (the distance in layers to the start, the longest path - not BFS/shortest path, on purpose:
 *   that guarantees a scene never appears before one of its prerequisites when two
 *   paths converge, which shortest-path does not guarantee). Zero change to `storyGraphLayout.ts`
 *   beyond consuming what it already exposes publicly.
 *
 * `createdAt` only comes in as the final tie-break (the same scene, or the same layer).
 */

interface OrderableItemJourney {
  sceneId: string;
  createdAt: Date;
}

export function orderItemJourneysByNarrative<T extends OrderableItemJourney>(
  journeys: T[],
  storyType: 'linear' | 'branching',
  scenes: GraphScene[],
  choices: GraphChoice[],
  chapters: GraphChapter[],
): T[] {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const chapterIndexById = new Map(chapters.map((chapter) => [chapter.id, chapter.index]));

  const layerBySceneId = new Map<string, number>();
  if (storyType === 'branching') {
    const layout = buildStoryGraphLayout(scenes, choices, chapters);
    for (const node of layout.nodes) {
      layerBySceneId.set(node.id, node.layer);
    }
  }

  const orderKey = (journey: T): [number, number, number, number] => {
    const scene = sceneById.get(journey.sceneId);
    const chapterIndex = scene
      ? (chapterIndexById.get(scene.chapterId) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
    const sceneIndex = scene?.index ?? Number.MAX_SAFE_INTEGER;
    // An unknown scene (a loose reference) falls to the end, along with the rest of what did not resolve.
    const layer =
      storyType === 'branching'
        ? (layerBySceneId.get(journey.sceneId) ?? Number.MAX_SAFE_INTEGER)
        : 0;
    return [layer, chapterIndex, sceneIndex, journey.createdAt.getTime()];
  };

  return [...journeys].sort((a, b) => {
    const keyA = orderKey(a);
    const keyB = orderKey(b);
    for (let i = 0; i < keyA.length; i++) {
      if (keyA[i] !== keyB[i]) {
        return keyA[i] - keyB[i];
      }
    }
    return 0;
  });
}
