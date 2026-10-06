import type { LocationIntExt } from '../../entities/Location';
import { withoutLooseSections } from '../compile/export/manuscriptCompiler';
import {
  linearManuscriptSections,
  type ManuscriptChapter,
  type ManuscriptScene,
} from '../compile/manuscriptSections';

/*
 * Fountain (https://fountain.io) is plain text that reads like a screenplay: a scene heading starts
 * with INT./EXT., a character cue is in capitals, and dialogue follows it. A scene's `body` in a
 * screenplay is written in it; this file only *assembles* the whole script from the scenes - it never
 * rewrites what the writer typed. Reading it back is `fountainParser.ts`; paging it is
 * `screenplayLayout.ts`.
 */

/** A place as a scene heading needs it. */
export type FountainLocation = { name: string; intExt: LocationIntExt | null };

/** A scene with what the script needs beyond the manuscript's own few fields. */
export type FountainScene = ManuscriptScene & {
  /** The scene's summary: it becomes a synopsis line, never printed. */
  summary?: string | null;
  location?: FountainLocation | null;
};

export type FountainTitlePage = {
  title?: string | null;
  credit?: string | null;
  author?: string | null;
  source?: string | null;
  draftDate?: string | null;
  contact?: string | null;
};

export type CompileFountainInput = {
  /** The title when the title page does not name one. */
  title: string;
  chapters: ManuscriptChapter[];
  scenes: FountainScene[];
};

export type FountainOptions = {
  /** Only this work's containers and scenes. */
  arcId?: string | null;
  /** Scenes filed in no chapter (or in an event container). Off by default, as in every export. */
  includeLooseScenes?: boolean;
  /** Writes `INT. PLACE` from the scene's location when the text has no heading of its own. */
  generateHeadings?: boolean;
  /** One `#` section per chapter (Fountain's outline levels; never printed). */
  includeSections?: boolean;
  /** One `=` synopsis per scene from its summary (never printed). */
  includeSynopses?: boolean;
  /** Numbers the headings `#1#`, `#2#`... in reading order. */
  numberScenes?: boolean;
  /** `false` leaves the title page out. */
  titlePage?: FountainTitlePage | false;
};

export type CompiledFountain = {
  text: string;
  sceneCount: number;
  /** How many headings were written from a location rather than found in the text. */
  generatedHeadings: number;
};

export const INT_EXT_PREFIX: Record<LocationIntExt, string> = {
  interior: 'INT.',
  exterior: 'EXT.',
  both: 'INT./EXT.',
};

/**
 * What Fountain accepts as a scene heading: INT, EXT, EST, INT./EXT, INT/EXT or I/E followed by a dot
 * or a space - or any line forced with a leading period (not an ellipsis).
 */
const SCENE_HEADING = /^(?:\.(?=[^.\s])|(?:INT|EXT|EST|INT\.?\/EXT|I\/E)(?:\.|\s))/i;

export function isFountainSceneHeading(line: string): boolean {
  return SCENE_HEADING.test(line.trim());
}

/** Whether the first line that says anything is already a scene heading. */
export function startsWithSceneHeading(body: string | null | undefined): boolean {
  const first = (body ?? '').split(/\r\n|\r|\n/).find((line) => line.trim() !== '');
  return first !== undefined && isFountainSceneHeading(first);
}

/**
 * The heading a location writes: `INT. KITCHEN`, or - with no interior/exterior to say - the name
 * forced as a heading (`.KITCHEN`). `null` when the scene has no place.
 */
export function headingFromLocation(location: FountainLocation | null | undefined): string | null {
  const name = location?.name.replace(/\s+/g, ' ').trim();
  if (!location || !name) return null;
  const prefix = location.intExt ? INT_EXT_PREFIX[location.intExt] : null;
  return prefix ? `${prefix} ${name.toUpperCase()}` : `.${name.toUpperCase()}`;
}

export type SceneHeadingSource = 'body' | 'location' | 'none';

/**
 * Where a scene's heading comes from: the writer's own first line wins over a generated one, which
 * needs a place. The screens use it to say so out loud.
 */
