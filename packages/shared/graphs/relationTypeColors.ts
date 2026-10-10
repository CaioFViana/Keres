/**
 * A colour for each kind of relation on a graph, taken from the kinds the author actually used. A
 * relation between characters is free text ("friend", "Friends", "rival"), so there is no fixed list to
 * paint: the colours are handed out to the texts that are there, and the legend names them.
 *
 * Pure on purpose: the screen and the exported image agree on which colour a kind has.
 */

/** Distinct to the eye, including for the common kinds of colour blindness (after Okabe and Ito). */
export const RELATION_TYPE_PALETTE = {
  light: ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#B8860B', '#56B4E9', '#7A5195', '#8C6D31'],
  dark: ['#56B4E9', '#FF8F5A', '#3DD6A3', '#E8A0CB', '#F0C14B', '#8CCBF0', '#B58BD6', '#C9A66B'],
} as const;

/** The same kind written differently - case, accents, blanks around - is one kind. */
export function foldRelationType(type: string): string {
  return type
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hashOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Hands out the palette to the kinds of relation: each kind prefers the colour its text hashes to, so
 * the same word keeps its colour from one story to the next, and when two kinds want the same one the
 * later (in alphabetical order) takes the next free colour. With more kinds than colours, the colours
 * repeat from the start. Keys of the result are folded kinds.
 */
export function assignRelationTypeColors(
  types: readonly string[],
  mode: 'light' | 'dark',
): Map<string, string> {
  const palette = RELATION_TYPE_PALETTE[mode];
  const folded = [...new Set(types.map(foldRelationType).filter(Boolean))].sort();
  const taken = new Set<number>();
  const colors = new Map<string, string>();
  for (const type of folded) {
    let slot = hashOf(type) % palette.length;
    if (taken.size < palette.length) {
      while (taken.has(slot)) slot = (slot + 1) % palette.length;
    }
    taken.add(slot);
    colors.set(type, palette[slot]);
  }
  return colors;
}
