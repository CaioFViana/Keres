import { z } from 'zod';

/**
 * Payload for `POST /auth/forgot-password` - recovers access with a recovery code instead of the
 * current password (see RecoveryCodeService on the server). The `recoveryCode` is issued as
 * `XXXXX-XXXXX`; the server reads it through `normalizeRecoveryCode`, so case, the hyphen and
 * surrounding spaces do not matter.
 */
export const ForgotPasswordSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  recoveryCode: z.string().min(1, 'Recovery code is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type ForgotPasswordType = z.infer<typeof ForgotPasswordSchema>;
