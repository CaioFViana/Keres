import {
  compileLinearManuscript,
  compileRouteManuscript,
  type CompiledManuscript,
  type ManuscriptChoice,
} from './export/manuscriptCompiler';
import { buildManuscriptDocxBytes } from './export/manuscriptDocx';
import { buildManuscriptHtml } from './export/manuscriptHtml';
import { buildManuscriptMarkdown, buildManuscriptText } from './export/manuscriptText';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  FORMAT_META,
  MAX_MANUSCRIPT_BYTES,
  ManuscriptOptionsSchema,
  type ManuscriptFormat,
  type ManuscriptLabels,
  type ManuscriptOptionsInput,
} from './manuscriptContracts';
import { sceneMatchesArc } from './manuscriptSections';
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
};

export type CompiledStoryManuscript = {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
};

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function renderBytes(
  compiled: CompiledManuscript,
  format: ManuscriptFormat,
  labels: ManuscriptLabels,
): Promise<Uint8Array> {
  switch (format) {
    case 'docx':
      return buildManuscriptDocxBytes(compiled, labels);
    case 'md':
      return encodeText(buildManuscriptMarkdown(compiled, labels));
    case 'txt':
      return encodeText(buildManuscriptText(compiled, labels));
    case 'html':
      return encodeText(buildManuscriptHtml(compiled, labels));
  }
}

/**
 * Compiles a story's manuscript and renders it to bytes. A `routeId` selects
 * the route order (branching stories); without one the linear order is used.
 * An `arcId` keeps only that arc's containers and scenes in either order.
 * Throws on an unknown route or past `MAX_MANUSCRIPT_BYTES`.
 */
export async function compileStoryManuscript(
  input: CompileStoryManuscriptInput,
  options: ManuscriptOptionsInput,
): Promise<CompiledStoryManuscript> {
  const parsed = ManuscriptOptionsSchema.parse(options);
  const labels = { ...DEFAULT_MANUSCRIPT_LABELS, ...parsed.labels };
  let compiled: CompiledManuscript;
  if (parsed.routeId !== undefined) {
    const route = (input.routes ?? []).find((candidate) => candidate.id === parsed.routeId);
    if (!route) throw new Error(`Unknown route "${parsed.routeId}".`);
    const steps = (input.routeSteps ?? []).filter((step) => step.routeId === route.id);
    // Routes have no arc of their own; their scenes inherit their chapter's. Steps
    // pointing at a filtered-out scene vanish, like steps pointing at a deleted one.
    const chaptersById = new Map(input.chapters.map((chapter) => [chapter.id, chapter]));
    compiled = compileRouteManuscript({
      title: input.storyTitle,
      routeName: route.name,
      steps,
      scenes: input.scenes.filter((scene) => sceneMatchesArc(scene, chaptersById, parsed.arcId)),
      choices: input.choices,
      looseHeadingLabel: labels.looseHeading,
    });
  } else {
    compiled = compileLinearManuscript({
      title: input.storyTitle,
      chapters: input.chapters,
      scenes: input.scenes,
      choices: input.choices,
      includeLooseScenes: parsed.includeLooseScenes,
      looseHeadingLabel: labels.looseHeading,
      arcId: parsed.arcId,
    });
  }
  const bytes = await renderBytes(compiled, parsed.format, labels);
  if (bytes.length > MAX_MANUSCRIPT_BYTES) {
    throw new Error(
      `Manuscript exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit (${bytes.length} bytes).`,
    );
  }
  const meta = FORMAT_META[parsed.format];
  return { bytes, extension: meta.extension, mimeType: meta.mimeType };
}
