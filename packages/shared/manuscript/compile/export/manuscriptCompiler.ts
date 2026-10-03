import {
  isLooseScene,
  linearManuscriptSections,
  gamebookManuscriptSections,
  gamebookStartScenes,
  type GamebookOrder,
  type ManuscriptChapter,
  type ManuscriptScene,
  type ManuscriptSection,
} from '../manuscriptSections';
import { parseManuscriptMarkdown } from '../parseManuscriptMarkdown';

/** The minimum the pipeline needs to know about a choice. */
export interface ManuscriptChoice {
  id: string;
  sceneId: string;
  nextSceneId: string;
  text: string;
  /**
   * Pre-rendered requirement lines derived from the choice's check groups (localized by
   * the caller, which owns names and locale). Absent or empty when the choice is open.
   */
  requirements?: string[];
  /** Pre-rendered effect lines for taking this choice; absent or empty when it changes nothing. */
  effects?: string[];
}

export type CompiledSpan = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
};

export type CompiledBlock =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'chapter'; id: string; number: number | null; name: string; bookmarkId: string }
  | {
      kind: 'scene-heading';
      id: string;
      number: number;
      name: string;
      /** Null when this scene already contributed its bookmark (route loops). */
      bookmarkId: string | null;
    }
  | { kind: 'loose-heading'; label: string; bookmarkId: string }
  | { kind: 'paragraph'; spans: CompiledSpan[] }
  /** One bulleted list item; consecutive items group into one list per renderer. */
  | { kind: 'bullet'; spans: CompiledSpan[] }
  /** One numbered list item; renderers number consecutive items from 1. */
  | { kind: 'ordered'; index: number; spans: CompiledSpan[] }
  /** Between two scenes of one chapter, when a separator is asked for: drawn centered. */
  | { kind: 'scene-break'; text: string }
  | {
      kind: 'choice';
      id: string;
      text: string;
      targetSceneId: string;
      /** Null when the target is not part of this export: render name-only, no reference. */
      targetBookmarkId: string | null;
      targetSceneName: string | null;
      /** Requirement lines carried from the choice input; renderers draw one sub-line each. */
      requirements?: string[];
      /** Effect lines carried from the choice input; renderers draw one sub-line each. */
      effects?: string[];
    };

export type CompiledManuscript = { title: string; blocks: CompiledBlock[] };

/** Word bookmark names start with a letter, hold no spaces and stay under 40 chars. */
export function bookmarkIdForScene(sceneId: string): string {
  return `scene-${sceneId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 40);
}

/** Chapter bookmarks share the constraints; the prefix keeps them collision-free. */
export function bookmarkIdForChapter(chapterId: string): string {
  return `chapter-${chapterId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 40);
}

/** A scene heading's text: the number, and the name when the export shows names. */
export function sceneHeadingLabel(block: { number: number; name: string }): string {
  return block.name === '' ? String(block.number) : `${block.number}. ${block.name}`;
}

/** The appendix bookmark: at most one loose section exists per manuscript. */
export const APPENDIX_BOOKMARK_ID = 'appendix';

function toSpans(block: {
  inlines: {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
  }[];
}): CompiledSpan[] {
  return block.inlines.map((span) => ({
    text: span.text,
    bold: span.bold ?? false,
    italic: span.italic ?? false,
    underline: span.underline ?? false,
    strikethrough: span.strikethrough ?? false,
  }));
}

type SectionsInput = {
  sections: ManuscriptSection[];
  choicesBySceneId: Map<string, ManuscriptChoice[]>;
  sceneNameById: Map<string, string>;
  looseHeadingLabel: string;
  includeSceneNames: boolean;
  resetSceneNumbersPerChapter: boolean;
  sceneSeparator: string | null;
  /**
   * A gamebook: every scene carries its number as a heading (the name too, when `showNames`), and a
   * choice into a scene that is not in the export ends there, saying so with `endLabel`.
   */
  gamebook?: { showNames: boolean; endLabel: string };
};

