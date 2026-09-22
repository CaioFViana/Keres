import type { ChapterType } from '../../metadata/ChapterType';

/** The minimum the pipeline needs to know about a chapter. */
export interface ManuscriptChapter {
  id: string;
  name: string;
  index: number;
  type: ChapterType;
}

/** The minimum the pipeline needs to know about a scene. */
export interface ManuscriptScene {
  id: string;
  chapterId: string | null;
  name: string;
  index: number;
  body: string | null;
  isDeleted: boolean;
}

/** The minimum the pipeline needs to know about a route step. */
export interface ManuscriptRouteStep {
  id: string;
  routeId: string;
  position: number;
  sceneId: string;
  isDeleted: boolean;
}

export type ManuscriptSection =
  | {
      key: string;
      kind: 'container';
      containerId: string;
      name: string;
      index: number;
      containerType: 'chapter' | 'event';
    }
  | { key: string; kind: 'loose-heading' }
  | { key: string; kind: 'scene'; scene: ManuscriptScene; position: number };

export type ManuscriptMatch = { sectionIndex: number; count: number };

const byIndex = (a: { index: number }, b: { index: number }) => a.index - b.index;

/**
 * Scenes outside the main narrative: chapterless fragments, scenes of event containers
 * (organizational records, not prose), and scenes pointing at a gone chapter. The
 * manuscript shows them all; the exporter offers them behind a switch.
 */
export function isLooseScene(
  scene: Pick<ManuscriptScene, 'chapterId'>,
  chaptersById: Map<string, Pick<ManuscriptChapter, 'type'>>,
): boolean {
  if (!scene.chapterId) return true;
  const chapter = chaptersById.get(scene.chapterId);
  return !chapter || chapter.type === 'event';
}

/**
 * Linear order: chapters by index with their scenes, then event containers with theirs,
 * then the chapterless tail. Empty containers are skipped - the manuscript is prose,
 * not an outline.
 */
export function linearManuscriptSections(
  chapters: ManuscriptChapter[],
  scenes: ManuscriptScene[],
): ManuscriptSection[] {
  const live = scenes.filter((scene) => !scene.isDeleted);
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const sections: ManuscriptSection[] = [];
  let position = 0;

  const pushContainer = (chapter: ManuscriptChapter) => {
    const own = live
      .filter((scene) => scene.chapterId === chapter.id)
      .sort(byIndex);
    if (own.length === 0) return;
    sections.push({
      key: `container-${chapter.id}`,
      kind: 'container',
      containerId: chapter.id,
      name: chapter.name,
      index: chapter.index,
      containerType: chapter.type,
    });
    for (const scene of own) {
      position += 1;
      sections.push({ key: `scene-${scene.id}`, kind: 'scene', scene, position });
    }
  };

  for (const chapter of [...chapters].filter((c) => c.type === 'chapter').sort(byIndex)) {
    pushContainer(chapter);
  }
  for (const chapter of [...chapters].filter((c) => c.type === 'event').sort(byIndex)) {
    pushContainer(chapter);
  }

  // Event-container scenes were already emitted above; only the truly homeless remain:
  // chapterless fragments and scenes pointing at a gone chapter.
  const homeless = live
    .filter((scene) => !scene.chapterId || !chaptersById.has(scene.chapterId))
    .sort(byIndex);
  if (homeless.length > 0) {
    sections.push({ key: 'loose-heading', kind: 'loose-heading' });
    for (const scene of homeless) {
      position += 1;
      sections.push({ key: `scene-${scene.id}`, kind: 'scene', scene, position });
    }
  }
  return sections;
}

/**
 * Route order: the steps by position, skipping scenes that vanished. Keys are step ids
 * because a looping route visits the same scene twice.
 */
export function routeManuscriptSections(
  steps: ManuscriptRouteStep[],
  scenes: ManuscriptScene[],
): ManuscriptSection[] {
  const byId = new Map(scenes.filter((scene) => !scene.isDeleted).map((scene) => [scene.id, scene]));
  const sections: ManuscriptSection[] = [];
  let position = 0;
  for (const step of [...steps]
    .filter((s) => !s.isDeleted)
    .sort((a, b) => a.position - b.position)) {
    const scene = byId.get(step.sceneId);
    if (!scene) continue;
    position += 1;
    sections.push({ key: `step-${step.id}`, kind: 'scene', scene, position });
  }
  return sections;
}

/** Non-overlapping, case-insensitive matches over scene names and bodies. */
export function findManuscriptMatches(
  sections: ManuscriptSection[],
  query: string,
): { matches: ManuscriptMatch[]; total: number } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { matches: [], total: 0 };
  const matches: ManuscriptMatch[] = [];
  let total = 0;
  sections.forEach((section, sectionIndex) => {
    if (section.kind !== 'scene') return;
    const haystack = `${section.scene.name}\n${section.scene.body ?? ''}`.toLowerCase();
    let count = 0;
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      count += 1;
      from = at + needle.length;
    }
    if (count > 0) {
      matches.push({ sectionIndex, count });
      total += count;
    }
  });
  return { matches, total };
}

/** Which section the ordinal-th global match (0-based) lives in. */
export function sectionIndexForMatch(matches: ManuscriptMatch[], ordinal: number): number {
  let rest = ordinal;
  for (const match of matches) {
    if (rest < match.count) return match.sectionIndex;
    rest -= match.count;
  }
  return matches[matches.length - 1]?.sectionIndex ?? 0;
}
