/**
 * @jest-environment node
 */
import {
  chapterBelongsToArc,
  entityBelongsToActiveArc,
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

describe('entityBelongsToActiveArc', () => {
  it('shows everything when no arc is selected', () => {
    expect(entityBelongsToActiveArc(['arc-1'], null)).toBe(true);
    expect(entityBelongsToActiveArc([], null)).toBe(true);
    expect(entityBelongsToActiveArc(undefined, null)).toBe(true);
  });

  it('keeps unlinked entities visible under any arc', () => {
    expect(entityBelongsToActiveArc([], 'arc-1')).toBe(true);
    expect(entityBelongsToActiveArc(undefined, 'arc-1')).toBe(true);
  });

  it('shows linked entities only in their arcs', () => {
    expect(entityBelongsToActiveArc(['arc-1', 'arc-2'], 'arc-2')).toBe(true);
    expect(entityBelongsToActiveArc(['arc-1'], 'arc-2')).toBe(false);
  });
});

describe('resolveEffectiveTheme', () => {
  it('prefers the arc override then the story theme', () => {
    expect(resolveEffectiveTheme('sunset', 'twilight')).toBe('twilight');
    expect(resolveEffectiveTheme('sunset', null)).toBe('sunset');
    expect(resolveEffectiveTheme(null, null)).toBe('default');
  });
});
