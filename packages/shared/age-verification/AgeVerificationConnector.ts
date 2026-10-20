/**
 * What Keres asks of an age-verification service, and what such a service tells Keres.
 *
 * An account on a Keres server is 18+ and verified (see `docs/compliance/age_verification.md`). The verification is not done by
 * the server: it is a **separate service** run by the operator of that server (the official one by the Keres team, a
 * third-party server by whoever hosts it). The person sends an identity document and a live photo **to that service**,
 * a human reviewer there checks them and decides, and the service tells the server only the signed result. The
 * server never sees a document, a photo, a date of birth or a document number.
 *
 * The shape is the one of the payment connector (`payments/PaymentConnector.ts`): Keres starts a verification and gets
 * back what the person does next (`redirect` to an `https` page of the service, or `instructions`), and the service
 * reports facts as signed events. A service imports nothing of Keres: this file is the shape of the messages, and the
 * same shapes are published as JSON Schema for any language.
 *
 * What the contract rules out, on purpose:
 *   - No document image, photo, document number, name on the document or date of birth ever crosses it, in either
 *     direction. The service is handed an id and a username - enough to show a reviewer whose account it is.
 *   - The only thing that identifies the document afterwards is `identityCommitment`: an HMAC the service computes
 *     with a key that never leaves it, over the name, kind and number of the document the reviewer read. It lets the
 *     server refuse a second account on the same document without ever holding the document.
 */

/** The version of the verification contract this Keres speaks. A service says which one it implements. */
export const VERIFIER_API_VERSION = 1;

/** The optional parts of the contract a service may implement, and says it does in its `/v1/info`. */
export const VERIFIER_CAPABILITIES = ['status', 'cancel'] as const;
export type VerifierCapability = (typeof VERIFIER_CAPABILITIES)[number];

/**
 * How the server treats age (see `docs/compliance/age_verification.md`). `required`: every new account is created pending and only
 * activates when the external service approves it. `manual`: no external service; new accounts are active at once and
 * start not verified, an administrator marks or revokes the verified flag by hand, and the adults-only area can be on.
 * The legacy value `disabled` is read as `manual` (normalised in `apps/api/src/config/env.ts`).
 */
export const AGE_VERIFICATION_MODES = ['required', 'manual'] as const;
export type AgeVerificationMode = (typeof AGE_VERIFICATION_MODES)[number];

/** Why a verification was refused. Fixed codes, so the app can say it in the person's language. */
export const VERIFICATION_REJECTION_REASONS = [
  'underage',
  'document_unreadable',
  'document_not_original',
  'face_mismatch',
  'document_reused',
  'other',
] as const;
export type VerificationRejectionReason = (typeof VERIFICATION_REJECTION_REASONS)[number];

/** The method name Keres keeps with an approval ("manual document check with a live photo"). Stable, lower case. */
export const VERIFICATION_METHOD_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** What the service is told about whose account this is: an id and a name, never anything else. */
export interface VerificationSubject {
  userId: string;
  username: string;
}

export interface VerificationRequest {
  /** Keres' id of this verification. Use it as the idempotency key and to name the events about it. */
  verificationId: string;
  subject: VerificationSubject;
  /** The language the person uses, for the service's page and messages. */
  language: string;
  /**
   * Set when the person is sending again after a refusal: the service's own reference of the refused one. A retry
   * is looked at by a different reviewer than the one who refused (a refusal is never a dead end).
   */
  retryOf?: string;
}

/** What the person has to do next. Keres has one generic screen for both, so a service never needs code in the app. */
export type VerificationAction =
  /** Open this address (the service's own upload page). `https`, unless Keres was told otherwise. */
  | { kind: 'redirect'; url: string }
  /** Nothing to open: tell them what to do. */
  | { kind: 'instructions'; title: string; text: string };

export interface VerificationResult {
  /** The service's id for this verification. Kept, shown to the administrators, never interpreted. */
  providerReference: string;
  action: VerificationAction;
  /** When the offer stops being usable. Past it the verification expires. */
  expiresAt?: Date;
}

/**
 * What the service tells Keres. `eventId` is the service's id for the fact: the same one arriving twice (retries) is
 * applied once, so it must be the same every time the same fact is reported. `discardedAt` is when the document and
 * the photo were destroyed at the service - the service destroys them on the decision, whatever it was.
 */
export type VerificationEvent =
  | {
      type: 'verification.approved';
      eventId: string;
      verificationId: string;
      providerReference: string;
      decidedAt: Date;
      /** How it was checked (`manual-document-live-photo`). */
      method: string;
      /** 64 lower-case hex characters: HMAC-SHA256 under the service's own key. See the file comment. */
      identityCommitment: string;
      discardedAt: Date;
    }
  | {
      type: 'verification.rejected';
      eventId: string;
      verificationId: string;
      providerReference: string;
      decidedAt: Date;
      reason: VerificationRejectionReason;
      discardedAt: Date;
    }
  | {
      type: 'verification.expired';
      eventId: string;
      verificationId: string;
      providerReference?: string;
      discardedAt: Date;
    };

/**
 * The service as the rest of the server sees it. The only implementation is the one that speaks the HTTP contract;
 * this interface is the seam registration and the tests are written against.
 */
export interface AgeVerifier {
  /** Stable and short: kept with every verification, so it must never change. */
  readonly id: string;
  /** What the person sees ("Verification by the Keres team"). */
  readonly displayName: string;
  readonly capabilities: readonly VerifierCapability[];

  /** Starts a verification. Anything it throws reaches the person as "could not start the verification". */
  createVerification(request: VerificationRequest): Promise<VerificationResult>;

  /** Asks how a verification ended, for when the event did not arrive. Null while it is open. Capability `status`. */
  getVerificationStatus?(
    verificationId: string,
    providerReference: string,
  ): Promise<VerificationEvent | null>;

  /** Tells the service to destroy a submission nobody will decide (account abandoned or closed). Capability `cancel`. */
  cancelVerification?(providerReference: string): Promise<void>;
}