function sectionsToBlocks({
  sections,
  choicesBySceneId,
  sceneNameById,
  looseHeadingLabel,
  includeSceneNames,
  resetSceneNumbersPerChapter,
  sceneSeparator,
  gamebook,
}: SectionsInput): CompiledBlock[] {
  // First occurrence wins: a looping route bookmarks the scene once, and every choice
  // points at that bookmark.
  const bookmarkFor = new Map<string, string>();
  for (const section of sections) {
    if (section.kind === 'scene' && !bookmarkFor.has(section.scene.id)) {
      bookmarkFor.set(section.scene.id, bookmarkIdForScene(section.scene.id));
    }
  }
  const positionOf = new Map<string, number>();
  for (const section of sections) {
    if (section.kind === 'scene' && !positionOf.has(section.scene.id)) {
      positionOf.set(section.scene.id, section.position);
    }
  }
  const emitted = new Set<string>();
  const blocks: CompiledBlock[] = [];
  // Per-group scene counters for restarted numbering: each container and the
  // appendix count their own scenes from 1. Routes never open a group, so the
  // single implicit group reproduces the global positions exactly.
  let groupKey = '';
  const groupCounts = new Map<string, number>();
  for (const section of sections) {
    if (section.kind === 'container') {
      groupKey = section.containerId;
      blocks.push({
        kind: 'chapter',
        id: section.containerId,
        number: section.containerType === 'chapter' ? section.index : null,
        name: section.name,
        bookmarkId: bookmarkIdForChapter(section.containerId),
      });
      continue;
    }
    if (section.kind === 'loose-heading') {
      groupKey = APPENDIX_BOOKMARK_ID;
      blocks.push({
        kind: 'loose-heading',
        label: looseHeadingLabel,
        bookmarkId: APPENDIX_BOOKMARK_ID,
      });
      continue;
    }
    const groupNumber = (groupCounts.get(groupKey) ?? 0) + 1;
    groupCounts.set(groupKey, groupNumber);
    // A separator marks where one scene ends and the next begins inside a chapter - never
    // before a chapter's first scene, which its heading already opens.
    if (sceneSeparator !== null && groupNumber > 1) {
      blocks.push({ kind: 'scene-break', text: sceneSeparator });
    }
    const bookmarkId = bookmarkFor.get(section.scene.id) ?? null;
    // Without scene names there is no heading to hang the bookmark on, so
    // choices degrade to bare text: any reference would name a scene.
    if (includeSceneNames || gamebook) {
      blocks.push({
        kind: 'scene-heading',
        id: section.scene.id,
        number: resetSceneNumbersPerChapter ? groupNumber : section.position,
        name: gamebook && !gamebook.showNames ? '' : section.scene.name,
        bookmarkId: bookmarkId && !emitted.has(bookmarkId) ? bookmarkId : null,
      });
    }
    if (bookmarkId) emitted.add(bookmarkId);
    if (section.scene.body) {
      for (const parsed of parseManuscriptMarkdown(section.scene.body)) {
        if (parsed.kind === 'bullet') blocks.push({ kind: 'bullet', spans: toSpans(parsed) });
        else if (parsed.kind === 'ordered')
          blocks.push({ kind: 'ordered', index: parsed.index, spans: toSpans(parsed) });
        else blocks.push({ kind: 'paragraph', spans: toSpans(parsed) });
      }
    }
    for (const choice of choicesBySceneId.get(section.scene.id) ?? []) {
      if (gamebook) {
        const targetBookmarkId = bookmarkFor.get(choice.nextSceneId) ?? null;
        const targetPosition = positionOf.get(choice.nextSceneId);
        blocks.push({
          kind: 'choice',
          id: choice.id,
          text: targetBookmarkId ? choice.text : `${choice.text} — ${gamebook.endLabel}`,
          targetSceneId: choice.nextSceneId,
          targetBookmarkId,
          // Without names a reference is the scene's number: "See 12".
          targetSceneName:
            targetBookmarkId && targetPosition !== undefined
              ? gamebook.showNames
                ? (sceneNameById.get(choice.nextSceneId) ?? String(targetPosition))
                : String(targetPosition)
              : null,
          requirements: choice.requirements,
          effects: choice.effects,
        });
        continue;
      }
      blocks.push({
        kind: 'choice',
        id: choice.id,
        text: choice.text,
        targetSceneId: choice.nextSceneId,
        targetBookmarkId: includeSceneNames ? (bookmarkFor.get(choice.nextSceneId) ?? null) : null,
        targetSceneName: includeSceneNames ? (sceneNameById.get(choice.nextSceneId) ?? null) : null,
        requirements: choice.requirements,
        effects: choice.effects,
      });
    }
  }
  return blocks;
}

