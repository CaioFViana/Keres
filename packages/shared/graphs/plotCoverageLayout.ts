/**
 * A plot's coverage, broken down by chapter.
 *
 * A solid bar says *how much* of the story a plot runs through; it does not say *where*. Two plots
 * at 7/12 tell different stories if one is concentrated in the first act and the other crosses all
 * three - and that is exactly the question coverage exists to answer.
 *
 * That is why the bar is split into pieces, one per chapter, in narrative order: the total width is
 * still the coverage, and the internal composition shows where it comes from.
 */

export interface CoverageChapter {
  id: string;
  name: string;
  color: string;
}

export interface CoverageSegment {
  chapterId: string;
  chapterName: string;
  color: string;
  /** Scenes of the chapter covered by this plot. */
  covered: number;
  /** A slice of the whole bar, as a percentage of the story's total scenes. */
  percentage: number;
}

export interface PlotCoverageEntry {
  id: string;
  name: string;
  covered: number;
  total: number;
  percentage: number;
  segments: CoverageSegment[];
}

export interface PlotCoverageInput {
  plots: { id: string; name: string }[];
  chapters: CoverageChapter[];
  /** The story's active scenes, each with its chapter, in narrative order. */
  scenes: { id: string; chapterId: string }[];
  /** Live plot-scene relations. */
  relations: { plotId: string; sceneId: string }[];
}

/**
 * One entry per plot, in the order the plots arrived, each with its pieces in chapter order.
 * Plots with no scene at all come in with an empty bar: they count towards the average, and hiding
 * them would hide exactly the case that needs attention.
 */
export function buildPlotCoverage(input: PlotCoverageInput): PlotCoverageEntry[] {
  const total = input.scenes.length;
  const chapterOfScene = new Map(input.scenes.map((scene) => [scene.id, scene.chapterId]));
  const percentOf = (count: number) => (total ? Math.round((count / total) * 100) : 0);

  return input.plots.map((plot) => {
    const coveredScenes = input.relations
      .filter((relation) => relation.plotId === plot.id)
      .map((relation) => chapterOfScene.get(relation.sceneId))
      .filter((chapterId): chapterId is string => chapterId !== undefined);

    const perChapter = new Map<string, number>();
    for (const chapterId of coveredScenes) {
      perChapter.set(chapterId, (perChapter.get(chapterId) ?? 0) + 1);
    }

    const segments = input.chapters
      .filter((chapter) => (perChapter.get(chapter.id) ?? 0) > 0)
      .map((chapter) => {
        const covered = perChapter.get(chapter.id) ?? 0;
        return {
          chapterId: chapter.id,
          chapterName: chapter.name,
          color: chapter.color,
          covered,
          percentage: percentOf(covered),
        };
      });

    return {
      id: plot.id,
      name: plot.name,
      covered: coveredScenes.length,
      total,
      percentage: percentOf(coveredScenes.length),
      segments,
    };
  });
}
