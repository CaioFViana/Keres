/**
 * The neighbourhood of a node in a relation graph: who it is directly connected to. Two views of the
 * graph read it the same way - the focus filter (keep the chosen nodes and their neighbours) and the
 * focus on a tapped node (dim everything else) - and the character and location graphs both use it,
 * so "who is around this one" has a single answer.
 *
 * Pure on purpose, like the layouts: the screen filters before laying out, so the interactive map
 * and the exported SVG never disagree about which nodes are visible.
 */

/** The two ends of an edge, whatever the edge calls them (`character1Id`, `locationAId`...). */
export type EdgeEnds<E> = (edge: E) => readonly [string, string];

/**
 * How many nodes the focus filter takes at once. More would make the "neighbours of the chosen"
 * grow back into the whole map, which is the thing the filter exists to avoid.
 */
export const MAX_FOCUS_SELECTION = 12;

/** The ids directly connected to any of `ids`, not counting `ids` themselves unless they touch each other. */
export function neighborIds<E>(
  edges: readonly E[],
  ends: EdgeEnds<E>,
  ids: Iterable<string>,
): Set<string> {
  const from = new Set(ids);
  const found = new Set<string>();
  for (const edge of edges) {
    const [a, b] = ends(edge);
    if (from.has(a)) found.add(b);
    if (from.has(b)) found.add(a);
  }
  return found;
}

/**
 * The ids kept by a focus on `focusIds`: those ids and their direct neighbours. The neighbours are
 * read from the original ids only, so the set never grows into neighbours of neighbours.
 */
export function focusNeighborhood<E>(
  edges: readonly E[],
  ends: EdgeEnds<E>,
  focusIds: readonly string[],
): Set<string> {
  const kept = new Set(focusIds);
  for (const id of neighborIds(edges, ends, focusIds)) kept.add(id);
  return kept;
}

/**
 * Keeps the chosen nodes plus everyone directly related to them, and the edges among that set. An
 * edge between two neighbours is kept too (both ends are in the set), which gives context instead of
 * a dangling line. Original order is preserved, so a filtered map reads the same as the full one;
 * unknown ids simply never match a node. An empty selection keeps everything.
 */
export function filterByNeighborhood<N extends { id: string }, E>(
  nodes: N[],
  edges: E[],
  ends: EdgeEnds<E>,
  selectedIds: readonly string[],
): { nodes: N[]; edges: E[] } {
  if (selectedIds.length === 0) return { nodes, edges };
  const kept = focusNeighborhood(edges, ends, selectedIds);
  return {
    nodes: nodes.filter((node) => kept.has(node.id)),
    edges: edges.filter((edge) => {
      const [a, b] = ends(edge);
      return kept.has(a) && kept.has(b);
    }),
  };
}

/** Whether `edge` touches any of `ids`: the lines to highlight when one of them is in focus. */
export function touchesAny<E>(edge: E, ends: EdgeEnds<E>, ids: ReadonlySet<string>): boolean {
  const [a, b] = ends(edge);
  return ids.has(a) || ids.has(b);
}

/** Cuts a selection to what the focus filter takes, and says whether anything was left out. */
export function limitFocusSelection(selectedIds: readonly string[]): {
  ids: string[];
  truncated: boolean;
} {
  return {
    ids: selectedIds.slice(0, MAX_FOCUS_SELECTION),
    truncated: selectedIds.length > MAX_FOCUS_SELECTION,
  };
}

/** How many edges each node has. A node with none is absent from the map. */
export function degreeById<E>(edges: readonly E[], ends: EdgeEnds<E>): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    const [a, b] = ends(edge);
    degrees.set(a, (degrees.get(a) ?? 0) + 1);
    if (b !== a) degrees.set(b, (degrees.get(b) ?? 0) + 1);
  }
  return degrees;
}

export interface PositionedGraphNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The rectangle that holds the nodes with these ids, with some air around it, or null when none of
 * them is in `nodes`. It is what a screen frames to show a node together with the ones around it.
 */
export function boundsOfNodes(
  nodes: readonly PositionedGraphNode[],
  ids: ReadonlySet<string>,
  padding = 24,
): { x: number; y: number; width: number; height: number } | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const node of nodes) {
    if (!ids.has(node.id)) continue;
    left = Math.min(left, node.x);
    top = Math.min(top, node.y);
    right = Math.max(right, node.x + node.width);
    bottom = Math.max(bottom, node.y + node.height);
  }
  if (left === Infinity) return null;
  return {
    x: left - padding,
    y: top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
  };
}
