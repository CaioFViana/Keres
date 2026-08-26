/** Uma ponta de um par: o tipo da entidade e o id dela. */
export interface EntityPairRef {
  type: string;
  id: string;
}

/**
 * Canonical ordering of an unordered pair.
 *
 * A "See also" link between A and B is the same link between B and A, but the database stores two
 * columns. Without a fixed order, the same pair goes in twice - the duplicate check looks in the
 * order it arrived and does not find the row stored the other way around. Client and server have to
 * sort identically, and each one had its own copy of the function.
 */
export function sortEntityPair(a: EntityPairRef, b: EntityPairRef): [EntityPairRef, EntityPairRef] {
  return `${a.type}:${a.id}` <= `${b.type}:${b.id}` ? [a, b] : [b, a];
}

/**
 * The same canonicalisation for a pair of ids of a known type - a character relation, where both
 * ends are always characters and only the ids need ordering. The API's sync handler sorts before
 * writing so the unique constraint on the ordered pair behaves as an unordered one; its import path
 * has to sort identically or (A,B) and (B,A) both get in.
 */
export function sortIdPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function isSameEntity(a: EntityPairRef, b: EntityPairRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/** A single message for both ends to refuse linking an entity to itself. */
export const SELF_LINK_ERROR = 'Validation Error: an entity cannot be See-Also-linked to itself.';
