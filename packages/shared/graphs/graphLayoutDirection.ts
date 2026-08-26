/** Reading direction for the graphs that have flow/hierarchy. */
export type GraphLayoutDirection = 'top-to-bottom' | 'left-to-right';

export const GRAPH_LAYOUT_DIRECTIONS = {
  compact: 'top-to-bottom',
  expanded: 'left-to-right',
} as const satisfies Record<string, GraphLayoutDirection>;
