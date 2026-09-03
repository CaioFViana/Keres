import { buildMentionMatcher } from '../../src/utils/entityMentions';
import { buildMentionBacklinkIndex, mentionRefKey } from '../../src/mentions/mentionBacklinks';

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
});
