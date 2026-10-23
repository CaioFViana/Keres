/** The id the one-time notice leaves in the seen history (`client_settings.seen_tutorials`). */
export const SYNC_ACCOUNT_PROMPT_ID = 'sync-account-prompt';

interface ShouldShowSyncPromptInput {
  /** The browser build with no server feature: there is no account to offer. */
  serverless: boolean;
  /** How many servers this device knows; `null` until they have been read. */
  serverCount: number | null;
  seen: readonly string[];
  showTutorials: boolean;
  hasActiveTour: boolean;
  /** The screen's own tour has yet to be completed or skipped: it goes first. */
  tourPending: boolean;
  isShowcase: boolean;
}

/**
 * Whether the one-time "create an account to sync and collaborate" notice may open now. Pure so the rule
 * stays unit-testable; the hook (`useSyncAccountPrompt`) only wires the inputs. Whoever already has a
 * server has an account to sync with, so only a device with none is told.
 */
export function shouldShowSyncPrompt(input: ShouldShowSyncPromptInput): boolean {
  if (input.serverless || input.isShowcase || !input.showTutorials) return false;
  if (input.hasActiveTour || input.tourPending) return false;
  if (input.serverCount === null || input.serverCount > 0) return false;
  return !input.seen.includes(SYNC_ACCOUNT_PROMPT_ID);
}
