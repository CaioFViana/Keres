/**
 * The reason behind a lost story access, ahead of the copy being dropped.
 *
 * The server emits `story.access-revoked` (with the reason) right before `stories.catalog-changed`
 * (which drops the local copy through `dropRevokedServerStories`). The reason is noted here so the
 * drop can explain itself instead of showing the generic "access lost" message. Entries are
 * taken once - a reason nobody reads is simply forgotten.
 */
export type AccessRevocationReason =
  | 'nsfw-story'
  | 'verification-revoked'
  | 'account-deactivated'
  | 'removed-by-admin';

const pending = new Map<string, AccessRevocationReason>();

export function noteAccessRevocation(storyId: string, reason: AccessRevocationReason): void {
  pending.set(storyId, reason);
}

export function takeAccessRevocation(storyId: string): AccessRevocationReason | undefined {
  const reason = pending.get(storyId);
  pending.delete(storyId);
  return reason;
}
