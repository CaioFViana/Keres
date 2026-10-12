/**
 * Days between self-service account deletion and the prune that erases personal data.
 *
 * One constant for every layer that names the delay: the API's prune scheduler, the terms
 * of service promising erasure "within N days", and the client's disclaimer. Change it in
 * one place and every promise stays consistent.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;
