import type { ServerSelect } from '../db/schemas/servers';
import { fetchVerificationStatus } from '../services/AgeVerificationApiService';
import type { KeresAuthSuccess } from './keresServerAuth';

/**
 * Whether the account just saved on a server must be verified before it is used. A registration says so in its
 * answer; a login asks the server, which says pending, rejected or expired for an account that cannot be used yet.
 * A server with no such route (older servers) has no verification: its account is usable as it always was.
 */
export async function accountNeedsVerification(
  server: ServerSelect,
  auth: KeresAuthSuccess,
  isRegistering: boolean,
): Promise<boolean> {
  if (isRegistering) return auth.verification?.status === 'pending';
  if (!auth.tokensChanged) return false;
  try {
    const { status } = await fetchVerificationStatus(server);
    return status === 'pending' || status === 'rejected' || status === 'expired';
  } catch {
    return false;
  }
}
