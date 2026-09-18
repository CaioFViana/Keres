/**
 * @jest-environment node
 */
import {
  DRAWER_SWIPE_EDGE_WIDTH,
  DRAWER_SWIPE_MIN_DISTANCE,
} from '../../src/navigation/drawerInteraction';

describe('drawerInteraction', () => {
  it('keeps drawer drags deliberate and edge-only', () => {
    expect(DRAWER_SWIPE_EDGE_WIDTH).toBe(28);
    expect(DRAWER_SWIPE_MIN_DISTANCE).toBe(24);
  });
});
