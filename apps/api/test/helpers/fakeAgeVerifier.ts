import type {
  AgeVerifier,
  VerificationEvent,
  VerificationRequest,
  VerificationResult,
  VerifierCapability,
} from '@keres/shared/age-verification/AgeVerificationConnector';
import { vi } from 'vitest';

/**
 * An age-verification service for the tests, and only for them: it speaks to no service and to no network. It stands in
 * for the service as the rest of the server sees it (`AgeVerifier`), with the optional parts each test asks for. The
 * events a real service would send are delivered by `postVerifierEvents` (`helpers/ageVerificationEvents.ts`), signed as
 * the contract says.
 */
export const FAKE_VERIFIER_ID = 'fakeverify';

export interface FakeVerifierOptions {
  /** Implements `getVerificationStatus` (capability `status`). */
  withStatus?: boolean;
  /** Implements `cancelVerification` (capability `cancel`). */
  withCancel?: boolean;
  /** What `createVerification` answers; the default is a redirect to the service's own page. */
  result?: (request: VerificationRequest) => VerificationResult;
}

export function createFakeAgeVerifier(options: FakeVerifierOptions = {}) {
  const requests: VerificationRequest[] = [];
  const state = {
    /** The answer of `getVerificationStatus`: null while the verification is open. */
    status: null as VerificationEvent | null,
    createFails: false,
    cancelFails: false,
  };

  const capabilities: VerifierCapability[] = [
    ...(options.withStatus ? (['status'] as const) : []),
    ...(options.withCancel ? (['cancel'] as const) : []),
  ];

  const createVerification = vi.fn(async (request: VerificationRequest) => {
    if (state.createFails) throw new Error('the service is down');
    requests.push(request);
    return (
      options.result?.(request) ?? {
        providerReference: `fake_ref_${request.verificationId}`,
        action: {
          kind: 'redirect' as const,
          url: `https://verify.example.test/v/${request.verificationId}`,
        },
      }
    );
  });
  const getVerificationStatus = vi.fn(
    async (_verificationId: string, _providerReference: string) => state.status,
  );
  const cancelVerification = vi.fn(async (_providerReference: string) => {
    if (state.cancelFails) throw new Error('the service refused');
  });

  const verifier: AgeVerifier = {
    id: FAKE_VERIFIER_ID,
    displayName: 'Fake Verify',
    capabilities,
    createVerification,
  };
  if (options.withStatus) verifier.getVerificationStatus = getVerificationStatus;
  if (options.withCancel) verifier.cancelVerification = cancelVerification;

  return {
    verifier,
    requests,
    state,
    createVerification,
    getVerificationStatus,
    cancelVerification,
  };
}
