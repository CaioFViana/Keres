import {
  compileLinearManuscript,
  compileGamebookManuscript,
  type CompiledManuscript,
  type ManuscriptChoice,
} from './export/manuscriptCompiler';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  FORMAT_META,
  MAX_MANUSCRIPT_BYTES,
  ManuscriptOptionsSchema,
  type ManuscriptLabels,
  type ManuscriptOptions,
  type ManuscriptOptionsInput,
} from './manuscriptContracts';
import { renderManuscript } from './manuscriptRender';
import { sceneMatchesArc } from './manuscriptSections';
import { presentManuscript, renderOptionsOf, sceneSeparatorText } from './manuscriptStyle';
import type { ManuscriptChapter, ManuscriptScene } from './manuscriptSections';

export type CompileStoryManuscriptInput = {
  storyTitle: string;
  storyType: 'linear' | 'branching';
  chapters: ManuscriptChapter[];
  scenes: ManuscriptScene[];
  choices: ManuscriptChoice[];
  /** The story's arcs: an arc export is titled after its arc, as on the device. */
  arcs?: { id: string; title: string }[];
};

export type CompiledStoryManuscript = {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
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
  let compiled: CompiledManuscript;
  if (input.storyType === 'branching') {
    // The whole book, in the order asked. An arc keeps only its own scenes (scenes inherit their
    // chapter's arc), and its edge ends a choice.
    const chaptersById = new Map(input.chapters.map((chapter) => [chapter.id, chapter]));
    compiled = compileGamebookManuscript({
      title,
      scenes: input.scenes.filter((scene) => sceneMatchesArc(scene, chaptersById, parsed.arcId)),
      choices: input.choices,
      order: parsed.sceneOrder,
      seed: parsed.shuffleSeed,
      showSceneNames: parsed.includeSceneNames,
      endLabel: labels.endOfExcerpt,
      startLabels: { choose: labels.chooseStart, begin: labels.beginAt },
      sceneSeparator: sceneSeparatorText(parsed.style),
    });
  } else {
    compiled = compileLinearManuscript({
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
    });
  }
  return presentManuscript(
    compiled,
    parsed.style,
    parsed.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en',
  );
}

/**
 * Compiles a story's manuscript and renders it to bytes. Throws past `MAX_MANUSCRIPT_BYTES`.
 */
export async function compileStoryManuscript(
  input: CompileStoryManuscriptInput,
  options: ManuscriptOptionsInput,
): Promise<CompiledStoryManuscript> {
  const parsed = ManuscriptOptionsSchema.parse(options);
  const labels = { ...DEFAULT_MANUSCRIPT_LABELS, ...parsed.labels };
  const presented = presentedManuscriptOf(input, parsed, labels);
  const rendered = await renderManuscript(
    presented,
    parsed.format,
    labels,
    renderOptionsOf(parsed.style, parsed.includeToc),
    {
      author: parsed.author,
      identifier: parsed.identifier,
      language: parsed.language,
      modified: new Date(),
    },
  );
  const bytes = typeof rendered === 'string' ? new TextEncoder().encode(rendered) : rendered;
  if (bytes.length > MAX_MANUSCRIPT_BYTES) {
    throw new Error(
      `Manuscript exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit (${bytes.length} bytes).`,
    );
  }
  const meta = FORMAT_META[parsed.format];
  return { bytes, extension: meta.extension, mimeType: meta.mimeType };
}
