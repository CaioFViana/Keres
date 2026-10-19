/*
 * How a user tag is read and made: plain text rules, no schema library. They live apart from
 * `UserTagSchemas` (which re-exports them) so a page that only slugifies - the admin panel's user form
 * - does not take zod into its bundle with them.
 */

export const USER_TAG_MIN_LENGTH = 3;
export const USER_TAG_MAX_LENGTH = 20;

/**
 * A tag as it is stored and looked up: lowercase letters, digits and underscores, nothing else.
 *
 * People type it by hand, in whatever shape - "@Caio Viana", " JOÃO!! " - so it is read the way a
 * slug is made: a leading "@" goes, accents are folded ("João" is "joao"), capitals become lowercase,
 * and every run of anything that is not a letter, digit or underscore (spaces included) becomes one
 * underscore, with none left at either end. "@Caio Viana" is `caio_viana`, and so is "caio viana" and
 * "CAIO_VIANA": the same person, found by any of them.
 *
 * It does not shorten or pad: whether the result is long enough is `UserTagSchema`'s call, and a
 * lookup must never cut a long input down to somebody else's tag.
 */
export function normalizeUserTag(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** `normalizeUserTag`, cut to at most `maxLength` characters (and again with no underscore at the end). */
export function slugifyUserTag(input: string, maxLength = USER_TAG_MAX_LENGTH): string {
  return normalizeUserTag(input).slice(0, maxLength).replace(/_+$/, '');
}

/**
 * The tag an account starts with, made from its username - which can hold spaces, capitals, symbols and
 * any length, none of which a tag may.
 *
 * The username's slug when it is long enough; otherwise, or when `suffixed` (the slug is taken by
 * someone else), the slug with the last four characters of the account's id on the end, which makes it
 * unique in practice and keeps the whole within the limit. A username with nothing usable in it ("!!!")
 * starts from "user".
 */
export function deriveUserTag(
  username: string,
  accountId: string,
  options: { suffixed?: boolean } = {},
): string {
  const tail = accountId
    .slice(-4)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const plain = slugifyUserTag(username);
  if (!options.suffixed && plain.length >= USER_TAG_MIN_LENGTH) return plain;
  const base = slugifyUserTag(username, USER_TAG_MAX_LENGTH - tail.length) || 'user';
  return `${base}${tail}`;
}
