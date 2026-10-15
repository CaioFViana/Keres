import {
  type VerificationEventWire,
  VerificationCancelResponseSchema,
  type VerificationActionSchema,
  VerificationRequestWireSchema,
  VerificationResultWireSchema,
  VerificationStatusResponseSchema,
  type VerifierInfo,
  VerifierInfoSchema,
} from '@keres/shared';
import type {
  AgeVerifier,
  VerificationAction,
  VerificationEvent,
  VerificationRequest,
  VerificationResult,
  VerifierCapability,
} from '@keres/shared/age-verification/AgeVerificationConnector';
import type { z } from 'zod';
import { env } from '@/config/env';
import { SignedClient, type SignedClientOptions, VerifierError } from './signedClient';

/** What a person is shown of the service's words: clipped, because they end up on screens and in the database. */
const MAX_TITLE = 120;
const MAX_TEXT = 2000;

/** The action as the service sent it, after the contract's own checks and before Keres' clipping. */
type WireAction = z.infer<typeof VerificationActionSchema>;

export type HttpVerifierOptions = SignedClientOptions & {
  /**
   * Lets a page open at a plain `http` address that is not this machine. Absent, the environment's
   * `AGE_VERIFICATION_ALLOW_INSECURE` says. A redirect is never followed, so this is only about where the person is sent.
   */
  allowInsecure?: boolean;
};

const isLoopbackHost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname === '::1';

/**
 * The age-verification service as the server uses it: a separate service, spoken to over HTTP, in the contract of
 * `docs/age_verification.md`. Nothing of it is loaded into this process - what it can do is what it says in
 * `/v1/info`, and each optional call exists only when the service said it implements it.
 *
 * Everything it returns has been signed by the service and validated against the contract before it is used; what is
 * not is an error, and a registration that needs the service is refused rather than made without a check.
 */
export class HttpVerifier implements AgeVerifier {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: readonly VerifierCapability[];

  getVerificationStatus?: (
    verificationId: string,
    providerReference: string,
  ) => Promise<VerificationEvent | null>;
  cancelVerification?: (providerReference: string) => Promise<void>;

  private readonly allowInsecure: boolean;

  private constructor(
    info: VerifierInfo,
    private readonly client: SignedClient,
    options: HttpVerifierOptions,
  ) {
    this.id = info.id;
    this.displayName = info.displayName;
    this.capabilities = info.capabilities;
    this.allowInsecure = options.allowInsecure ?? env.AGE_VERIFICATION_ALLOW_INSECURE;

    if (info.capabilities.includes('status')) {
      this.getVerificationStatus = async (verificationId, providerReference) => {
        const answer = await client.call(
          'GET',
          `/v1/verifications/${encodeURIComponent(verificationId)}?providerReference=${encodeURIComponent(providerReference)}`,
          undefined,
          VerificationStatusResponseSchema,
        );
        if (!answer.event) return null;
        // Signed, but still about one verification only: an answer about another one is not this one's fact.
        if (answer.event.verificationId !== verificationId) {
          throw new VerifierError(
            'The age-verification service answered about another verification.',
            'invalid',
          );
        }
        return toVerificationEvent(answer.event);
      };
    }
    if (info.capabilities.includes('cancel')) {
      this.cancelVerification = async (providerReference) => {
        await client.call(
          'POST',
          `/v1/verifications/${encodeURIComponent(providerReference)}/cancel`,
          {},
          VerificationCancelResponseSchema,
        );
      };
    }
  }

  /** Asks the service who it is, and holds it to the contract version this server speaks. */
  static async connect(options: HttpVerifierOptions): Promise<HttpVerifier> {
    const client = new SignedClient(options);
    const info = await client.call('GET', '/v1/info', undefined, VerifierInfoSchema);
    return new HttpVerifier(info, client, options);
  }

  async createVerification(request: VerificationRequest): Promise<VerificationResult> {
    // Checked before it is sent: a request Keres would not accept from a service is not sent to one.
    const outgoing = VerificationRequestWireSchema.safeParse(request);
    if (!outgoing.success) {
      throw new VerifierError(
        'Keres asked the age-verification service something outside the contract.',
        'invalid',
      );
    }
    const answer = await this.client.call(
      'POST',
      '/v1/verifications',
      outgoing.data,
      VerificationResultWireSchema,
      // The same verification, asked twice (a retry after a timeout), must be one submission at the service.
      { 'idempotency-key': request.verificationId },
    );
    return {
      providerReference: answer.providerReference,
      action: this.checkedAction(answer.action),
      ...(answer.expiresAt ? { expiresAt: new Date(answer.expiresAt) } : {}),
    };
  }

  private checkedAction(action: WireAction): VerificationAction {
    if (action.kind === 'instructions') {
      return {
        kind: 'instructions',
        title: action.title.slice(0, MAX_TITLE),
        text: action.text.slice(0, MAX_TEXT),
      };
    }
    return { kind: 'redirect', url: this.checkedRedirect(action.url) };
  }

  /**
   * The person is sent to this address, with their documents to come: https, or plain http only for this machine or
   * when the operator said so. Anything else (a `javascript:` or `data:` address, say) is refused.
   */
  private checkedRedirect(raw: string): string {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw refusedRedirect();
    }
    if (url.protocol === 'https:') return raw;
    if (url.protocol === 'http:' && (isLoopbackHost(url.hostname) || this.allowInsecure))
      return raw;
    throw refusedRedirect();
  }
}

function refusedRedirect(): VerifierError {
  return new VerifierError(
    'The age-verification service asked to open a page Keres does not accept (https is required).',
    'invalid',
  );
}

/** An event as it travels (JSON, dates as text) in the terms the verifications are written in. */
function toVerificationEvent(wire: VerificationEventWire): VerificationEvent {
  switch (wire.type) {
    case 'verification.approved':
      return {
        type: 'verification.approved',
        eventId: wire.eventId,
        verificationId: wire.verificationId,
        providerReference: wire.providerReference,
        decidedAt: new Date(wire.decidedAt),
        method: wire.method,
        identityCommitment: wire.identityCommitment,
        discardedAt: new Date(wire.discardedAt),
      };
    case 'verification.rejected':
      return {
        type: 'verification.rejected',
        eventId: wire.eventId,
        verificationId: wire.verificationId,
        providerReference: wire.providerReference,
        decidedAt: new Date(wire.decidedAt),
        reason: wire.reason,
        discardedAt: new Date(wire.discardedAt),
      };
    case 'verification.expired':
      return {
        type: 'verification.expired',
        eventId: wire.eventId,
        verificationId: wire.verificationId,
        ...(wire.providerReference ? { providerReference: wire.providerReference } : {}),
        discardedAt: new Date(wire.discardedAt),
      };
  }
}
