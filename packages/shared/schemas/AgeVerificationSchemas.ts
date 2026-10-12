import { z } from 'zod';
import {
  AGE_VERIFICATION_MODES,
  VERIFICATION_METHOD_PATTERN,
  VERIFICATION_REJECTION_REASONS,
  VERIFIER_API_VERSION,
  VERIFIER_CAPABILITIES,
} from '../age-verification/AgeVerificationConnector';

/**
 * The messages between Keres and an age-verification service, as they travel (JSON), plus what Keres tells its own
 * app. Keres validates everything a service sends with these before it uses any of it; the same shapes are
 * published as JSON Schema (`docs/age_verification/`). Every text is bounded: what the service says ends up in the
 * database and on screens.
 */

const reference = z.string().min(1).max(200);

/** A service's id is kept with every verification: short, lower case, stable. */
export const VERIFIER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** `GET /v1/info`. */
export const VerifierInfoSchema = z.object({
  apiVersion: z.literal(VERIFIER_API_VERSION),
  id: z.string().regex(VERIFIER_ID_PATTERN),
  displayName: z.string().trim().min(1).max(80),
  capabilities: z
    .array(z.enum(VERIFIER_CAPABILITIES))
    .max(VERIFIER_CAPABILITIES.length)
    .default([]),
});
export type VerifierInfo = z.infer<typeof VerifierInfoSchema>;

/** What the person has to do next. The texts are clipped again by Keres; this only refuses what is absurd. */
export const VerificationActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('redirect'), url: z.string().min(1).max(2048) }),
  z.object({
    kind: z.literal('instructions'),
    title: z.string().min(1).max(500),
    text: z.string().min(1).max(5000),
  }),
]);

/** `POST /v1/verifications` request. */
export const VerificationRequestWireSchema = z.object({
  verificationId: z.string().min(1).max(64),
  subject: z.object({ userId: z.string().min(1).max(64), username: z.string().max(200) }),
  language: z.string().min(2).max(8),
  retryOf: reference.optional(),
});

/** `POST /v1/verifications` answer. */
export const VerificationResultWireSchema = z.object({
  providerReference: reference,
  action: VerificationActionSchema,
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

const eventBase = {
  eventId: reference,
  verificationId: z.string().min(1).max(64),
  discardedAt: z.iso.datetime({ offset: true }),
};

/** One thing the service reported, in Keres' terms. The dates are ISO date-times. */
export const VerificationEventWireSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('verification.approved'),
    ...eventBase,
    providerReference: reference,
    decidedAt: z.iso.datetime({ offset: true }),
    method: z.string().regex(VERIFICATION_METHOD_PATTERN),
    identityCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  z.object({
    type: z.literal('verification.rejected'),
    ...eventBase,
    providerReference: reference,
    decidedAt: z.iso.datetime({ offset: true }),
    reason: z.enum(VERIFICATION_REJECTION_REASONS),
  }),
  z.object({
    type: z.literal('verification.expired'),
    ...eventBase,
    providerReference: reference.optional(),
  }),
]);
export type VerificationEventWire = z.infer<typeof VerificationEventWireSchema>;

/** The most events one request may carry. */
export const MAX_VERIFICATION_EVENTS_PER_REQUEST = 100;

/** `POST /api/age-verification/events`, from the service to Keres. */
export const VerificationEventsRequestSchema = z.object({
  events: z.array(VerificationEventWireSchema).max(MAX_VERIFICATION_EVENTS_PER_REQUEST),
});

/** `GET /v1/verifications/:id?providerReference=...` answer: how it ended, or `null` while open. Capability `status`. */
export const VerificationStatusResponseSchema = z.object({
  event: VerificationEventWireSchema.nullable(),
});

/** `POST /v1/verifications/:reference/cancel` answer. Capability `cancel`. */
export const VerificationCancelResponseSchema = z.object({ ok: z.literal(true) });

// --- What Keres tells its own app -------------------------------------------------------------------------------

/** `GET /api/age-verification/info`, public: the app asks before a person starts an account. */
export const AgeVerificationInfoSchema = z.object({
  mode: z.enum(AGE_VERIFICATION_MODES),
  /** `required` and the service answering right now. In `disabled` it is always false. */
  available: z.boolean(),
});
export type AgeVerificationInfo = z.infer<typeof AgeVerificationInfoSchema>;

export const ACCOUNT_VERIFICATION_STATUSES = [
  'not_required',
  'pending',
  'approved',
  'rejected',
  'expired',
] as const;

/**
 * Where this account stands, for the app's one generic screen. `action` is what to do next while `pending`;
 * `canRetry` says a new sending is allowed after a refusal or an expiry (there is a limit, and `underage` has none:
 * that account is closed).
 */
export const AccountVerificationStatusSchema = z.object({
  status: z.enum(ACCOUNT_VERIFICATION_STATUSES),
  action: VerificationActionSchema.optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  reason: z.enum(VERIFICATION_REJECTION_REASONS).optional(),
  canRetry: z.boolean().optional(),
});
export type AccountVerificationStatus = z.infer<typeof AccountVerificationStatusSchema>;

/**
 * `GET /api/auth/verification` and `POST /api/auth/verification/retry`. A pending account holds a session that is
 * good for nothing but this; the moment the verification turns `approved`, the answer also carries the fresh,
 * fully-privileged `session` (once: the app stores it and carries on).
 */
export const AccountVerificationResponseSchema = AccountVerificationStatusSchema.extend({
  session: z.object({ accessToken: z.string(), refreshToken: z.string() }).optional(),
});
export type AccountVerificationResponse = z.infer<typeof AccountVerificationResponseSchema>;
