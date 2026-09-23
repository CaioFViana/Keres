import {
  isLooseScene,
  linearManuscriptSections,
  routeManuscriptSections,
  type ManuscriptChapter,
  type ManuscriptRouteStep,
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
};

function sectionsToBlocks({
  sections,
  choicesBySceneId,
  sceneNameById,
  looseHeadingLabel,
  includeSceneNames,
  resetSceneNumbersPerChapter,
}: SectionsInput): CompiledBlock[] {
  // First occurrence wins: a looping route bookmarks the scene once, and every choice
  // points at that bookmark.
  const bookmarkFor = new Map<string, string>();
  for (const section of sections) {
    if (section.kind === 'scene' && !bookmarkFor.has(section.scene.id)) {
      bookmarkFor.set(section.scene.id, bookmarkIdForScene(section.scene.id));
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
    const bookmarkId = bookmarkFor.get(section.scene.id) ?? null;
    // Without scene names there is no heading to hang the bookmark on, so
    // choices degrade to bare text: any reference would name a scene.
    if (includeSceneNames) {
      blocks.push({
        kind: 'scene-heading',
        id: section.scene.id,
        number: resetSceneNumbersPerChapter ? groupNumber : section.position,
        name: section.scene.name,
        bookmarkId: bookmarkId && !emitted.has(bookmarkId) ? bookmarkId : null,
      });
    }
    if (bookmarkId) emitted.add(bookmarkId);
    if (section.scene.body) {
      for (const parsed of parseManuscriptMarkdown(section.scene.body)) {
        blocks.push({ kind: 'paragraph', spans: toSpans(parsed) });
      }
    }
    for (const choice of choicesBySceneId.get(section.scene.id) ?? []) {
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
      }),
    ],
  };
}

export type CompileRouteOptions = {
  title: string;
  routeName: string;
  steps: ManuscriptRouteStep[];
  scenes: ManuscriptScene[];
  choices: ManuscriptChoice[];
  looseHeadingLabel: string;
  /** Scene headings on/off; off also renders choices without target references. Defaults to on. */
  includeSceneNames?: boolean;
  /** Accepted for uniformity; routes have a single group, so it changes nothing. */
  resetSceneNumbersPerChapter?: boolean;
};

export function compileRouteManuscript({
  title,
  routeName,
  steps,
  scenes,
  choices,
  looseHeadingLabel,
  includeSceneNames = true,
  resetSceneNumbersPerChapter = false,
}: CompileRouteOptions): CompiledManuscript {
  return {
    title,
    blocks: [
      { kind: 'title', text: title },
      { kind: 'subtitle', text: routeName },
      ...sectionsToBlocks({
        sections: routeManuscriptSections(steps, scenes),
        choicesBySceneId: groupChoices(choices),
        sceneNameById: new Map(scenes.map((scene) => [scene.id, scene.name])),
        looseHeadingLabel,
        includeSceneNames,
        resetSceneNumbersPerChapter,
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
        entries.push({ level: 1, text: `${block.number}. ${block.name}`, bookmarkId: target });
    }
  }
  return entries;
}

/** Writer flags shared by every renderer. Plain text reads none of them. */
export type ManuscriptRenderOptions = {
  /** Clickable index after the title block. Defaults to off. */
  includeToc?: boolean;
};
