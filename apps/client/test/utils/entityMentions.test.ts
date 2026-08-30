import {
  buildMentionMatcher,
  EMPTY_MENTION_MATCHER,
  type MentionableEntity,
  splitTextIntoMentionSegments,
} from '../../src/utils/entityMentions';

/**
 * The matching rule is the whole feature. Auto-linking has no syntax and no per-mention override,
 * so every false positive is one the writer cannot correct - which is why these tests are mostly
 * about what must *not* link.
 */

const character = (id: string, name: string): MentionableEntity => ({
  type: 'Character',
  id,
  name,
});
const item = (id: string, name: string): MentionableEntity => ({ type: 'Item', id, name });

const matcherFor = (...entities: MentionableEntity[]) => buildMentionMatcher(entities);

const linkedNames = (segments: { text: string; ref?: unknown }[]) =>
  segments.filter((segment) => segment.ref).map((segment) => segment.text);

describe('buildMentionMatcher', () => {
  it('ignores names below the minimum length', () => {
    const matcher = matcherFor(character('c1', 'Al'), character('c2', 'Ed'));
    expect(matcher.isEmpty).toBe(true);
  });

  it('ignores blank names and names with no letters or digits', () => {
    const matcher = matcherFor(character('c1', '   '), character('c2', '???'));
    expect(matcher.isEmpty).toBe(true);
  });

  it('drops a name two active entities share', () => {
    const matcher = matcherFor(character('c1', 'Rosa'), item('i1', 'Rosa'));
    expect(matcher.isEmpty).toBe(true);
  });

  it('keeps a name repeated by the same entity id', () => {
    const matcher = matcherFor(character('c1', 'Rosa'), character('c1', 'Rosa'));
    expect(matcher.isEmpty).toBe(false);
  });
});

