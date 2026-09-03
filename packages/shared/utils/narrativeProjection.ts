import {
  buildStoryGraphLayout,
  type GraphChapter,
  type GraphChoice,
  type GraphScene,
} from '../graphs/storyGraphLayout';

/** A screen must expose which ordering it is showing rather than implying every list is a path. */
export type NarrativePresentationOrder = 'narrative-order' | 'catalogue-order';

export interface NarrativeProjectionInput<
  Scene extends GraphScene,
  Choice extends GraphChoice,
  Chapter extends GraphChapter,
> {
  storyType: 'linear' | 'branching';
  scenes: Scene[];
  choices: Choice[];
  chapters: Chapter[];
}

export interface NarrativeProjection<Scene extends GraphScene, Choice extends GraphChoice> {
  /** Never call this a reading order unless `order` is `narrative-order`. */
  order: NarrativePresentationOrder;
  scenes: Scene[];
  /** A graph layer in branching stories. Linear scenes use their sequential position. */
  layerBySceneId: Map<string, number>;
  /** Consecutive linear scenes become display-only links. They are never persisted as Choices. */
  implicitEdges: Array<Pick<Choice, 'sceneId' | 'nextSceneId'>>;
}

/**
 * Gives every narrative-facing feature the same honest presentation order.
 *
 * Linear stories have one authored sequence. A branching graph does not, so its deterministic
 * catalogue order follows the Story Map's layers and uses chapter/index/name only as tie-breakers.
 */
export function buildNarrativeProjection<
  Scene extends GraphScene,
  Choice extends GraphChoice,
  Chapter extends GraphChapter,
>({
  storyType,
  scenes,
  choices,
  chapters,
}: NarrativeProjectionInput<Scene, Choice, Chapter>): NarrativeProjection<Scene, Choice> {
  const chapterIndex = new Map(chapters.map((chapter) => [chapter.id, chapter.index]));
  const compareByCatalogue = (a: Scene, b: Scene, layers: Map<string, number>) =>
    (layers.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (layers.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
    (a.chapterId
      ? (chapterIndex.get(a.chapterId) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER) -
      (b.chapterId
        ? (chapterIndex.get(b.chapterId) ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER) ||
    a.index - b.index ||
    a.name.localeCompare(b.name);

  if (storyType === 'linear') {
    const layers = new Map<string, number>();
    const ordered = [...scenes].sort((a, b) => compareByCatalogue(a, b, new Map()));
    ordered.forEach((scene, index) => layers.set(scene.id, index));
    return {
      order: 'narrative-order',
      scenes: ordered,
      layerBySceneId: layers,
      implicitEdges: ordered.slice(0, -1).map((scene, index) => ({
        sceneId: scene.id,
        nextSceneId: ordered[index + 1].id,
      })),
    };
  }

  const layout = buildStoryGraphLayout(scenes, choices, chapters);
  const layers = new Map(layout.nodes.map((node) => [node.id, node.layer]));
  return {
    order: 'catalogue-order',
    scenes: [...scenes].sort((a, b) => compareByCatalogue(a, b, layers)),
    layerBySceneId: layers,
    implicitEdges: [],
  };
}
