import type { ManuscriptOptions } from '../compile/manuscriptContracts';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  FORMAT_META,
  MAX_MANUSCRIPT_BYTES,
  ScreenplayOptionsSchema,
} from '../compile/manuscriptContracts';
import type { CompileStoryManuscriptInput } from '../compile/presentedManuscript';
import { compileFountain, type FountainScene } from './fountain';
import { screenplayPdfFromFountain } from './screenplayPdf';

export type CompiledScreenplay = {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
  /** Script pages the PDF holds (or would hold, for the Fountain text), title page not counted. */
  pages: number;
};

/** What the title page says "written by" in the language of the text. */
function creditLabel(language: string | undefined): string {
  return language?.toLowerCase().startsWith('pt') ? 'Escrito por' : 'Written by';
}

/** The script as Fountain text, built from the same input the book formats compile from. */
export function screenplayFountainOf(
  input: CompileStoryManuscriptInput,
  options: ManuscriptOptions,
): { text: string; sceneCount: number; generatedHeadings: number } {
  const screenplay = options.screenplay ?? ScreenplayOptionsSchema.parse({});
  const title =
    (options.arcId && input.arcs?.find((arc) => arc.id === options.arcId)?.title) ||
    input.storyTitle;
  const author = options.author?.trim() || null;
  const scenes: FountainScene[] = input.scenes.map((scene) => ({
    ...scene,
    location: scene.locationName?.trim()
      ? { name: scene.locationName, intExt: scene.locationIntExt ?? null }
      : null,
  }));
  return compileFountain(
    { title, chapters: input.chapters, scenes },
    {
      arcId: options.arcId ?? null,
      includeLooseScenes: options.includeLooseScenes,
      generateHeadings: screenplay.generateHeadings,
      includeSections: screenplay.includeSections,
      includeSynopses: screenplay.includeSynopses,
      includeMusicNotes: screenplay.includeMusicNotes,
      musicLabel: options.labels?.musicLabel ?? DEFAULT_MANUSCRIPT_LABELS.musicLabel,
      numberScenes: screenplay.numberScenes,
      titlePage: {
        title,
        credit: screenplay.credit ?? (author ? creditLabel(options.language) : null),
        author,
        source: screenplay.source,
        draftDate: screenplay.draftDate,
        contact: screenplay.contact,
      },
    },
  );
}

/**
 * A screenplay in one of its two formats: Fountain text, or the PDF paged as the industry sets it.
 * Throws past `MAX_MANUSCRIPT_BYTES`, like every manuscript.
 */
export function compileScreenplayManuscript(
  input: CompileStoryManuscriptInput,
  options: ManuscriptOptions,
): CompiledScreenplay {
  const screenplay = options.screenplay ?? ScreenplayOptionsSchema.parse({});
  const fountain = screenplayFountainOf(input, options);
  const meta = FORMAT_META[options.format];
  let bytes: Uint8Array;
  let pages: number;
  if (options.format === 'screenplay-pdf') {
    const rendered = screenplayPdfFromFountain(fountain.text, { paper: screenplay.paper });
    bytes = rendered.bytes;
    pages = rendered.pages;
  } else {
    bytes = new TextEncoder().encode(fountain.text);
    pages = 0;
  }
  if (bytes.length > MAX_MANUSCRIPT_BYTES) {
    throw new Error(
      `Manuscript exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit (${bytes.length} bytes).`,
    );
  }
  return { bytes, extension: meta.extension, mimeType: meta.mimeType, pages };
}
