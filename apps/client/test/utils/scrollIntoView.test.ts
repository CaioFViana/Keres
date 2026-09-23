import { computeScrollAdjustment } from '../../src/utils/scrollIntoView';

describe('computeScrollAdjustment', () => {
  const view = { viewTop: 100, viewBottom: 500, margin: 40 };

  it('leaves a visible segment alone', () => {
    expect(computeScrollAdjustment({ segTop: 200, segBottom: 220, ...view })).toBeNull();
    expect(computeScrollAdjustment({ segTop: 140, segBottom: 460, ...view })).toBeNull();
  });

  it('scrolls up by the minimum that clears the top margin', () => {
    expect(computeScrollAdjustment({ segTop: 110, segBottom: 130, ...view })).toBe(-30);
  });

  it('scrolls down by the minimum that clears the bottom margin', () => {
    expect(computeScrollAdjustment({ segTop: 450, segBottom: 480, ...view })).toBe(20);
  });

  it('prefers the top edge when the segment overflows both margins', () => {
    expect(computeScrollAdjustment({ segTop: 50, segBottom: 600, ...view })).toBe(50 - 140);
  });
});
