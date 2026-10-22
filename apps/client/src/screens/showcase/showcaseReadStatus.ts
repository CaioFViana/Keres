import { isNotFoundError, isOfflineError } from '@/src/services/api/apiClient';

/** Why a read of the public site did not work, in the words the screens use. */
export type ShowcaseReadFailure = 'not_found' | 'unreachable' | 'failed';

export function showcaseReadFailure(error: unknown): ShowcaseReadFailure {
  if (isNotFoundError(error)) return 'not_found';
  if (isOfflineError(error)) return 'unreachable';
  return 'failed';
}
