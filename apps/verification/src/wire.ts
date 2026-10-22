import type { z } from 'zod';
import type {
  VerificationEventWireSchema,
  VerificationRequestWireSchema,
  VerificationResultWireSchema,
} from '@keres/shared';

/**
 * Wire types of the protocol. The schemas live in `@keres/shared` (the same ones Keres validates with); the types are
 * inferred from them, so the two sides cannot drift.
 */
export type VerificationRequestWire = z.infer<typeof VerificationRequestWireSchema>;
export type VerificationResultWire = z.infer<typeof VerificationResultWireSchema>;
export type VerificationEventWire = z.infer<typeof VerificationEventWireSchema>;
