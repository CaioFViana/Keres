/**
 * @jest-environment node
 */
import {
  chapterBelongsToArc,
  resolveEffectiveTheme,
  sceneBelongsToActiveArc,
} from '../../src/utils/storyArcFilter';

describe('chapterBelongsToArc', () => {
  it('shows everything when no arc is selected', () => {
    expect(chapterBelongsToArc({ arcId: 'a' }, null)).toBe(true);
  });

  it('keeps only containers assigned to the selected arc', () => {
    expect(chapterBelongsToArc({ arcId: 'a' }, 'a')).toBe(true);
    expect(chapterBelongsToArc({ arcId: 'b' }, 'a')).toBe(false);
    expect(chapterBelongsToArc({ arcId: null }, 'a')).toBe(false);
  });
});

describe('sceneBelongsToActiveArc', () => {
  const chapters = new Map([
    ['ch-a', { arcId: 'a' }],
    ['ch-b', { arcId: 'b' }],
    ['ch-none', { arcId: null }],
  ]);

  it('keeps unchaptered scenes visible', () => {
    expect(sceneBelongsToActiveArc({ chapterId: null }, chapters, 'a')).toBe(true);
  });

  it('inherits the container arc', () => {
    expect(sceneBelongsToActiveArc({ chapterId: 'ch-a' }, chapters, 'a')).toBe(true);
    expect(sceneBelongsToActiveArc({ chapterId: 'ch-b' }, chapters, 'a')).toBe(false);
    expect(sceneBelongsToActiveArc({ chapterId: 'ch-none' }, chapters, 'a')).toBe(false);
  });

  it('keeps scenes whose chapter is missing from the map', () => {
    expect(sceneBelongsToActiveArc({ chapterId: 'gone' }, chapters, 'a')).toBe(true);
  });
});

describe('resolveEffectiveTheme', () => {
  it('prefers the arc override then the story theme', () => {
    expect(resolveEffectiveTheme('sunset', 'twilight')).toBe('twilight');
    expect(resolveEffectiveTheme('sunset', null)).toBe('sunset');
    expect(resolveEffectiveTheme(null, null)).toBe('default');
  });
});
