import { describe, expect, it } from 'vitest';
import { formatBytes, formatDate, genreList, packContentLines } from '../../src/showcase/format';

/**
 * The site's formatting. The pack-lines plural rule mirrors the convention the translation audit
 * depends on (literal `_one`/`_other` keys), so the fake `t` echoes the key it receives.
 */
describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [2048, '2.0 KB'],
    [15360, '15 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [2 * 1024 * 1024 * 1024, '2.0 GB'],
  ])('renders %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('renders nothing for a date that never was', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('falls back to the browser locale when no language is given', () => {
    expect(formatDate('2026-08-19T10:00:00.000Z')).toContain('2026');
  });

  it('follows the chosen reading language, not the browser', () => {
    const english = formatDate('2026-08-19T10:00:00.000Z', 'en');
    const portuguese = formatDate('2026-08-19T10:00:00.000Z', 'pt');

    expect(english).toContain('2026');
    expect(english).toContain('Aug');
    expect(portuguese).toContain('2026');
    expect(portuguese).not.toBe(english);
  });
});

describe('genreList', () => {
  it('returns no genres for a story without one', () => {
    expect(genreList(null)).toEqual([]);
    expect(genreList('')).toEqual([]);
  });

  it('splits on comma, slash and semicolon, trimming the parts', () => {
    expect(genreList('Fantasy, Mystery / Horror;Sci-Fi')).toEqual([
      'Fantasy',
      'Mystery',
      'Horror',
      'Sci-Fi',
    ]);
  });

  it('drops empty parts', () => {
    expect(genreList('Fantasy,, / Mystery')).toEqual(['Fantasy', 'Mystery']);
  });
});

describe('packContentLines', () => {
  const t = (key: string, options?: Record<string, unknown>) => `${key}:${options?.count ?? ''}`;
  const noExtrasSummary = {
    chapterCount: 0,
    sceneCount: 0,
    characterCount: 0,
    locationCount: 0,
    worldRuleCount: 0,
    noteCount: 0,
    boardCount: 0,
    locationMapCount: 0,
  };

  it('mentions only what the pack carries, in field/stat/tag/suggestion order', () => {
    const lines = packContentLines(
      {
        fieldCount: 2,
        statCount: 0,
        tagCount: 1,
        suggestionCount: 0,
        hasVocabulary: false,
        statSystem: false,
        statNotation: 'number',
        ...noExtrasSummary,
      },
      t,
    );

    expect(lines).toEqual(['pack.fieldCount_other:2', 'pack.tagCount_one:1']);
  });

  it('says nothing for an empty pack', () => {
    const lines = packContentLines(
      {
        fieldCount: 0,
        statCount: 0,
        tagCount: 0,
        suggestionCount: 0,
        hasVocabulary: false,
        statSystem: false,
        statNotation: 'number',
        ...noExtrasSummary,
      },
      t,
    );

    expect(lines).toEqual([]);
  });

  it('adds the vocabulary and the stat notation after the counts', () => {
    const lines = packContentLines(
      {
        fieldCount: 0,
        statCount: 1,
        tagCount: 0,
        suggestionCount: 0,
        hasVocabulary: true,
        statSystem: true,
        statNotation: 'letter',
        ...noExtrasSummary,
      },
      t,
    );

    expect(lines).toEqual(['pack.statCount_one:1', 'pack.vocabulary:', 'pack.notation.letter:']);
  });
});
