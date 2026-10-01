import { describe, expect, it } from 'vitest';
import {
  deriveUserTag,
  normalizeUserTag,
  slugifyUserTag,
  UpdateUserTagSchema,
  UserTagSchema,
} from '../../schemas/UserTagSchemas';

describe('normalizeUserTag', () => {
  it('makes the same tag of every way a person writes it', () => {
    for (const typed of [
      'caio_viana',
      'CAIO_VIANA',
      'Caio Viana',
      '@Caio Viana',
      '  @caio   viana ',
    ]) {
      expect(normalizeUserTag(typed)).toBe('caio_viana');
    }
  });

  it('folds accents and turns symbols into one underscore', () => {
    expect(normalizeUserTag('João Ávila')).toBe('joao_avila');
    expect(normalizeUserTag('a!!b??c')).toBe('a_b_c');
    expect(normalizeUserTag('a - b')).toBe('a_b');
  });

  it('leaves no underscore at either end, and none doubled', () => {
    expect(normalizeUserTag('__ana__')).toBe('ana');
    expect(normalizeUserTag('ana!')).toBe('ana');
    expect(normalizeUserTag('a__b')).toBe('a_b');
  });

  it('is stable: a tag already in shape comes back as it is', () => {
    for (const tag of ['caio', 'caio_1', 'a1b2c3']) expect(normalizeUserTag(tag)).toBe(tag);
  });

  it('does not cut a long input down: a lookup must not find somebody else', () => {
    expect(normalizeUserTag('a'.repeat(40))).toBe('a'.repeat(40));
  });

  it('reads nothing out of what has nothing in it', () => {
    expect(normalizeUserTag('!!!')).toBe('');
    expect(normalizeUserTag('@')).toBe('');
  });
});

describe('slugifyUserTag', () => {
  it('cuts to the limit, with no underscore left at the end of the cut', () => {
    expect(slugifyUserTag('a'.repeat(30))).toBe('a'.repeat(20));
    expect(slugifyUserTag('abcd efgh', 5)).toBe('abcd');
  });
});

describe('deriveUserTag', () => {
  const id = '01KABCDEFGHJKMNPQRSTVWXYZ9';

  it('is the slug of the username when that is long enough', () => {
    expect(deriveUserTag('Caio Viana', id)).toBe('caio_viana');
  });

  it('adds the end of the account id to a name too short to be a tag, or with nothing in it', () => {
    expect(deriveUserTag('ab', id)).toBe('abxyz9');
    expect(deriveUserTag('!!!', id)).toBe('userxyz9');
  });

  it('adds it too when asked, which is how a clash with another account is settled', () => {
    expect(deriveUserTag('caio', id, { suffixed: true })).toBe('caioxyz9');
  });

  it('keeps even a long, suffixed tag within the limit', () => {
    const tag = deriveUserTag('a very very long username indeed', id, { suffixed: true });

    expect(tag.length).toBeLessThanOrEqual(20);
    expect(tag.endsWith('xyz9')).toBe(true);
    expect(UserTagSchema.safeParse(tag).success).toBe(true);
  });

  it('always makes a valid tag, whatever the username', () => {
    for (const username of ['x', 'Ana Maria', '###', 'ÁÉÍ óú', 'a'.repeat(99), '  ']) {
      for (const suffixed of [false, true]) {
        expect(UserTagSchema.safeParse(deriveUserTag(username, id, { suffixed })).success).toBe(
          true,
        );
      }
    }
  });
});

describe('UserTagSchema', () => {
  it('stores the slug of what was sent', () => {
    expect(UpdateUserTagSchema.parse({ tag: '@Caio Viana' })).toEqual({ tag: 'caio_viana' });
  });

  it('wants 3 to 20 characters of it', () => {
    expect(() => UserTagSchema.parse('ab')).toThrow(/at least 3/);
    expect(() => UserTagSchema.parse('a'.repeat(21))).toThrow(/at most 20/);
    expect(() => UserTagSchema.parse('!!!')).toThrow(/at least 3/);
    expect(UserTagSchema.parse('a'.repeat(20))).toBe('a'.repeat(20));
  });
});
