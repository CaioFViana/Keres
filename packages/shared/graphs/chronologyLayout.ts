import {
  isDirectionalChapterRelation,
  type ChapterRelationType,
} from '../metadata/ChapterRelationType';

/**
 * The story's containers arranged by **when they happened**, not by when they are told.
 *
 * A second axis, and deliberately a second drawing. `storyTimelineLayout` walks the narrative
 * spine - chapter 1, chapter 2, the scenes inside them - which is the order a reader meets things.
 * This one is the order things occurred in the world. A story tells its middle first; the war behind
 * it still happened before the peace.
 *
 * ## Where the order comes from
 *
 * Two sources, and the second only fills in what the first leaves open.
 *
 * 1. **What the writer stated**, as chapter relations. Always wins.
 * 2. **The chapter numbering**, in a linear story. Chapter 2 happens after chapter 1 unless somebody
 *    says otherwise; making the writer state that for every pair would be asking them to type out
 *    what the numbers already say. Not applied to a branching story, where the index is not reading
 *    order and so implies nothing about time.
 *
 * The second is a *default*, so it yields: an implied edge is dropped whenever the stated relations
 * already put those two chapters the other way round. That is the flashback - "chapter 7 happened
 * before chapter 2" - and it has to read as a fact about the story rather than as a contradiction.
 *
 * ## What a container occupies
 *
 * A **span**, not a point. An event can sit inside one chapter or run across several at once, so a
 * node carries `band` and `bandEnd`: containment and overlap widen it to cover everything it was
 * tied to. A chapter of the spine occupies its own step and nothing more.
 *
 * ## What it has to survive
 *
 * A writer can state a loop, which `checkChronologyCycles` reports - but this drawing is very often
 * where they are looking when they find out, so it must place those containers somewhere and carry
 * on, never spin.
 */

export interface ChronologyContainer {
  id: string;
  name: string;
  isEvent: boolean;
  /** Position within its own kind. For a chapter this is the narrative spine. */
  index: number;
  /** Total span of its scenes, already summed and formatted by the caller ("300 years"). */
  durationLabel?: string;
}

export interface ChronologyRelation {
  chapter1Id: string;
  chapter2Id: string;
  relationType: ChapterRelationType;
}

export interface ChronologyNode {
  id: string;
  name: string;
  isEvent: boolean;
  durationLabel?: string;
  /** First step it occupies. */
  band: number;
  /** Last step it occupies; equal to `band` for anything sitting at one point. */
  bandEnd: number;
  /** Position within the band, for a stable top-to-bottom order. */
  slot: number;
  /** Part of a stated loop, which cannot be true of any real sequence. */
  inCycle: boolean;
}

export interface ChronologyEdge {
  fromId: string;
  toId: string;
  relationType: ChapterRelationType;
  /** Unordered relations are drawn as a tie rather than carried by the axis. */
  directional: boolean;
}

/** What a step is, so the axis can be labelled with something the writer recognises. */
export interface ChronologyStep {
  band: number;
  /** The chapter occupying this step alone, if exactly one does. */
  chapterName?: string;
  chapterIndex?: number;
}

export interface ChronologyLayout {
  nodes: ChronologyNode[];
  edges: ChronologyEdge[];
  steps: ChronologyStep[];
  bandCount: number;
  /** Containers nothing places, listed apart from the steps. */
  unplaced: ChronologyNode[];
  /** True when the relations contradict themselves; the steps are then a best effort. */
  hasCycle: boolean;
}

export interface ChronologyLayoutOptions {
  /**
   * A branching story implies nothing from its chapter numbering: there the index is not the order
   * of reading, so it cannot stand in for the order of happening either.
   */
  storyType?: 'linear' | 'branching';
}

/** Whether `target` can already be reached from `source` through what the writer stated. */
function buildReachability(
  edges: { from: string; to: string }[],
): (source: string, target: string) => boolean {
  const out = new Map<string, string[]>();
  for (const edge of edges) out.set(edge.from, [...(out.get(edge.from) ?? []), edge.to]);

  const cache = new Map<string, Set<string>>();
  const reachableFrom = (source: string) => {
    const cached = cache.get(source);
    if (cached) return cached;

    const seen = new Set<string>();
    const stack = [...(out.get(source) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(out.get(id) ?? []));
    }
    cache.set(source, seen);
    return seen;
  };

  return (source, target) => reachableFrom(source).has(target);
}

