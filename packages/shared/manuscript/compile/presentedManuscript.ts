import {
  compileLinearManuscript,
  compileGamebookManuscript,
  type CompiledBlock,
  type CompiledManuscript,
  type ManuscriptChoice,
} from './export/manuscriptCompiler';
import type { ManuscriptLabels, ManuscriptOptions } from './manuscriptContracts';
import { sceneMatchesArc } from './manuscriptSections';
import type { ManuscriptChapter, ManuscriptScene } from './manuscriptSections';
import {
  blockPresenterFor,
  finishPresentedManuscript,
  sceneSeparatorText,
} from './manuscriptStyle';

/*
 * The half of the manuscript pipeline that needs no renderer: the blocks, presented as the options
 * ask. It sits apart from `compileStoryManuscript` because that one renders to DOCX/EPUB, and the
 * renderers bring `docx` and `jszip` with them - the online reader and every app that only reads
 * the blocks should not pay for libraries they never call.
 */

export type CompileStoryManuscriptInput = {
  storyTitle: string;
  storyType: 'linear' | 'branching';
  chapters: ManuscriptChapter[];
  scenes: ManuscriptScene[];
  choices: ManuscriptChoice[];
  /** The story's arcs: an arc export is titled after its arc, as on the device. */
  arcs?: { id: string; title: string }[];
};

/**
 * The story's manuscript as blocks, presented as the options ask: a linear story in chapter order,
 * a branching one as a gamebook (every scene, the ones reachable from a start first, numbered by
 * `sceneOrder`). An `arcId` keeps only that arc's containers and scenes in either order, under
 * the arc's title. Every renderer (and the online reader) starts from here.
 */
export function presentedManuscriptOf(
  input: CompileStoryManuscriptInput,
  parsed: ManuscriptOptions,
  labels: ManuscriptLabels,
): CompiledManuscript {
  const title =
    (parsed.arcId && input.arcs?.find((arc) => arc.id === parsed.arcId)?.title) || input.storyTitle;
  // Fused path: each block is presented at creation, so the parsed inlines
  // never survive beside a second full copy of the spans. Identical blocks
  // either way (each block is independent); only the tail (front matter and
  // title fill) still runs over the finished array.
  const language = parsed.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  const present = blockPresenterFor(parsed.style, language);
  let blocks: CompiledBlock[];
  if (input.storyType === 'branching') {
    // The whole book, in the order asked. An arc keeps only its own scenes (scenes inherit their
    // chapter's arc), and its edge ends a choice.
    const chaptersById = new Map(input.chapters.map((chapter) => [chapter.id, chapter]));
    blocks = compileGamebookManuscript({
      title,
      scenes: input.scenes.filter((scene) => sceneMatchesArc(scene, chaptersById, parsed.arcId)),
      choices: input.choices,
      order: parsed.sceneOrder,
      seed: parsed.shuffleSeed,
      showSceneNames: parsed.includeSceneNames,
      endLabel: labels.endOfExcerpt,
      startLabels: { choose: labels.chooseStart, begin: labels.beginAt },
      sceneSeparator: sceneSeparatorText(parsed.style),
      present,
    }).blocks;
  } else {
    blocks = compileLinearManuscript({
      title,
      chapters: input.chapters,
      scenes: input.scenes,
      choices: input.choices,
      includeLooseScenes: parsed.includeLooseScenes,
      looseHeadingLabel: labels.looseHeading,
      arcId: parsed.arcId,
      includeSceneNames: parsed.includeSceneNames,
      resetSceneNumbersPerChapter: parsed.resetSceneNumbers,
      sceneSeparator: sceneSeparatorText(parsed.style),
      present,
    }).blocks;
  }
  return finishPresentedManuscript(title, blocks, parsed.style);
}
