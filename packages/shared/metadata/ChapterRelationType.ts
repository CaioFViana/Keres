/**
 * How two containers sit in time relative to each other.
 *
 * This is the story's **chronology**, which is a different axis from `chapters.index` - that one is
 * narrative order, the order things are told in. A story tells its middle first; the events behind
 * it still happened in one sequence, and a single counter cannot carry both.
 *
 * Both endpoints are rows in `chapters`, so one relation covers three cases without any
 * polymorphism: event to event ("the war was before the peace"), event to chapter ("the war ended
 * before chapter 4"), and chapter to chapter ("chapter 7 happened before chapter 2" - a flashback,
 * which had nowhere to be recorded until now).
 *
 * **Absence is meaningful and is the default.** No relation between two containers means the writer
 * has not said, never "they are unordered". That is the whole reason this is a relation rather than
 * a second index: an ordered list always answers "which came first", including when the honest
 * answer is that nobody knows.
 */

/**
 * Directional relations: `chapter1Id` is the subject, `chapter2Id` the reference.
 *
 * The same distinction `LOCATION_RELATION_TYPES` already draws between `contains` and
 * `connected_to`, for the same reason - reading a stored row correctly depends on knowing whether
 * the two columns are a sequence or a pair.
 */
export const DIRECTIONAL_CHAPTER_RELATION_TYPES = ['before', 'during'] as const;

/** Unordered relations: the pair means the same read either way round. */
export const UNORDERED_CHAPTER_RELATION_TYPES = ['overlaps', 'simultaneous'] as const;

export const CHAPTER_RELATION_TYPES = [
  ...DIRECTIONAL_CHAPTER_RELATION_TYPES,
  ...UNORDERED_CHAPTER_RELATION_TYPES,
] as const;

export type ChapterRelationType = (typeof CHAPTER_RELATION_TYPES)[number];

export function isDirectionalChapterRelation(type: string): boolean {
  return (DIRECTIONAL_CHAPTER_RELATION_TYPES as readonly string[]).includes(type);
}
