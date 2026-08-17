import { z } from 'zod';

/**
 * Payload for `POST /auth/forgot-password` - recupera o acesso com um recovery code em vez
 * da senha atual (ver RecoveryCodeService no servidor). O `recoveryCode` inclui o hífen
 * (formato `XXXXX-XXXXX`); a comparação no servidor é sensível a maiúsculas/minúsculas
 * porque o alfabeto do código já evita ambiguidade.
 */
export const ForgotPasswordSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  recoveryCode: z.string().min(1, 'Recovery code is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type ForgotPasswordType = z.infer<typeof ForgotPasswordSchema>;
