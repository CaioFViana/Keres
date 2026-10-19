import type { VerificationEventWire } from '@keres/shared';
import type { VerificationEvent } from '@keres/shared/age-verification/AgeVerificationConnector';

/**
 * An event as it travels (JSON, dates as text) in the terms the verifications are written in. The same conversion the
 * payment route does for its notices (`payments/connector/events.ts`); the service and the poller of a service's
 * status both speak the terms this returns.
 */
export function toVerificationEvent(wire: VerificationEventWire): VerificationEvent {
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