/** Drops loose scene rows plus the containers and heading they would leave behind. */
export function withoutLooseSections(
  sections: ManuscriptSection[],
  chaptersById: Map<string, Pick<ManuscriptChapter, 'type'>>,
): ManuscriptSection[] {
  const kept = sections.filter(
    (section) => section.kind !== 'scene' || !isLooseScene(section.scene, chaptersById),
  );
  const usedContainers = new Set(
    kept
      .filter((s) => s.kind === 'scene')
      .map((s) => (s as { scene: ManuscriptScene }).scene.chapterId),
  );
  return kept.filter((section) => {
    if (section.kind === 'container') return usedContainers.has(section.containerId);
    if (section.kind === 'loose-heading') {
      const at = kept.indexOf(section);
      return kept.slice(at + 1).some((later) => later.kind === 'scene');
    }
    return true;
  });
}

function groupChoices(choices: ManuscriptChoice[]): Map<string, ManuscriptChoice[]> {
  const byScene = new Map<string, ManuscriptChoice[]>();
  for (const choice of choices) {
    const list = byScene.get(choice.sceneId) ?? [];
    list.push(choice);
    byScene.set(choice.sceneId, list);
  }
  return byScene;
}

export type CompileLinearOptions = {
  title: string;
  chapters: ManuscriptChapter[];
  scenes: ManuscriptScene[];
  choices: ManuscriptChoice[];
  includeLooseScenes: boolean;
  looseHeadingLabel: string;
  /** Scene headings on/off; off also renders choices without target references. Defaults to on. */
  includeSceneNames?: boolean;
  /** Restart scene numbers in every chapter and the appendix. Defaults to off. */
  resetSceneNumbersPerChapter?: boolean;
  /** Only this arc's containers and scenes; unchaptered and orphan scenes stay. Defaults to all. */
  arcId?: string | null;
  /** Text drawn between two scenes of a chapter (`#`, `* * *`...). Defaults to none. */
  sceneSeparator?: string | null;
};

/**
 * Arcs are separate generations: a single-arc export numbers its chapters from 1 in
 * emission order, no matter their story-wide indexes. Events carry no number either
 * way, and scene positions already restart over the visible scenes.
 */
function renumberArcChapters(sections: ManuscriptSection[]): ManuscriptSection[] {
  let number = 0;
  return sections.map((section) => {
    if (section.kind !== 'container' || section.containerType !== 'chapter') return section;
    number += 1;
    return { ...section, index: number };
  });
}

export function compileLinearManuscript({
  title,
  chapters,
  scenes,
  choices,
  includeLooseScenes,
  looseHeadingLabel,
  includeSceneNames = true,
  resetSceneNumbersPerChapter = false,
  arcId = null,
  sceneSeparator = null,
}: CompileLinearOptions): CompiledManuscript {
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  let sections = linearManuscriptSections(chapters, scenes, { arcId });
  if (!includeLooseScenes) sections = withoutLooseSections(sections, chaptersById);
  if (arcId) sections = renumberArcChapters(sections);
  return {
    title,
    blocks: [
      { kind: 'title', text: title },
      ...sectionsToBlocks({
        sections,
        choicesBySceneId: groupChoices(choices),
        sceneNameById: new Map(scenes.map((scene) => [scene.id, scene.name])),
        looseHeadingLabel,
        includeSceneNames,
        resetSceneNumbersPerChapter,
        sceneSeparator,
      }),
    ],
  };
}

export type CompileGamebookOptions = {
  title: string;
  /** Only the scenes to consider (an arc export passes the arc's own). */
  scenes: ManuscriptScene[];
  choices: ManuscriptChoice[];
  order: GamebookOrder;
  /** Seed of the shuffled order; any string. Defaults to the start scene's id. */
  seed?: string;
  /** Scene names beside the numbers, in headings and in references. */
  showSceneNames: boolean;
  /** Said after a choice whose target is not part of this export. */
  endLabel: string;
  /**
   * A story with several starts opens on a page saying `choose` and offering each start under
   * `begin`.
   */
  startLabels: { choose: string; begin: string };
  /** Text drawn between two consecutive scenes. Defaults to none. */
  sceneSeparator?: string | null;
};

