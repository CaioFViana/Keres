import { AppError } from '@/utils/errors';
import { userService } from '@/services/accounts/UserService';
import {
  ageVerificationService,
  type RequestedSending,
  VerificationUnavailableError,
} from './AgeVerificationService';

/**
 * Registration of an account in `required` mode (see `docs/age_verification.md`): the verification service is asked for
 * a sending before the account exists, and the account and its sending are recorded together or not at all. The route
 * keeps the request handling; what has to be undone when a step fails lives here.
 */

const VERIFICATION_UNAVAILABLE_MESSAGE =
  'Account creation is unavailable on this server right now.';

/** Refused because the verification service cannot take a sending right now. Nothing was created. */
export function verificationUnavailable(): AppError {
  return new AppError(503, VERIFICATION_UNAVAILABLE_MESSAGE, 'verification_unavailable');
}

/** Asks the verification service for a sending of a new account; a service that cannot take it refuses the registration. */
export async function requestSendingFor(
  userId: string,
  username: string,
  language: string,
): Promise<RequestedSending> {
  try {
    return await ageVerificationService.requestFromVerifier({ userId, username, language });
  } catch (error) {
    if (error instanceof VerificationUnavailableError) throw verificationUnavailable();
    throw error;
  }
}

/**
 * Creates the account and, where verification is required, records the sending it goes with: the two are made together
 * or not at all. When the sending cannot be recorded the account is taken away again, and the service is asked to drop
 * the sending, so nothing is left half-made.
 */
export async function createRegisteredAccount(
  input: { id: string; username: string; hashedPassword: string; defaultTierId: string | null },
  sending: RequestedSending | null,
) {
  if (!sending) return userService.createAccount(input);
  let created: Awaited<ReturnType<typeof userService.createAccount>> | undefined;
  try {
    created = await userService.createAccount({ ...input, verificationStatus: 'pending' });
    if (created === 'taken') {
      await ageVerificationService.cancelSending(sending);
      return created;
    }
    await ageVerificationService.recordPending(sending, 1);
    return created;
  } catch (error) {
    if (created && created !== 'taken') await userService.discardNewAccount(created.id);
    await ageVerificationService.cancelSending(sending);
    throw error;
  }
}
