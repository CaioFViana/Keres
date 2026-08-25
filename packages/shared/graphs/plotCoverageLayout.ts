/**
 * A cobertura de uma trama, quebrada por capítulo.
 *
 * Uma barra sólida diz *quanto* da história a trama percorre; ela não diz *onde*. Duas tramas
 * com 7/12 contam histórias diferentes se uma se concentra no primeiro ato e a outra atravessa
 * os três - e essa é justamente a pergunta que a cobertura existe para responder.
 *
 * Por isso a barra é dividida em pedaços, um por capítulo, na ordem narrativa: a largura total
 * continua sendo a cobertura, e a composição interna mostra de onde ela vem.
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
  /** Cenas do capítulo cobertas por esta trama. */
  covered: number;
  /** Fatia da barra inteira, em porcentagem do total de cenas da história. */
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
  /** Cenas ativas da história, com o capítulo de cada uma, em ordem narrativa. */
  scenes: { id: string; chapterId: string }[];
  /** Relações trama-cena vivas. */
  relations: { plotId: string; sceneId: string }[];
}

/**
 * Uma entrada por trama, na ordem em que as tramas chegaram, cada uma com seus pedaços na
 * ordem dos capítulos. Tramas sem cena nenhuma entram com a barra vazia: elas contam para a
 * média e some-las esconderia justamente o caso que precisa de atenção.
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
