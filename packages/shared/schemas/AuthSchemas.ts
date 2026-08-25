import { z } from 'zod';

/**
 * Payload for `POST /auth/forgot-password` - recovers access with a recovery code instead of the
 * current password (see RecoveryCodeService on the server). The `recoveryCode` includes the hyphen
 * (format `XXXXX-XXXXX`); the comparison on the server is case-sensitive because the code's
 * alphabet already avoids ambiguity.
 */
export const ForgotPasswordSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  recoveryCode: z.string().min(1, 'Recovery code is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type ForgotPasswordType = z.infer<typeof ForgotPasswordSchema>;
