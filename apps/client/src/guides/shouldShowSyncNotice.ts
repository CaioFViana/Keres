/** The id the dismissed notice leaves in the seen history (`client_settings.seen_tutorials`). */
export const SYNC_ACCOUNT_NOTICE_ID = 'sync-account-prompt';

interface ShouldShowSyncNoticeInput {
  /** The browser build with no server feature: there is no account to offer. */
  serverless: boolean;
  /** How many servers this device knows; `null` until they have been read. */
  serverCount: number | null;
  seen: readonly string[];
  showTutorials: boolean;
  isShowcase: boolean;
}

/**
 * Whether the "create an account to sync and collaborate" bar shows in the story list. Pure so the rule
 * stays unit-testable; the hook (`useSyncAccountNotice`) only wires the inputs. Whoever already has a
 * server has an account to sync with, so only a device with none is told.
 */
export function shouldShowSyncNotice(input: ShouldShowSyncNoticeInput): boolean {
  if (input.serverless || input.isShowcase || !input.showTutorials) return false;
  if (input.serverCount === null || input.serverCount > 0) return false;
  return !input.seen.includes(SYNC_ACCOUNT_NOTICE_ID);
}