export function buildChronologyLayout(
  containers: ChronologyContainer[],
  relations: ChronologyRelation[],
  options: ChronologyLayoutOptions = {},
): ChronologyLayout {
  const known = new Set(containers.map((container) => container.id));
  const live = relations.filter(
    (relation) => known.has(relation.chapter1Id) && known.has(relation.chapter2Id),
  );

  /*
   * Contradiction is asked of `before` and `during` together: A during B and B during A cannot both
   * hold, any more than two "befores" can. Placement is asked of `before` alone - "A happens during
   * B" says A sits inside B's span, not that A comes first.
   */
  const statedConstraining = live.filter((relation) =>
    isDirectionalChapterRelation(relation.relationType),
  );
  const statedPrecedence = live.filter((relation) => relation.relationType === 'before');
  const containment = live.filter((relation) => relation.relationType === 'during');
  const overlap = live.filter((relation) => !isDirectionalChapterRelation(relation.relationType));

  /*
   * The spine, as an implied chronology.
   *
   * Each chapter after the first is taken to happen after the one before it - unless what the writer
   * stated already puts them the other way round, which is a flashback: the writer being more
   * specific than the numbering, not disagreeing with themselves.
   */
  const spine = containers
    .filter((container) => !container.isEvent)
    .sort((a, b) => a.index - b.index);

  /*
   * Accepted one at a time, each checked against everything accepted so far.
   *
   * Checking only against what was *stated* is not enough: with "chapter 3 before chapter 1" stated,
   * neither 1->2 nor 2->3 is individually contradicted, but taking both closes the loop 1->2->3->1.
   * The implied chain has to be built up, testing each link against the graph it is joining.
   *
   * Only implied edges are ever refused. What the writer stated always survives - that is what makes
   * this a default rather than a competing opinion.
   */
  const acceptedEdges = statedConstraining.map((relation) => ({
    from: relation.chapter1Id,
    to: relation.chapter2Id,
  }));
  const impliedPrecedence: { chapter1Id: string; chapter2Id: string }[] = [];

  if (options.storyType !== 'branching') {
    for (let position = 0; position < spine.length - 1; position += 1) {
      const chapter = spine[position]!;
      const next = spine[position + 1]!;
      // Rebuilt per link: the graph grew, so a closure from before it grew would be answering about
      // a graph that no longer exists.
      if (buildReachability(acceptedEdges)(next.id, chapter.id)) continue;
      acceptedEdges.push({ from: chapter.id, to: next.id });
      impliedPrecedence.push({ chapter1Id: chapter.id, chapter2Id: next.id });
    }
  }

  const asPair = (relation: ChronologyRelation) => ({
    chapter1Id: relation.chapter1Id,
    chapter2Id: relation.chapter2Id,
  });
  const allPrecedence = [...statedPrecedence.map(asPair), ...impliedPrecedence];
  const allConstraining = [...statedConstraining.map(asPair), ...impliedPrecedence];

  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();
  for (const container of containers) incomingCount.set(container.id, 0);
  for (const relation of allConstraining) {
    outgoing.set(relation.chapter1Id, [
      ...(outgoing.get(relation.chapter1Id) ?? []),
      relation.chapter2Id,
    ]);
    incomingCount.set(relation.chapter2Id, (incomingCount.get(relation.chapter2Id) ?? 0) + 1);
  }

  const band = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, count] of incomingCount) {
    if (count === 0) {
      band.set(id, 0);
      queue.push(id);
    }
  }

  /*
   * Membership is decided by what comes **off** the queue, not by whether a band was written: a
   * container caught in a cycle can carry a number while never being resolved, and reading the band
   * map would call it ordered and hide it from the writer.
   */
  const settled = new Set<string>();
  const settledOrder: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    settled.add(id);
    settledOrder.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (incomingCount.get(next) ?? 0) - 1;
      incomingCount.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  // The *longest* path: a container waits for the latest thing that precedes it, so a step never has
  // to point backwards at another.
  const precedenceOut = new Map<string, string[]>();
  for (const relation of allPrecedence) {
    precedenceOut.set(relation.chapter1Id, [
      ...(precedenceOut.get(relation.chapter1Id) ?? []),
      relation.chapter2Id,
    ]);
  }
  for (const id of settledOrder) {
    for (const next of precedenceOut.get(id) ?? []) {
      band.set(next, Math.max(band.get(next) ?? 0, (band.get(id) ?? 0) + 1));
    }
  }

  /*
   * Something contained starts at its container's step. Repeated because containment chains, and
   * bounded by the number of containers so it terminates even on a stated loop.
   */
  for (let pass = 0; pass < containers.length && containment.length > 0; pass += 1) {
    let moved = false;
    for (const relation of containment) {
      const containerBand = band.get(relation.chapter2Id);
      if (containerBand !== undefined && band.get(relation.chapter1Id) !== containerBand) {
        band.set(relation.chapter1Id, containerBand);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const cycleMembers = new Set(
    containers.map((container) => container.id).filter((id) => !settled.has(id)),
  );
  const hasCycle = cycleMembers.size > 0;
  const settledBands = [...settled].map((id) => band.get(id) ?? 0);
  const orderedBandCount = settledBands.length > 0 ? Math.max(...settledBands) + 1 : 0;
  for (const id of cycleMembers) band.set(id, orderedBandCount);

  /*
   * A span, not a point - and the two kinds of sharing widen it differently.
   *
   * **`during` clamps.** A is inside B, so A can never reach further than B does. Widening for it
   * would draw the contained thing overflowing the thing containing it, which is the opposite of
   * what the word means and looks like a rendering fault rather than a statement.
   *
   * **`overlaps` widens.** The two cross without either containing the other, so each may reach
   * past the other - that is the whole difference between the two relations, and the only place it
   * shows.
   */
  const bandEnd = new Map<string, number>(
    containers.map((container) => [container.id, band.get(container.id) ?? 0]),
  );

  for (const relation of overlap) {
    const widen = (id: string, otherId: string) => {
      const own = band.get(id) ?? 0;
      const other = band.get(otherId) ?? 0;
      band.set(id, Math.min(own, other));
      bandEnd.set(id, Math.max(bandEnd.get(id) ?? own, other));
    };
    widen(relation.chapter1Id, relation.chapter2Id);
    widen(relation.chapter2Id, relation.chapter1Id);
  }

  /*
   * Containment reaches both ways, and the two are not the same statement.
   *
   * The **container grows** to cover everything inside it: an era that has chapters three, four and
   * five inside it runs across all three, which is how a writer says "this went on through that
   * stretch of the story". The **contained shrinks** to fit: a siege inside a war cannot reach
   * further than the war does.
   *
   * Growing has to finish before shrinking, or a container would clamp its contents against a span
   * it had not yet been given. Repeated because containment chains, and bounded so a stated loop
   * ends the pass rather than spinning it.
   */
  for (let pass = 0; pass < containers.length && containment.length > 0; pass += 1) {
    let grew = false;
    for (const relation of containment) {
      const innerStart = band.get(relation.chapter1Id);
      const innerEnd = bandEnd.get(relation.chapter1Id);
      if (innerStart === undefined || innerEnd === undefined) continue;

      const outerStart = band.get(relation.chapter2Id) ?? innerStart;
      const outerEnd = bandEnd.get(relation.chapter2Id) ?? innerEnd;
      const nextStart = Math.min(outerStart, innerStart);
      const nextEnd = Math.max(outerEnd, innerEnd);
      if (nextStart !== outerStart || nextEnd !== outerEnd) {
        band.set(relation.chapter2Id, nextStart);
        bandEnd.set(relation.chapter2Id, nextEnd);
        grew = true;
      }
    }
    if (!grew) break;
  }

  for (const relation of containment) {
    const outerStart = band.get(relation.chapter2Id);
    const outerEnd = bandEnd.get(relation.chapter2Id);
    if (outerStart === undefined || outerEnd === undefined) continue;

    band.set(
      relation.chapter1Id,
      Math.max(band.get(relation.chapter1Id) ?? outerStart, outerStart),
    );
    bandEnd.set(
      relation.chapter1Id,
      Math.min(bandEnd.get(relation.chapter1Id) ?? outerEnd, outerEnd),
    );
  }

  const relatedIds = new Set([
    ...live.flatMap((relation) => [relation.chapter1Id, relation.chapter2Id]),
    ...impliedPrecedence.flatMap((relation) => [relation.chapter1Id, relation.chapter2Id]),
  ]);

  const slotCounters = new Map<number, number>();
  const toNode = (container: ChronologyContainer): ChronologyNode => {
    const nodeBand = band.get(container.id) ?? 0;
    const slot = slotCounters.get(nodeBand) ?? 0;
    slotCounters.set(nodeBand, slot + 1);
    return {
      id: container.id,
      name: container.name,
      isEvent: container.isEvent,
      durationLabel: container.durationLabel,
      band: nodeBand,
      bandEnd: Math.max(nodeBand, bandEnd.get(container.id) ?? nodeBand),
      slot,
      inCycle: cycleMembers.has(container.id),
    };
  };

  const nodes = containers
    .filter((container) => relatedIds.has(container.id))
    .map(toNode)
    .sort((a, b) => a.band - b.band || a.bandEnd - b.bandEnd || a.slot - b.slot);

  /*
   * Containers nothing places are listed apart rather than dropped into step 1. "Nothing is known to
   * come before this" is a claim; "nobody mentioned it and the numbering does not reach it" is not.
   */
  const unplaced = containers
    .filter((container) => !relatedIds.has(container.id))
    .map((container) => ({
      id: container.id,
      name: container.name,
      isEvent: container.isEvent,
      durationLabel: container.durationLabel,
      band: -1,
      bandEnd: -1,
      slot: 0,
      inCycle: false,
    }));

  const bandCount =
    nodes.length > 0 ? Math.max(...nodes.map((node) => Math.max(node.band, node.bandEnd))) + 1 : 0;

  /*
   * A step is named after the chapter that occupies it, when exactly one does. That is the point of
   * seeding from the spine: the axis reads as the story rather than as a counter.
   */
  const steps: ChronologyStep[] = Array.from({ length: bandCount }, (_, index) => {
    const chapters = nodes.filter(
      (node) => !node.isEvent && node.band === index && node.bandEnd === index,
    );
    const only = chapters.length === 1 ? chapters[0] : undefined;
    const source = only ? containers.find((container) => container.id === only.id) : undefined;
    return { band: index, chapterName: only?.name, chapterIndex: source?.index };
  });

  return {
    nodes,
    edges: live.map((relation) => ({
      fromId: relation.chapter1Id,
      toId: relation.chapter2Id,
      relationType: relation.relationType,
      directional: isDirectionalChapterRelation(relation.relationType),
    })),
    steps,
    bandCount,
    unplaced,
    hasCycle,
  };
}
