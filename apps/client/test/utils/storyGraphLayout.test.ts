import { wrapLabel } from '@keres/shared/graphs/storyGraphLayout';

describe('wrapLabel', () => {
  it('normalizes whitespace and keeps short labels intact', () => {
    expect(wrapLabel('  The   White Rabbit ')).toEqual(['The White Rabbit']);
  });

  it('truncates labels that exceed the configured line budget', () => {
    expect(wrapLabel('one two three four five', 7, 2)).toEqual(['one two', 'three…']);
    expect(wrapLabel('supercalifragilistic', 6, 2)).toEqual(['super…']);
  });
});
