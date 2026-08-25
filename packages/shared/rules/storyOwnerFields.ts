/**
 * Fields of a story that only the owner may change.
 *
 * The rule exists on both sides: the client refuses the edit before writing to the operation log
 * (otherwise the change would be stuck, rejected on every push), and the server refuses it again
 * when the synchronization arrives. Two hand-written lists diverged - the client had three fields
 * and the server five - and nobody noticed, because the difference only shows up when a
 * collaborator tries to change exactly the field one of the lists was missing.
 */
export const STORY_OWNER_ONLY_FIELDS = [
  'id',
  'userId',
  'type',
  'favoriteBehavior',
  'allowReaderComments',
] as const;

export type StoryOwnerOnlyField = (typeof STORY_OWNER_ONLY_FIELDS)[number];

/** The fields of a change that only the owner could make. Empty = the change is allowed. */
export function ownerOnlyFieldsIn(changes: Record<string, unknown> | undefined | null): string[] {
  if (!changes) return [];
  return STORY_OWNER_ONLY_FIELDS.filter((field) => changes[field] !== undefined);
}
