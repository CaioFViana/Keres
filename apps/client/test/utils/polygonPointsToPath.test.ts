import { polygonPointsToPath } from '../../src/components/features/graphs/SkiaEdgeCanvas/polygonPointsToPath';

describe('polygonPointsToPath', () => {
  it('closes comma-separated pairs into a path', () => {
    expect(polygonPointsToPath('10,20 30,40 50,60')).toBe('M 10,20 L 30,40 L 50,60 Z');
  });

  it('tolerates stray whitespace and returns empty for blank input', () => {
    expect(polygonPointsToPath('  10,20   30,40 ')).toBe('M 10,20 L 30,40 Z');
    expect(polygonPointsToPath('   ')).toBe('');
  });
});