export function sceneHeadingPlan(scene: Pick<FountainScene, 'body' | 'location'>): {
  source: SceneHeadingSource;
  heading: string | null;
} {
  if (startsWithSceneHeading(scene.body)) {
    const first = (scene.body ?? '').split(/\r\n|\r|\n/).find((line) => line.trim() !== '');
    return { source: 'body', heading: first?.trim() ?? null };
  }
  const generated = headingFromLocation(scene.location);
  return generated ? { source: 'location', heading: generated } : { source: 'none', heading: null };
}

const SCENE_NUMBER_SUFFIX = /\s#[^#\n]+#\s*$/;

/** Adds ` #n#` to a heading line, unless the writer already numbered it. */
export function withSceneNumber(heading: string, number: number): string {
  return SCENE_NUMBER_SUFFIX.test(heading) ? heading : `${heading} #${number}#`;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n|\r/g, '\n');
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function titlePageBlock(page: FountainTitlePage, fallbackTitle: string): string | null {
  const entries: [string, string | null | undefined][] = [
    ['Title', page.title || fallbackTitle],
    ['Credit', page.credit],
    ['Author', page.author],
    ['Source', page.source],
    ['Draft date', page.draftDate],
    ['Contact', page.contact],
  ];
  const lines: string[] = [];
  for (const [key, value] of entries) {
    const text = value?.trim();
    if (!text) continue;
    const parts = normalizeNewlines(text)
      .split('\n')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 1) {
      lines.push(`${key}: ${parts[0]}`);
    } else {
      // A value of several lines is indented under its key, as the spec asks.
      lines.push(`${key}:`, ...parts.map((part) => `    ${part}`));
    }
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Assembles the screenplay in Fountain: an optional title page, a section per chapter, and for every
 * scene its heading (the writer's own, or one written from its location), a synopsis from its summary
 * and the text exactly as typed. A linear story only: the order is the chapters', never a path
 * through a branching one.
 */
export function compileFountain(
  input: CompileFountainInput,
  options: FountainOptions = {},
): CompiledFountain {
  const {
    arcId = null,
    includeLooseScenes = false,
    generateHeadings = true,
    includeSections = true,
    includeSynopses = true,
    numberScenes = false,
    titlePage = {},
  } = options;
  const chaptersById = new Map(input.chapters.map((chapter) => [chapter.id, chapter]));
  const scenesById = new Map(input.scenes.map((scene) => [scene.id, scene]));
  let sections = linearManuscriptSections(input.chapters, input.scenes, { arcId });
  if (!includeLooseScenes) sections = withoutLooseSections(sections, chaptersById);

  const blocks: string[] = [];
  if (titlePage !== false) {
    const block = titlePageBlock(titlePage, input.title);
    if (block) blocks.push(block);
  }

  let sceneCount = 0;
  let generatedHeadings = 0;
  for (const section of sections) {
    if (section.kind === 'container') {
      if (includeSections && section.name.trim()) blocks.push(`# ${oneLine(section.name)}`);
      continue;
    }
    if (section.kind !== 'scene') continue;
    const scene = scenesById.get(section.scene.id) as FountainScene;
    sceneCount += 1;
    const body = normalizeNewlines(scene.body ?? '').trim();
    const plan = sceneHeadingPlan(scene);

    let heading: string | null = null;
    let text = body;
    if (plan.source === 'body') {
      // The writer's own heading stays where it is; at most it gets its number.
      if (numberScenes) {
        const lines = body.split('\n');
        const at = lines.findIndex((line) => line.trim() !== '');
        lines[at] = withSceneNumber(lines[at].trim(), sceneCount);
        text = lines.join('\n');
      }
    } else if (plan.source === 'location' && generateHeadings) {
      generatedHeadings += 1;
      heading = numberScenes ? withSceneNumber(plan.heading!, sceneCount) : plan.heading;
    }

    if (heading) blocks.push(heading);
    const synopsis = includeSynopses ? oneLine(scene.summary ?? '') : '';
    if (synopsis) blocks.push(`= ${synopsis}`);
    if (text) blocks.push(text);
  }

  return { text: `${blocks.join('\n\n')}\n`, sceneCount, generatedHeadings };
}
