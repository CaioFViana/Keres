import { buildMentionMatcher } from '../../src/utils/entityMentions';
import {
  buildAmbiguousMentionIndex,
  buildMentionBacklinkIndex,
  mentionRefKey,
} from '../../src/mentions/mentionBacklinks';

describe('mention backlinks', () => {
  it('uses the exact same conservative matcher as automatic links', () => {
    const matcher = buildMentionMatcher([
      { type: 'Character', id: 'alice', name: 'Alice' },
      { type: 'Location', id: 'wonderland', name: 'Wonderland' },
    ]);
    const index = buildMentionBacklinkIndex(
      [
        {
          type: 'Scene',
          id: 'scene-1',
          name: 'A beginning',
          fields: { summary: 'Alice arrives in Wonderland. Alice stays.' },
        },
      ],
      matcher,
    );

    expect(index.get(mentionRefKey('Character', 'alice'))).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ id: 'scene-1' }),
        fields: ['summary'],
        mentionCount: 2,
      }),
    ]);
    expect(index.get(mentionRefKey('Location', 'wonderland'))).toHaveLength(1);
  });

  it('groups several fields from one source while retaining the total occurrence count', () => {
    const matcher = buildMentionMatcher([{ type: 'Character', id: 'alice', name: 'Alice' }]);
    const index = buildMentionBacklinkIndex(
      [
        {
          type: 'Scene',
          id: 'scene-1',
          name: 'A beginning',
          fields: { summary: 'Alice arrives.', extraNotes: 'Alice leaves. Alice returns.' },
        },
      ],
      matcher,
    );

    expect(index.get(mentionRefKey('Character', 'alice'))).toEqual([
      expect.objectContaining({ fields: ['summary', 'extraNotes'], mentionCount: 3 }),
    ]);
  });

  it('does not create backlinks for ambiguous names or self-references', () => {
    const matcher = buildMentionMatcher([
      { type: 'Character', id: 'first', name: 'Robin' },
      { type: 'Character', id: 'second', name: 'Robin' },
    ]);
    const index = buildMentionBacklinkIndex(
      [
        {
          type: 'Character',
          id: 'first',
          name: 'Robin',
          fields: { biography: 'Robin remembers Robin.' },
        },
      ],
      matcher,
    );
    expect(index.size).toBe(0);
  });

  it('frames each field occurrence on its first match instead of the text head', () => {
    const matcher = buildMentionMatcher([{ type: 'Character', id: 'alice', name: 'Alice' }]);
    const longSummary = `${'Some rambling opening. '.repeat(20)}Alice finally arrives.`;
    const index = buildMentionBacklinkIndex(
      [
        {
          type: 'Scene',
          id: 'scene-1',
          name: 'A beginning',
          fields: { summary: longSummary, extraNotes: 'Alice leaves. Alice returns.' },
        },
      ],
      matcher,
    );
    const [entry] = index.get(mentionRefKey('Character', 'alice')) ?? [];

    expect(entry.excerpt).toContain('Alice finally arrives.');
    expect(entry.excerpt.startsWith('…')).toBe(true);
    expect(entry.occurrences).toEqual([
      { field: 'summary', mentionCount: 1, excerpt: entry.excerpt },
      {
        field: 'extraNotes',
        mentionCount: 2,
        excerpt: 'Alice leaves. Alice returns.',
      },
    ]);
  });
});

describe('ambiguous mentions', () => {
  it('returns no suggestions without ambiguous names', () => {
    const matcher = buildMentionMatcher([{ type: 'Character', id: 'alice', name: 'Alice' }]);
    const index = buildAmbiguousMentionIndex(
      [
        {
          type: 'Scene',
          id: 'scene-1',
          name: 'A beginning',
          fields: { summary: 'Alice arrives.' },
        },
      ],
      matcher,
    );
    expect(index.size).toBe(0);
  });

  it('groups occurrences by source, name and field with the other claimants', () => {
    const matcher = buildMentionMatcher([
      { type: 'Character', id: 'first', name: 'Robin' },
      { type: 'Character', id: 'second', name: 'Robin' },
    ]);
    const index = buildAmbiguousMentionIndex(
      [
        {
          type: 'Scene',
          id: 'scene-1',
          name: 'A beginning',
          fields: { summary: 'Robin arrives. Robin stays.', extraNotes: 'Robin leaves.' },
        },
      ],
      matcher,
    );
    const suggestions = index.get(mentionRefKey('Scene', 'scene-1')) ?? [];

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual({
      name: 'Robin',
      field: 'summary',
      mentionCount: 2,
      excerpt: 'Robin arrives. Robin stays.',
      candidates: [
        { type: 'Character', id: 'first', name: 'Robin' },
        { type: 'Character', id: 'second', name: 'Robin' },
      ],
    });
    expect(suggestions[1]).toMatchObject({ name: 'Robin', field: 'extraNotes', mentionCount: 1 });
  });

  it('never suggests the source itself as a candidate', () => {
    const matcher = buildMentionMatcher([
      { type: 'Character', id: 'first', name: 'Robin' },
      { type: 'Character', id: 'second', name: 'Robin' },
    ]);
    const index = buildAmbiguousMentionIndex(
      [
        {
          type: 'Character',
          id: 'first',
          name: 'Robin',
          fields: { biography: 'Robin remembers Robin.' },
        },
      ],
      matcher,
    );
    const [suggestion] = index.get(mentionRefKey('Character', 'first')) ?? [];

    expect(suggestion.candidates).toEqual([{ type: 'Character', id: 'second', name: 'Robin' }]);
  });
});
