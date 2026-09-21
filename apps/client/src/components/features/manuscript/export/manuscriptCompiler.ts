import type { ChapterSelect, ChoiceSelect, RouteStepSelect, SceneSelect } from '../../../../db/schema';
import {
  isLooseScene,
  linearManuscriptSections,
  routeManuscriptSections,
  type ManuscriptSection,
} from '../manuscriptSections';
import { parseManuscriptMarkdown } from '../parseManuscriptMarkdown';

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
  | { kind: 'chapter'; id: string; number: number | null; name: string }
  | {
      kind: 'scene-heading';
      id: string;
      number: number;
      name: string;
      /** Null when this scene already contributed its bookmark (route loops). */
      bookmarkId: string | null;
    }
  | { kind: 'loose-heading'; label: string }
  | { kind: 'paragraph'; spans: CompiledSpan[] }
  | {
      kind: 'choice';
      id: string;
      text: string;
      targetSceneId: string;
      /** Null when the target is not part of this export: render name-only, no reference. */
      targetBookmarkId: string | null;
      targetSceneName: string | null;
    };

export type CompiledManuscript = { title: string; blocks: CompiledBlock[] };

/** Word bookmark names start with a letter, hold no spaces and stay under 40 chars. */
export function bookmarkIdForScene(sceneId: string): string {
  return `scene-${sceneId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 40);
}

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
  choicesBySceneId: Map<string, ChoiceSelect[]>;
  sceneNameById: Map<string, string>;
  looseHeadingLabel: string;
};

function sectionsToBlocks({
  sections,
  choicesBySceneId,
  sceneNameById,
  looseHeadingLabel,
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
  for (const section of sections) {
    if (section.kind === 'container') {
      blocks.push({
        kind: 'chapter',
        id: section.containerId,
        number: section.containerType === 'chapter' ? section.index : null,
        name: section.name,
      });
      continue;
    }
    if (section.kind === 'loose-heading') {
      blocks.push({ kind: 'loose-heading', label: looseHeadingLabel });
      continue;
    }
    const bookmarkId = bookmarkFor.get(section.scene.id) ?? null;
    blocks.push({
      kind: 'scene-heading',
      id: section.scene.id,
      number: section.position,
      name: section.scene.name,
      bookmarkId: bookmarkId && !emitted.has(bookmarkId) ? bookmarkId : null,
    });
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
        targetBookmarkId: bookmarkFor.get(choice.nextSceneId) ?? null,
        targetSceneName: sceneNameById.get(choice.nextSceneId) ?? null,
      });
    }
  }
  return blocks;
}

/** Drops loose scene rows plus the containers and heading they would leave behind. */
export function withoutLooseSections(
  sections: ManuscriptSection[],
  chaptersById: Map<string, Pick<ChapterSelect, 'type'>>,
): ManuscriptSection[] {
  const kept = sections.filter(
    (section) => section.kind !== 'scene' || !isLooseScene(section.scene, chaptersById),
  );
  const usedContainers = new Set(
    kept.filter((s) => s.kind === 'scene').map((s) => (s as { scene: SceneSelect }).scene.chapterId),
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

function groupChoices(choices: ChoiceSelect[]): Map<string, ChoiceSelect[]> {
  const byScene = new Map<string, ChoiceSelect[]>();
  for (const choice of choices) {
    const list = byScene.get(choice.sceneId) ?? [];
    list.push(choice);
    byScene.set(choice.sceneId, list);
  }
  return byScene;
}

export type CompileLinearOptions = {
  title: string;
  chapters: ChapterSelect[];
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  includeLooseScenes: boolean;
  looseHeadingLabel: string;
};

export function compileLinearManuscript({
  title,
  chapters,
  scenes,
  choices,
  includeLooseScenes,
  looseHeadingLabel,
}: CompileLinearOptions): CompiledManuscript {
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  let sections = linearManuscriptSections(chapters, scenes);
  if (!includeLooseScenes) sections = withoutLooseSections(sections, chaptersById);
  return {
    title,
    blocks: [
      { kind: 'title', text: title },
      ...sectionsToBlocks({
        sections,
        choicesBySceneId: groupChoices(choices),
        sceneNameById: new Map(scenes.map((scene) => [scene.id, scene.name])),
        looseHeadingLabel,
      }),
    ],
  };
}

export type CompileRouteOptions = {
  title: string;
  routeName: string;
  steps: RouteStepSelect[];
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  looseHeadingLabel: string;
};

export function compileRouteManuscript({
  title,
  routeName,
  steps,
  scenes,
  choices,
  looseHeadingLabel,
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
      }),
    ],
  };
}
