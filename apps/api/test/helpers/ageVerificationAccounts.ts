import { desc, eq } from 'drizzle-orm';
import { env } from '@/config/env';
import { db } from '@/db';
import { ageVerifications, users } from '@/db/schema';
import { resetAgeVerifier, setAgeVerifier } from '@/services/ageVerification/AgeVerifierRegistry';
import { sha256Hex } from '@/services/ageVerification/connector/signing';
import { type TestUser, newId, registerUser } from './app';
import { type FakeVerifierOptions, createFakeAgeVerifier } from './fakeAgeVerifier';

/**
 * Shared set-up of the age-verification suites: `required` mode with a fake service connected, accounts that are
 * pending (the state registration will give them), and the events a service would send about them.
 */

/** Makes this process behave as a `required` server, with `verifier` connected. Undo with `leaveRequiredMode`. */
export function enterRequiredMode(options: FakeVerifierOptions = {}) {
  env.AGE_VERIFICATION_MODE = 'required';
  const fake = createFakeAgeVerifier(options);
  setAgeVerifier(fake.verifier);
  return fake;
}

export function leaveRequiredMode(): void {
  env.AGE_VERIFICATION_MODE = 'manual';
  resetAgeVerifier();
}

/**
 * An account the way registration leaves it while the service decides: pending, with its one open sending. Registration
 * (in `required` mode, which the caller entered) makes both now, so this only reads the sending back.
 */
export async function pendingAccount(username?: string) {
  const user: TestUser = await registerUser(username);
  const row = await db.query.ageVerifications.findFirst({
    where: eq(ageVerifications.userId, user.userId),
    orderBy: [desc(ageVerifications.createdAt)],
  });
  if (!row) throw new Error('Registration made no sending: the server is not in required mode.');
  return { user, row };
}

/** A 64-hex identity commitment, standing in for the service's HMAC over a document. */
export const commitmentFor = (seed: string): string => sha256Hex(`commitment:${seed}`);

const now = () => new Date().toISOString();

export function approvedEvent(
  sending: { id: string; providerReference: string },
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: 'verification.approved',
    eventId: `evt_${newId()}`,
    verificationId: sending.id,
    providerReference: sending.providerReference,
    decidedAt: now(),
    method: 'manual-document-live-photo',
    identityCommitment: commitmentFor(sending.id),
    discardedAt: now(),
    ...over,
  };
}

export function rejectedEvent(
  sending: { id: string; providerReference: string },
  reason = 'face_mismatch',
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: 'verification.rejected',
    eventId: `evt_${newId()}`,
    verificationId: sending.id,
    providerReference: sending.providerReference,
    decidedAt: now(),
    reason,
    discardedAt: now(),
    ...over,
  };
}

export function expiredEvent(
  sending: { id: string; providerReference?: string },
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: 'verification.expired',
    eventId: `evt_${newId()}`,
    verificationId: sending.id,
    discardedAt: now(),
    ...over,
  };
}

export const userRow = (userId: string) =>
  db.query.users.findFirst({ where: eq(users.id, userId) });