/**
 * A branching story as a gamebook: the scenes the reader can reach from the start, numbered in
 * `order`, each choice pointing at its target's number (a "page N" in the PDF, a link elsewhere).
 */
export function compileGamebookManuscript({
  title,
  scenes,
  choices,
  order,
  seed,
  showSceneNames,
  endLabel,
  startLabels,
  sceneSeparator = null,
}: CompileGamebookOptions): CompiledManuscript {
  const sections = gamebookManuscriptSections(scenes, choices, { order, seed });
  const positionOf = new Map(
    sections.flatMap((section) =>
      section.kind === 'scene' ? [[section.scene.id, section.position] as const] : [],
    ),
  );
  const starts = gamebookStartScenes(scenes).filter((scene) => positionOf.has(scene.id));
  const opening: CompiledBlock[] =
    starts.length > 1
      ? [
          {
            kind: 'paragraph',
            spans: [
              {
                text: startLabels.choose,
                bold: true,
                italic: false,
                underline: false,
                strikethrough: false,
              },
            ],
          },
          ...starts.map(
            (start): CompiledBlock => ({
              kind: 'choice',
              id: `start-${start.id}`,
              text: startLabels.begin,
              targetSceneId: start.id,
              targetBookmarkId: bookmarkIdForScene(start.id),
              targetSceneName: showSceneNames ? start.name : String(positionOf.get(start.id)),
            }),
          ),
        ]
      : [];
  return {
    title,
    blocks: [
      { kind: 'title', text: title },
      ...opening,
      ...sectionsToBlocks({
        sections,
        choicesBySceneId: groupChoices(choices),
        sceneNameById: new Map(scenes.map((scene) => [scene.id, scene.name])),
        looseHeadingLabel: '',
        includeSceneNames: true,
        resetSceneNumbersPerChapter: false,
        sceneSeparator,
        gamebook: { showNames: showSceneNames, endLabel },
      }),
    ],
  };
}

/** One clickable index line: chapters and the appendix at level 0, scenes at 1. */
export type ManuscriptTocEntry = { level: 0 | 1; text: string; bookmarkId: string };

/**
 * The index over compiled blocks, in document order. Repeat visits in a
 * looping route resolve to the scene's first bookmark, like choices do;
 * without scene names there are no scene blocks, so chapters stand alone.
 */
export function manuscriptTocEntries(blocks: CompiledBlock[]): ManuscriptTocEntry[] {
  const sceneBookmark = new Map<string, string>();
  for (const block of blocks) {
    if (block.kind === 'scene-heading' && block.bookmarkId !== null) {
      if (!sceneBookmark.has(block.id)) sceneBookmark.set(block.id, block.bookmarkId);
    }
  }
  const entries: ManuscriptTocEntry[] = [];
  for (const block of blocks) {
    if (block.kind === 'chapter') {
      entries.push({
        level: 0,
        text: block.number === null ? block.name : `${block.number}. ${block.name}`,
        bookmarkId: block.bookmarkId,
      });
    } else if (block.kind === 'loose-heading') {
      entries.push({ level: 0, text: block.label, bookmarkId: block.bookmarkId });
    } else if (block.kind === 'scene-heading') {
      const target = block.bookmarkId ?? sceneBookmark.get(block.id) ?? null;
      if (target !== null)
        entries.push({ level: 1, text: sceneHeadingLabel(block), bookmarkId: target });
    }
  }
  return entries;
}

/**
 * Writer flags shared by the renderers; each reads the ones its format can honor and ignores the
 * rest (plain text reads none). Every one defaults to the renderer's own long-standing look.
 */
export type ManuscriptRenderOptions = {
  /** Clickable index after the title block. Defaults to off. */
  includeToc?: boolean;
  /** First-line indents, or blocks separated by space. */
  paragraphStyle?: 'indent' | 'block';
  /** Body size in points. */
  fontSize?: number;
  /** Line height as a multiple of the body size. */
  lineSpacing?: number;
  /** Body face (DOCX, HTML, EPUB); the PDF is always set in Times. */
  fontFamily?: 'serif' | 'sans';
  /** Page geometry (PDF). */
  pageSize?: 'a4' | '6x9';
};
