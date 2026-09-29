import type { ChapterType } from '../../metadata/ChapterType';
import { findAllCaseInsensitiveMatches } from '../../utils/excerptHighlight';

/** The minimum the pipeline needs to know about a chapter. */
export interface ManuscriptChapter {
  id: string;
  name: string;
  index: number;
  type: ChapterType;
  /** Which arc owns this container; absent means the caller did not load arcs (no filtering). */
  arcId?: string | null;
}

/** The minimum the pipeline needs to know about a scene. */
export interface ManuscriptScene {
  id: string;
  chapterId: string | null;
  name: string;
  index: number;
  body: string | null;
  isDeleted: boolean;
  /** Where a branching story begins; absent when the caller does not carry the flag. */
  isStart?: boolean;
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
 * A specific arc shows only its own containers; a nullish arc shows everything.
 * Mirrors the client's arc filter: arcs own containers, scenes inherit from theirs.
 */
export function chapterMatchesArc(
  chapter: Pick<ManuscriptChapter, 'arcId'>,
  arcId: string | null | undefined,
): boolean {
  if (!arcId) return true;
  return chapter.arcId === arcId;
}

/**
 * Scenes inherit their container's arc. Chapterless scenes and scenes pointing at a
 * gone chapter have no container to inherit from, so they stay visible under any arc.
 */
export function sceneMatchesArc(
  scene: Pick<ManuscriptScene, 'chapterId'>,
  chaptersById: ReadonlyMap<string, Pick<ManuscriptChapter, 'arcId'>>,
  arcId: string | null | undefined,
): boolean {
  if (!arcId) return true;
  if (!scene.chapterId) return true;
  const chapter = chaptersById.get(scene.chapterId);
  if (!chapter) return true;
  return chapterMatchesArc(chapter, arcId);
}

export type LinearSectionsOptions = {
  /** Only this arc's containers and scenes; unchaptered and orphan scenes stay. Defaults to all. */
  arcId?: string | null;
};

/**
 * Linear order: chapters by index with their scenes, then event containers with theirs,
 * then the chapterless tail. Empty containers are skipped - the manuscript is prose,
 * not an outline.
 */
export function linearManuscriptSections(
  chapters: ManuscriptChapter[],
  scenes: ManuscriptScene[],
  options: LinearSectionsOptions = {},
): ManuscriptSection[] {
  const originalById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const visibleChapters = chapters.filter((chapter) => chapterMatchesArc(chapter, options.arcId));
  // Scenes resolve against the ORIGINAL map: a scene of a filtered-out container is
  // hidden with it, not re-homed into the homeless tail as if its chapter were gone.
  const live = scenes.filter(
    (scene) => !scene.isDeleted && sceneMatchesArc(scene, originalById, options.arcId),
  );
  const chaptersById = new Map(visibleChapters.map((chapter) => [chapter.id, chapter]));
  const sections: ManuscriptSection[] = [];
  let position = 0;

  const pushContainer = (chapter: ManuscriptChapter) => {
    const own = live.filter((scene) => scene.chapterId === chapter.id).sort(byIndex);
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

  for (const chapter of [...visibleChapters].filter((c) => c.type === 'chapter').sort(byIndex)) {
    pushContainer(chapter);
  }
  for (const chapter of [...visibleChapters].filter((c) => c.type === 'event').sort(byIndex)) {
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
  const byId = new Map(
    scenes.filter((scene) => !scene.isDeleted).map((scene) => [scene.id, scene]),
  );
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

/** How a gamebook numbers its scenes: as the reader meets them, or scattered like a printed one. */
export type GamebookOrder = 'discovery' | 'shuffled';

/** FNV-1a: a stable 32-bit seed out of any string. */
function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: small, seedable, the same sequence on every host. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export type GamebookSectionsOptions = {
  order: GamebookOrder;
  /** Any string; the shuffled order is a pure function of it. Defaults to the start scene's id. */
  seed?: string;
};

/**
 * Where a branching story can begin: every live scene flagged as a start (a branching story may
 * have several), by index; the first scene by index when none is flagged.
 */
export function gamebookStartScenes(scenes: ManuscriptScene[]): ManuscriptScene[] {
  const live = scenes.filter((scene) => !scene.isDeleted).sort(byIndex);
  const flagged = live.filter((scene) => scene.isStart);
  return flagged.length > 0 ? flagged : live.slice(0, 1);
}

/**
 * A branching story as a gamebook: every scene the reader can reach from a start by following
 * choices, numbered 1..N. With one start it is number 1; with several, the book opens on a page
 * listing them (see `compileGamebookManuscript`) and they are numbered like any other scene.
 * `discovery` numbers by breadth-first search from the starts (choices in their own order);
 * `shuffled` scatters the scenes with a seeded shuffle, so the same seed always prints the same
 * book. Scenes nothing leads to stay in, after the reachable ones (the reachability is only as
 * good as the choices and checks it reads, and a scene wrongly left out is worse than one wrongly
 * kept); deleted scenes are out, and so is a choice's target that is not among `scenes` (another
 * arc), which leads nowhere here.
 */
export function gamebookManuscriptSections(
  scenes: ManuscriptScene[],
  choices: { sceneId: string; nextSceneId: string }[],
  options: GamebookSectionsOptions,
): ManuscriptSection[] {
  const byId = new Map(
    scenes.filter((scene) => !scene.isDeleted).map((scene) => [scene.id, scene]),
  );
  const starts = gamebookStartScenes(scenes);
  if (starts.length === 0) return [];
  const outgoing = new Map<string, string[]>();
  for (const choice of choices) {
    const list = outgoing.get(choice.sceneId) ?? [];
    list.push(choice.nextSceneId);
    outgoing.set(choice.sceneId, list);
  }
  const reached: ManuscriptScene[] = [...starts];
  const seen = new Set(starts.map((start) => start.id));
  for (let cursor = 0; cursor < reached.length; cursor += 1) {
    for (const nextId of outgoing.get(reached[cursor].id) ?? []) {
      const next = byId.get(nextId);
      if (!next || seen.has(next.id)) continue;
      seen.add(next.id);
      reached.push(next);
    }
  }
  const stray = [...byId.values()].filter((scene) => !seen.has(scene.id)).sort(byIndex);
  const everything = [...reached, ...stray];
  let ordered = everything;
  if (options.order === 'shuffled') {
    const random = seededRandom(seedOf(options.seed ?? starts[0].id));
    // A lone start stays number 1; several are listed on the opening page, so they scatter too.
    const fixed = starts.length === 1 ? 1 : 0;
    const movable = everything.slice(fixed);
    for (let index = movable.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [movable[index], movable[other]] = [movable[other], movable[index]];
    }
    ordered = [...everything.slice(0, fixed), ...movable];
  }
  return ordered.map((scene, index) => ({
    key: `scene-${scene.id}`,
    kind: 'scene',
    scene,
    position: index + 1,
  }));
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

export interface OrdinalMatchLocation {
  sectionIndex: number;
  /** 0-based hit within the scene name, or -1 when the hit is in the body. */
  nameMatchIndex: number;
  /** 0-based hit within the scene body, or -1 when the hit is in the name. */
  bodyMatchIndex: number;
}

/**
 * Which hit the ordinal-th global match (0-based) is: its section plus its 0-based
 * position inside the scene name or body. Names count first - the counter scans
 * `name\nbody` - so the body index is the within-section index minus the name hits.
 * Null when there is no such match.
 */
export function locateOrdinalMatch(
  sections: ManuscriptSection[],
  matches: ManuscriptMatch[],
  query: string,
  ordinal: number,
): OrdinalMatchLocation | null {
  if (matches.length === 0 || ordinal < 0) return null;
  const total = matches.reduce((sum, match) => sum + match.count, 0);
  if (ordinal >= total) return null;
  const sectionIndex = sectionIndexForMatch(matches, ordinal);
  const section = sections[sectionIndex];
  if (!section || section.kind !== 'scene') return null;
  let within = ordinal;
  for (const match of matches) {
    if (match.sectionIndex === sectionIndex) break;
    within -= match.count;
  }
  const nameHits = findAllCaseInsensitiveMatches(section.scene.name, query).length;
  if (within < nameHits) return { sectionIndex, nameMatchIndex: within, bodyMatchIndex: -1 };
  return { sectionIndex, nameMatchIndex: -1, bodyMatchIndex: within - nameHits };
}