describe('splitTextIntoMentionSegments', () => {
  it('returns nothing for empty text', () => {
    expect(splitTextIntoMentionSegments('', matcherFor(character('c1', 'Alice')))).toEqual([]);
    expect(splitTextIntoMentionSegments(null, matcherFor(character('c1', 'Alice')))).toEqual([]);
  });

  it('returns one plain run when nothing can match', () => {
    expect(splitTextIntoMentionSegments('anything at all', EMPTY_MENTION_MATCHER)).toEqual([
      { text: 'anything at all' },
    ]);
  });

  it('preserves the original text exactly', () => {
    const text = 'Alice met the Rabbit, and Alice smiled.';
    const segments = splitTextIntoMentionSegments(
      text,
      matcherFor(character('c1', 'Alice'), character('c2', 'Rabbit')),
    );
    expect(segments.map((segment) => segment.text).join('')).toBe(text);
  });

  it('links a mention and carries the entity reference', () => {
    const segments = splitTextIntoMentionSegments(
      'Alice went home.',
      matcherFor(character('c1', 'Alice')),
    );
    expect(segments).toEqual([
      { text: 'Alice', ref: { type: 'Character', id: 'c1' } },
      { text: ' went home.' },
    ]);
  });

  /**
   * The rule that carries the feature: proper nouns are capitalised in both languages and the
   * common words that collide with them are not. Without it, an Item named `Espada` would light
   * up every sword in the story.
   */
  it('matches case-sensitively', () => {
    const matcher = matcherFor(item('i1', 'Espada'));
    expect(linkedNames(splitTextIntoMentionSegments('A Espada brilhava.', matcher))).toEqual([
      'Espada',
    ]);
    expect(linkedNames(splitTextIntoMentionSegments('A espada brilhava.', matcher))).toEqual([]);
  });

  describe('word boundaries', () => {
    it('does not match inside a longer word', () => {
      const matcher = matcherFor(character('c1', 'Ali'));
      expect(linkedNames(splitTextIntoMentionSegments('Alice smiled.', matcher))).toEqual([]);
    });

    it('does not match when the name ends against a letter', () => {
      const matcher = matcherFor(character('c1', 'Rose'));
      expect(linkedNames(splitTextIntoMentionSegments('Rosemary waited.', matcher))).toEqual([]);
    });

    it('matches against punctuation, including possessives', () => {
      const matcher = matcherFor(character('c1', 'Alice'));
      expect(linkedNames(splitTextIntoMentionSegments("Alice's sword.", matcher))).toEqual([
        'Alice',
      ]);
      expect(linkedNames(splitTextIntoMentionSegments('(Alice)', matcher))).toEqual(['Alice']);
    });

    /**
     * `\b` is ASCII-only in JavaScript, so an accented name is exactly where a naive
     * implementation breaks - and this app is full of them.
     */
    it('treats accented letters as word characters', () => {
      const matcher = matcherFor(character('c1', 'João'));
      expect(linkedNames(splitTextIntoMentionSegments('João chegou.', matcher))).toEqual(['João']);
      expect(linkedNames(splitTextIntoMentionSegments('O porto de São João.', matcher))).toEqual([
        'João',
      ]);
      expect(linkedNames(splitTextIntoMentionSegments('Joãozinho chegou.', matcher))).toEqual([]);
    });

    it('does not match a name that begins inside another word', () => {
      const matcher = matcherFor(character('c1', 'Ana'));
      expect(linkedNames(splitTextIntoMentionSegments('Joana chegou.', matcher))).toEqual([]);
    });
  });

  it('prefers the longest name when two could match', () => {
    const segments = splitTextIntoMentionSegments(
      'Alice Liddell arrived.',
      matcherFor(character('c1', 'Alice'), character('c2', 'Alice Liddell')),
    );
    expect(segments[0]).toEqual({ text: 'Alice Liddell', ref: { type: 'Character', id: 'c2' } });
  });

  it('matches a name containing punctuation', () => {
    const matcher = matcherFor(character('c1', 'Jean-Luc Picard'));
    expect(linkedNames(splitTextIntoMentionSegments('Jean-Luc Picard spoke.', matcher))).toEqual([
      'Jean-Luc Picard',
    ]);
  });

  it('does not link an ambiguous name', () => {
    const segments = splitTextIntoMentionSegments(
      'Rosa was there.',
      matcherFor(character('c1', 'Rosa'), item('i1', 'Rosa')),
    );
    expect(segments).toEqual([{ text: 'Rosa was there.' }]);
  });

  it('never links an entity to itself', () => {
    const matcher = matcherFor(character('c1', 'Alice'), character('c2', 'Rabbit'));
    const segments = splitTextIntoMentionSegments('Alice met the Rabbit.', matcher, {
      selfId: 'c1',
    });
    expect(linkedNames(segments)).toEqual(['Rabbit']);
  });

  /**
   * Forty mentions of the same character in a biography would otherwise be forty blue words.
   * Each entity still gets its own first link.
   */
  it('links only the first occurrence of each entity', () => {
    const matcher = matcherFor(character('c1', 'Alice'), character('c2', 'Rabbit'));
    const segments = splitTextIntoMentionSegments(
      'Alice saw the Rabbit. Alice ran. The Rabbit ran too.',
      matcher,
    );
    expect(linkedNames(segments)).toEqual(['Alice', 'Rabbit']);
    expect(segments.map((segment) => segment.text).join('')).toBe(
      'Alice saw the Rabbit. Alice ran. The Rabbit ran too.',
    );
  });

  it('links several different entities in one text', () => {
    const matcher = matcherFor(
      character('c1', 'Alice'),
      character('c2', 'Rabbit'),
      item('i1', 'Espada'),
    );
    expect(
      linkedNames(splitTextIntoMentionSegments('Alice, the Rabbit and the Espada.', matcher)),
    ).toEqual(['Alice', 'Rabbit', 'Espada']);
  });

  it('links a mention at the very start and at the very end', () => {
    const matcher = matcherFor(character('c1', 'Alice'));
    expect(splitTextIntoMentionSegments('Alice', matcher)).toEqual([
      { text: 'Alice', ref: { type: 'Character', id: 'c1' } },
    ]);
  });

  it('does not let a longer match be broken by a nested name', () => {
    const matcher = matcherFor(character('c1', 'Alice Liddell'), character('c2', 'Liddell'));
    const segments = splitTextIntoMentionSegments('Alice Liddell arrived.', matcher);
    expect(linkedNames(segments)).toEqual(['Alice Liddell']);
  });
});
