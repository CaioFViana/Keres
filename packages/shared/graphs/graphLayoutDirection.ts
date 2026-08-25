/** Direção de leitura dos grafos que têm fluxo/hierarquia. */
export type GraphLayoutDirection = 'top-to-bottom' | 'left-to-right';

export const GRAPH_LAYOUT_DIRECTIONS = {
  compact: 'top-to-bottom',
  expanded: 'left-to-right',
} as const satisfies Record<string, GraphLayoutDirection>;
