import { describe, expect, it } from 'vitest';
import {
  GRAPH_LAYOUT_DIRECTIONS,
  type GraphLayoutDirection,
} from '../../graphs/graphLayoutDirection';

describe('graph layout directions', () => {
  it('uses vertical flow for compact layouts and horizontal flow for expanded layouts', () => {
    expect(GRAPH_LAYOUT_DIRECTIONS).toEqual({
      compact: 'top-to-bottom',
      expanded: 'left-to-right',
    });
  });

  it('exposes only supported direction values', () => {
    const directions: GraphLayoutDirection[] = Object.values(GRAPH_LAYOUT_DIRECTIONS);

    expect(new Set(directions)).toEqual(new Set(['top-to-bottom', 'left-to-right']));
  });
});
