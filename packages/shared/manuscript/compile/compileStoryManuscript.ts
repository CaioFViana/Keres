import {
  compileLinearManuscript,
  compileRouteManuscript,
  type CompiledManuscript,
  type ManuscriptChoice,
} from './export/manuscriptCompiler';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  FORMAT_META,
  MAX_MANUSCRIPT_BYTES,
  ManuscriptOptionsSchema,
  type ManuscriptOptionsInput,
} from './manuscriptContracts';
import { renderManuscript } from './manuscriptRender';
import { sceneMatchesArc } from './manuscriptSections';
import { presentManuscript, renderOptionsOf, sceneSeparatorText } from './manuscriptStyle';
import type { ManuscriptChapter, ManuscriptRouteStep, ManuscriptScene } from './manuscriptSections';

/** The minimum the entry needs to know about a route. */
export interface ManuscriptRoute {
  id: string;
  name: string;
}

export type CompileStoryManuscriptInput = {
  storyTitle: string;
  storyType: 'linear' | 'branching';
  chapters: ManuscriptChapter[];
  scenes: ManuscriptScene[];
  choices: ManuscriptChoice[];
  routes?: ManuscriptRoute[];
  routeSteps?: ManuscriptRouteStep[];
  /** The story's arcs: an arc export is titled after its arc, as on the device. */
  arcs?: { id: string; title: string }[];
};

export type CompiledStoryManuscript = {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
};

/**
 * Compiles a story's manuscript and renders it to bytes. A `routeId` selects
 * the route order (branching stories); without one the linear order is used.
 * An `arcId` keeps only that arc's containers and scenes in either order, under the arc's title.
 * Throws on an unknown route or past `MAX_MANUSCRIPT_BYTES`.
 */
export async function compileStoryManuscript(
  input: CompileStoryManuscriptInput,
  options: ManuscriptOptionsInput,
): Promise<CompiledStoryManuscript> {
  const parsed = ManuscriptOptionsSchema.parse(options);
  const labels = { ...DEFAULT_MANUSCRIPT_LABELS, ...parsed.labels };
  const title =
    (parsed.arcId && input.arcs?.find((arc) => arc.id === parsed.arcId)?.title) || input.storyTitle;
  let compiled: CompiledManuscript;
  if (parsed.routeId !== undefined) {
    const route = (input.routes ?? []).find((candidate) => candidate.id === parsed.routeId);
    if (!route) throw new Error(`Unknown route "${parsed.routeId}".`);
    const steps = (input.routeSteps ?? []).filter((step) => step.routeId === route.id);
    // Routes have no arc of their own; their scenes inherit their chapter's. Steps
    // pointing at a filtered-out scene vanish, like steps pointing at a deleted one.
    const chaptersById = new Map(input.chapters.map((chapter) => [chapter.id, chapter]));
    compiled = compileRouteManuscript({
      title,
      routeName: route.name,
      steps,
      scenes: input.scenes.filter((scene) => sceneMatchesArc(scene, chaptersById, parsed.arcId)),
      choices: input.choices,
      looseHeadingLabel: labels.looseHeading,
      includeSceneNames: parsed.includeSceneNames,
      resetSceneNumbersPerChapter: parsed.resetSceneNumbers,
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
  const presented = presentManuscript(
    compiled,
    parsed.style,
    parsed.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en',
  );
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
