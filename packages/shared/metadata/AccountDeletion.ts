/**
 * Days between self-service account deletion and the prune that erases personal data.
 *
 * One constant for every layer that names the delay: the API's prune scheduler, the terms
 * of service promising erasure "within N days", and the client's disclaimer. Change it in
 * one place and every promise stays consistent.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/**
 * Days a deleted story (or the story of an erased account) stays on the server before its data is erased for good.
 * The window in which the owner can still restore it, and in which a collaborator's device learns it is gone.
 * The server's retention job (`StoryRetentionService`) and the governance record both use this number.
 */
export const STORY_DELETION_GRACE_DAYS = 30;
